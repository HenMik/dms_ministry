<?php

namespace Tests\Feature;

use App\Models\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class DashboardAnalyticsTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    public function test_dashboard_includes_analytics_series(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $ict = $this->department('ICT', ['name' => 'ICT']);
        $user = $this->dmsUser('contributor', [], $finance);

        $current = Document::create([
            'department_id' => $finance->id,
            'title' => 'Budget note',
            'description' => '',
            'file_path' => 'documents/budget.pdf',
            'mime_type' => 'application/pdf',
            'status' => 'APPROVED',
            'uploaded_by_id' => $user->id,
        ]);
        $current->forceFill([
            'created_at' => now()->startOfMonth()->addDay(),
            'updated_at' => now(),
        ])->saveQuietly();

        $older = Document::create([
            'department_id' => $ict->id,
            'title' => 'System memo',
            'description' => '',
            'file_path' => 'documents/memo.pdf',
            'mime_type' => 'application/pdf',
            'status' => 'DRAFT',
            'uploaded_by_id' => $user->id,
        ]);
        $older->forceFill([
            'created_at' => now()->subMonths(2)->startOfMonth()->addDays(3),
            'updated_at' => now()->subMonths(2),
        ])->saveQuietly();

        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Dashboard')
                ->where('view', 'personal')
                ->has('analytics.uploadsByMonth', 6)
                ->has('analytics.byStatus', 5)
                ->has('analytics.byDepartment')
                ->where('stats.documents', 2)
                ->where('stats.approved', 1)
                ->where('analytics.byStatus.0.status', 'DRAFT')
                ->where('analytics.uploadsByMonth.5.value', 1));
    }

    public function test_departmental_dashboard_includes_department_documents(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $me = $this->dmsUser('contributor', [], $finance);
        $other = $this->dmsUser('contributor', ['email' => 'colleague@example.com'], $finance);

        Document::create([
            'department_id' => $finance->id,
            'title' => 'Mine',
            'description' => '',
            'file_path' => 'documents/mine.pdf',
            'mime_type' => 'application/pdf',
            'status' => 'APPROVED',
            'uploaded_by_id' => $me->id,
        ]);

        Document::create([
            'department_id' => $finance->id,
            'title' => 'Colleague file',
            'description' => '',
            'file_path' => 'documents/colleague.pdf',
            'mime_type' => 'application/pdf',
            'status' => 'REVIEW',
            'uploaded_by_id' => $other->id,
        ]);

        $this->actingAs($me)
            ->get(route('dashboard', ['view' => 'department']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('view', 'department')
                ->where('stats.documents', 2)
                ->where('stats.awaitingApproval', 1)
                ->where('stats.approved', 1));
    }

    public function test_dashboard_stats_only_include_current_users_documents(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $me = $this->dmsUser('contributor', [], $finance);
        $other = $this->dmsUser('contributor', ['email' => 'other@example.com'], $finance);

        Document::create([
            'department_id' => $finance->id,
            'title' => 'Mine',
            'description' => '',
            'file_path' => 'documents/mine.pdf',
            'mime_type' => 'application/pdf',
            'status' => 'APPROVED',
            'uploaded_by_id' => $me->id,
        ]);

        Document::create([
            'department_id' => $finance->id,
            'title' => 'Theirs',
            'description' => '',
            'file_path' => 'documents/theirs.pdf',
            'mime_type' => 'application/pdf',
            'status' => 'APPROVED',
            'uploaded_by_id' => $other->id,
        ]);

        $this->actingAs($me)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('stats.documents', 1)
                ->where('stats.approved', 1)
                ->has('recentDocuments', 1)
                ->where('recentDocuments.0.title', 'Mine')
                ->where('analytics.byDepartment.0.value', 1));
    }

    public function test_guests_cannot_view_dashboard(): void
    {
        $this->get(route('dashboard'))->assertRedirect(route('login'));
    }
}
