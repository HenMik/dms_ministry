<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class DocumentApprovalTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function user(string $role, array $attributes = []): User
    {
        return $this->dmsUser($role, $attributes);
    }

    private function document(User $owner, array $attributes = []): Document
    {
        return Document::create([
            'department_id' => $owner->departments()->first()?->id ?? $this->department()->id,
            'title' => 'Board paper',
            'description' => '',
            'file_path' => UploadedFile::fake()->create('paper.pdf', 100, 'application/pdf')->store('documents', 'local'),
            'file_size' => 100,
            'mime_type' => 'application/pdf',
            'status' => 'DRAFT',
            'uploaded_by_id' => $owner->id,
            ...$attributes,
        ]);
    }

    public function test_assigned_approver_sees_approve_actions_on_show(): void
    {
        $uploader = $this->user('contributor');
        $approver = $this->user('approver', ['is_approver' => true]);
        $document = $this->document($uploader, [
            'status' => 'REVIEW',
            'requires_approval' => true,
        ]);
        $document->syncApprovalChain([$approver->id]);

        $this->actingAs($approver)
            ->get(route('documents.show', $document))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Documents/Show')
                ->where('can.approve', true));
    }

    public function test_unassigned_user_does_not_see_approve_actions(): void
    {
        $uploader = $this->user('contributor');
        $approver = $this->user('approver', ['is_approver' => true]);
        $other = $this->user('approver', ['is_approver' => true]);
        $document = $this->document($uploader, [
            'status' => 'REVIEW',
            'requires_approval' => true,
        ]);
        $document->syncApprovalChain([$approver->id]);
        $document->visibleTo()->sync([$other->id]);

        $this->actingAs($other)
            ->get(route('documents.show', $document))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('can.approve', false));
    }

    public function test_upload_with_approvers_puts_document_in_review(): void
    {
        $uploader = $this->user('contributor');
        $approver = $this->user('approver', ['is_approver' => true]);

        $this->actingAs($uploader)->post(route('documents.store'), [
            'title' => 'Needs review',
            'department_id' => $uploader->departments()->first()->id,
            'requires_approval' => true,
            'pending_approver_ids' => [$approver->id],
            'visible_to_ids' => [],
            'file' => UploadedFile::fake()->create('agenda.pdf', 100, 'application/pdf'),
        ])->assertRedirect();

        $document = Document::where('title', 'Needs review')->firstOrFail();
        $this->assertSame('REVIEW', $document->status);
        $this->assertTrue($document->pendingApprovers()->whereKey($approver->id)->exists());
    }

    public function test_editing_to_add_approvers_moves_document_to_review(): void
    {
        $uploader = $this->user('contributor');
        $approver = $this->user('approver', ['is_approver' => true]);
        $document = $this->document($uploader, ['status' => 'DRAFT']);

        $this->actingAs($uploader)
            ->from(route('documents.edit', $document))
            ->post(route('documents.update', $document), [
                '_method' => 'put',
                'title' => $document->title,
                'description' => '',
                'department_id' => $document->department_id,
                'status' => 'DRAFT',
                'requires_approval' => true,
                'pending_approver_ids' => [$approver->id],
                'visible_to_ids' => [],
            ])
            ->assertRedirect(route('documents.show', $document));

        $document->refresh();
        $this->assertSame('REVIEW', $document->status);
        $this->assertTrue($document->pendingApprovers()->whereKey($approver->id)->exists());

        $this->actingAs($approver)
            ->get(route('documents.show', $document))
            ->assertInertia(fn (Assert $page) => $page->where('can.approve', true));
    }

    public function test_approver_can_approve_and_is_removed_from_pending(): void
    {
        $uploader = $this->user('contributor');
        $approver = $this->user('approver', ['is_approver' => true]);
        $document = $this->document($uploader, [
            'status' => 'REVIEW',
            'requires_approval' => true,
        ]);
        $document->syncApprovalChain([$approver->id]);

        $this->actingAs($approver)
            ->from(route('documents.show', $document))
            ->post(route('documents.approve', $document))
            ->assertRedirect();

        $document->refresh();
        $this->assertSame('APPROVED', $document->status);
        $this->assertSame('approved', $document->pendingApprovers()->whereKey($approver->id)->first()?->pivot->status);
        $this->assertTrue($document->approvedBy()->whereKey($approver->id)->exists());
    }
}
