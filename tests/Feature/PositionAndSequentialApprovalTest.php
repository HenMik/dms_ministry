<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Document;
use App\Models\DocumentAccessLog;
use App\Models\Position;
use App\Support\AppSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class PositionAndSequentialApprovalTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_position_holders_can_view_document_uploaded_to_position(): void
    {
        $ict = $this->department('ICT', ['name' => 'ICT']);
        $admin = $this->dmsUser('admin', ['is_admin' => true], $ict);
        $officerA = $this->dmsUser('viewer', [], $ict);
        $officerB = $this->dmsUser('viewer', [], $ict);
        $outsider = $this->dmsUser('viewer', [], $this->department('HR', ['name' => 'HR']));

        $position = Position::create([
            'department_id' => $ict->id,
            'name' => 'ICT Officer',
            'description' => '',
            'is_active' => true,
        ]);
        $position->users()->sync([$officerA->id, $officerB->id]);

        $this->actingAs($admin)->post(route('documents.store'), [
            'title' => 'Network policy',
            'department_id' => $ict->id,
            'position_id' => $position->id,
            'visible_to_ids' => [],
            'requires_approval' => false,
            'file' => UploadedFile::fake()->create('policy.pdf', 100, 'application/pdf'),
        ])->assertRedirect();

        $document = Document::where('title', 'Network policy')->firstOrFail();
        $this->assertTrue($document->positions()->whereKey($position->id)->exists());

        $this->actingAs($officerA)->get(route('documents.show', $document))->assertOk();
        $this->actingAs($officerB)->get(route('documents.show', $document))->assertOk();
        $this->actingAs($outsider)->get(route('documents.show', $document))->assertForbidden();
    }

    public function test_sequential_approvers_cannot_see_until_their_turn(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $uploader = $this->dmsUser('contributor', [], $finance);
        $dennis = $this->dmsUser('approver', ['is_approver' => true], $finance);
        $henry = $this->dmsUser('approver', ['is_approver' => true], $finance);
        $lumbani = $this->dmsUser('approver', ['is_approver' => true], $finance);

        $this->actingAs($uploader)->post(route('documents.store'), [
            'title' => 'Budget request',
            'department_id' => $finance->id,
            'requires_approval' => true,
            'pending_approver_ids' => [$dennis->id, $henry->id, $lumbani->id],
            'visible_to_ids' => [],
            'file' => UploadedFile::fake()->create('budget.pdf', 100, 'application/pdf'),
        ])->assertRedirect();

        $document = Document::where('title', 'Budget request')->firstOrFail();
        $this->assertNotNull($document->approval_started_at);
        $this->assertSame('current', $document->pendingApprovers()->whereKey($dennis->id)->first()?->pivot->status);
        $this->assertSame('waiting', $document->pendingApprovers()->whereKey($henry->id)->first()?->pivot->status);

        $this->actingAs($dennis)->get(route('documents.show', $document))->assertOk();
        $this->actingAs($henry)->get(route('documents.show', $document))->assertForbidden();
        $this->actingAs($lumbani)->get(route('documents.show', $document))->assertForbidden();

        $this->assertSame(1, AppNotification::where('user_id', $dennis->id)->where('notification_type', 'APPROVAL_REQUEST')->count());
        $this->assertSame(0, AppNotification::where('user_id', $henry->id)->where('notification_type', 'APPROVAL_REQUEST')->count());

        $this->actingAs($dennis)->post(route('documents.approve', $document))->assertRedirect();

        $document->refresh();
        $this->assertSame('approved', $document->pendingApprovers()->whereKey($dennis->id)->first()?->pivot->status);
        $this->assertSame('current', $document->pendingApprovers()->whereKey($henry->id)->first()?->pivot->status);

        $this->actingAs($henry)->get(route('documents.show', $document))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('can.approve', true));
        $this->actingAs($lumbani)->get(route('documents.show', $document))->assertForbidden();
        $this->assertSame(1, AppNotification::where('user_id', $henry->id)->where('notification_type', 'APPROVAL_REQUEST')->count());

        $this->actingAs($henry)->post(route('documents.approve', $document))->assertRedirect();
        $this->actingAs($lumbani)->post(route('documents.approve', $document))->assertRedirect();

        $document->refresh();
        $this->assertSame('APPROVED', $document->status);
        $this->assertNotNull($document->approval_completed_at);
        $this->actingAs($dennis)->get(route('documents.show', $document))->assertOk();
    }

    public function test_reject_skips_remaining_approvers_and_sets_tat(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $uploader = $this->dmsUser('contributor', [], $finance);
        $first = $this->dmsUser('approver', ['is_approver' => true, 'email' => 'first@dms.test'], $finance);
        $second = $this->dmsUser('approver', ['is_approver' => true, 'email' => 'second@dms.test'], $finance);

        $this->actingAs($uploader)->post(route('documents.store'), [
            'title' => 'Reject me',
            'department_id' => $finance->id,
            'requires_approval' => true,
            'pending_approver_ids' => [$first->id, $second->id],
            'visible_to_ids' => [],
            'file' => UploadedFile::fake()->create('reject.pdf', 100, 'application/pdf'),
        ])->assertRedirect();

        $document = Document::where('title', 'Reject me')->firstOrFail();

        $this->actingAs($first)->post(route('documents.reject', $document), [
            'reason' => 'Needs more detail',
        ])->assertRedirect();

        $document->refresh();
        $this->assertSame('REJECTED', $document->status);
        $this->assertNotNull($document->approval_completed_at);
        $this->assertSame('rejected', $document->pendingApprovers()->whereKey($first->id)->first()?->pivot->status);
        $this->assertSame('skipped', $document->pendingApprovers()->whereKey($second->id)->first()?->pivot->status);
    }

    public function test_view_access_logs_gated_by_settings(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $uploader = $this->dmsUser('contributor', [], $finance);
        $viewer = $this->dmsUser('viewer', ['email' => 'viewer@dms.test'], $finance);
        $watcher = $this->dmsUser('viewer', ['email' => 'watcher@dms.test'], $finance);

        AppSettings::update([
            AppSettings::DOCUMENTS_VIEW_ACCESS_USER_IDS => [$watcher->id],
        ]);

        $document = Document::create([
            'department_id' => $finance->id,
            'title' => 'Tracked',
            'description' => '',
            'file_path' => UploadedFile::fake()->create('tracked.pdf', 10, 'application/pdf')->store('documents', 'local'),
            'file_size' => 10,
            'mime_type' => 'application/pdf',
            'status' => 'DRAFT',
            'uploaded_by_id' => $uploader->id,
        ]);
        $document->visibleTo()->sync([$viewer->id, $watcher->id]);

        $this->actingAs($viewer)->get(route('documents.show', $document))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('can.view_access_logs', false));

        $this->assertTrue(
            DocumentAccessLog::query()->where('document_id', $document->id)->where('action', 'VIEW')->exists()
        );

        $this->actingAs($watcher)->get(route('documents.show', $document))->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('can.view_access_logs', true)
                ->has('accessLogs'));
    }

    public function test_department_manager_can_create_position(): void
    {
        $ict = $this->department('ICT', ['name' => 'ICT']);
        $admin = $this->dmsUser('admin', ['is_admin' => true], $ict);
        $member = $this->dmsUser('viewer', [], $ict);

        $this->actingAs($admin)
            ->post(route('positions.store', $ict), [
                'name' => 'Systems Analyst',
                'code' => 'SYS',
                'description' => 'Supports systems',
                'is_active' => true,
                'user_ids' => [$member->id],
            ])
            ->assertRedirect();

        $position = Position::where('name', 'Systems Analyst')->firstOrFail();
        $this->assertSame($ict->id, $position->department_id);
        $this->assertTrue($position->users()->whereKey($member->id)->exists());
    }
}
