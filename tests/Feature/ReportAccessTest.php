<?php

namespace Tests\Feature;

use App\Models\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class ReportAccessTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_any_authenticated_user_can_view_personal_reports(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $user = $this->dmsUser('viewer', [], $finance);

        Document::create([
            'department_id' => $finance->id,
            'title' => 'Budget note',
            'description' => '',
            'file_path' => UploadedFile::fake()->create('budget.pdf', 100, 'application/pdf')->store('documents', 'local'),
            'file_size' => 100,
            'mime_type' => 'application/pdf',
            'status' => 'APPROVED',
            'uploaded_by_id' => $user->id,
        ]);

        $this->actingAs($user)
            ->get(route('reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Index')
                ->where('me.uploaded', 1)
                ->has('departments', 0));

        $this->actingAs($user)
            ->get(route('reports.me'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Me')
                ->where('report.uploaded', 1)
                ->where('user.id', $user->id));
    }

    public function test_selected_report_viewer_can_open_department_report(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $hr = $this->department('HR', ['name' => 'Human Resources']);
        $viewer = $this->dmsUser('viewer', [], $finance);
        $outsider = $this->dmsUser('contributor', [
            'email' => 'outsider@example.com',
        ], $hr);

        $finance->reportViewers()->sync([$viewer->id]);

        Document::create([
            'department_id' => $finance->id,
            'title' => 'Policy',
            'description' => '',
            'file_path' => UploadedFile::fake()->create('policy.pdf', 100, 'application/pdf')->store('documents', 'local'),
            'file_size' => 100,
            'mime_type' => 'application/pdf',
            'status' => 'REVIEW',
            'uploaded_by_id' => $viewer->id,
        ]);

        $this->actingAs($viewer)
            ->get(route('reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Index')
                ->has('departments', 1)
                ->where('departments.0.id', $finance->id));

        $this->actingAs($viewer)
            ->get(route('reports.department', $finance))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Department')
                ->where('department.id', $finance->id)
                ->where('report.totals.documents', 1)
                ->where('report.totals.awaiting_approval', 1));

        $this->actingAs($outsider)
            ->get(route('reports.department', $finance))
            ->assertForbidden();
    }

    public function test_reports_view_permission_unlocks_all_department_reports(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $reporter = $this->dmsUser('reporter', [], $finance, [
            'documents.view' => true,
            'reports.view' => true,
        ]);
        $plain = $this->dmsUser('viewer', ['email' => 'plain@example.com'], $finance);

        $this->actingAs($reporter)
            ->get(route('reports.department', $finance))
            ->assertOk();

        $this->actingAs($plain)
            ->get(route('reports.department', $finance))
            ->assertForbidden();
    }

    public function test_department_edit_can_assign_report_viewers(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $admin = $this->dmsUser('admin', ['is_admin' => true], $finance);
        $viewer = $this->dmsUser('viewer', ['email' => 'reports@example.com'], $finance);

        $this->actingAs($admin)
            ->put(route('departments.update', $finance), [
                'name' => 'Finance',
                'code' => 'FIN',
                'description' => '',
                'is_active' => true,
                'sort_order' => 0,
                'user_ids' => [$admin->id, $viewer->id],
                'primary_user_id' => $admin->id,
                'report_viewer_ids' => [$viewer->id],
            ])
            ->assertRedirect(route('departments.show', $finance));

        $this->assertDatabaseHas('department_report_user', [
            'department_id' => $finance->id,
            'user_id' => $viewer->id,
        ]);

        $this->actingAs($admin)
            ->get(route('departments.edit', $finance))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Departments/Edit')
                ->where('department.report_viewer_ids', [$viewer->id]));
    }

    public function test_guest_cannot_view_reports(): void
    {
        $this->get(route('reports.index'))->assertRedirect(route('login'));
        $this->get(route('reports.me'))->assertRedirect(route('login'));
    }
}
