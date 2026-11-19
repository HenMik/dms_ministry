<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\Position;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $view = $request->string('view')->toString() === 'department' ? 'department' : 'personal';
        $canCreate = $user->can('create', Document::class);

        $currentApprover = fn ($q) => $q->where('users.id', $user->id)
            ->where('document_pending_approvers.status', 'current');

        $scoped = $this->scopedDocuments($user, $view);

        $byStatus = (clone $scoped)
            ->selectRaw('status, count(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $statusBreakdown = [
            'DRAFT' => (int) ($byStatus['DRAFT'] ?? 0),
            'REVIEW' => (int) ($byStatus['REVIEW'] ?? 0),
            'APPROVED' => (int) ($byStatus['APPROVED'] ?? 0),
            'REJECTED' => (int) ($byStatus['REJECTED'] ?? 0),
            'ARCHIVED' => (int) ($byStatus['ARCHIVED'] ?? 0),
        ];

        $awaitingApproval = $view === 'personal'
            ? Document::whereHas('pendingApprovers', $currentApprover)
                ->where('status', 'REVIEW')
                ->with(['uploadedBy:id,first_name,last_name', 'department:id,name'])
                ->latest('updated_at')
                ->limit(5)
                ->get()
            : (clone $scoped)
                ->where('status', 'REVIEW')
                ->with(['uploadedBy:id,first_name,last_name', 'department:id,name'])
                ->latest('updated_at')
                ->limit(5)
                ->get();

        $awaitingCount = $view === 'personal'
            ? Document::whereHas('pendingApprovers', $currentApprover)->where('status', 'REVIEW')->count()
            : (int) ($byStatus['REVIEW'] ?? 0);

        $departments = $canCreate
            ? ($user->canPerm('documents.view_all')
                ? Department::where('is_active', true)->orderBy('name')->get(['id', 'name', 'code'])
                : $user->departments()->where('is_active', true)->orderBy('name')->get(['departments.id', 'departments.name', 'departments.code']))
            : collect();

        $uploadUsers = $canCreate
            ? User::query()
                ->where('is_active', true)
                ->with(['departments:id', 'positions:id'])
                ->orderBy('first_name')
                ->orderBy('last_name')
                ->get(['id', 'first_name', 'last_name', 'email', 'is_approver'])
                ->map(fn (User $member) => [
                    'id' => $member->id,
                    'first_name' => $member->first_name,
                    'last_name' => $member->last_name,
                    'email' => $member->email,
                    'is_approver' => $member->is_approver,
                    'department_ids' => $member->departments->pluck('id')->values()->all(),
                    'position_ids' => $member->positions->pluck('id')->values()->all(),
                ])
            : collect();

        $positionsQuery = Position::query()
            ->where('is_active', true)
            ->withCount('users')
            ->orderBy('name');

        if (! $user->canPerm('documents.view_all')) {
            $positionsQuery->whereIn('department_id', $user->departmentIds());
        }

        return Inertia::render('Dashboard', [
            'view' => $view,
            'stats' => [
                'documents' => (clone $scoped)->count(),
                'awaitingApproval' => $awaitingCount,
                'approved' => (int) ($byStatus['APPROVED'] ?? 0),
                'archived' => (int) ($byStatus['ARCHIVED'] ?? 0),
            ],
            'awaitingApproval' => $awaitingApproval,
            'recentDocuments' => (clone $scoped)
                ->with(['category:id,name', 'department:id,name'])
                ->latest('updated_at')
                ->limit(8)
                ->get(),
            'statusBreakdown' => $statusBreakdown,
            'analytics' => [
                'uploadsByMonth' => $this->uploadsByMonth($user, $view),
                'byDepartment' => $this->documentsByDepartment($user, $view),
                'byStatus' => collect($statusBreakdown)
                    ->map(fn (int $value, string $status) => [
                        'status' => $status,
                        'label' => ucfirst(strtolower($status)),
                        'value' => $value,
                    ])
                    ->values()
                    ->all(),
            ],
            'canCreate' => $canCreate,
            'departments' => $departments,
            'positions' => $canCreate
                ? $positionsQuery->get(['id', 'name', 'code', 'department_id'])->map(fn (Position $position) => [
                    'id' => $position->id,
                    'name' => $position->name,
                    'code' => $position->code,
                    'department_id' => $position->department_id,
                    'users_count' => $position->users_count,
                ])
                : collect(),
            'users' => $uploadUsers,
            'folders' => $canCreate
                ? DocumentCategory::flatOptions(
                    $user->canPerm('documents.view_all') ? null : $user->departmentIds(),
                    $user,
                )->map(fn (DocumentCategory $category) => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'label' => $category->getAttribute('label'),
                    'parent_id' => $category->parent_id,
                    'department_ids' => $category->departmentIds(),
                ])
                : collect(),
            'savedSignature' => $canCreate ? $user->signature_image : null,
        ]);
    }

    /**
     * @return Builder<Document>
     */
    private function scopedDocuments(User $user, string $view): Builder
    {
        if ($view === 'personal') {
            return Document::query()->where('uploaded_by_id', $user->id);
        }

        $departmentIds = $user->departmentIds();

        return Document::accessibleBy($user)
            ->when(
                $departmentIds === [],
                fn (Builder $query) => $query->whereRaw('0 = 1'),
                fn (Builder $query) => $query->whereIn('department_id', $departmentIds),
            );
    }

    /**
     * @return list<array{month: string, label: string, value: int}>
     */
    private function uploadsByMonth(User $user, string $view): array
    {
        $months = collect(range(5, 0))->map(fn (int $offset) => now()->startOfMonth()->subMonths($offset));
        $since = $months->first()->copy();
        $monthExpr = $this->monthBucketExpression('created_at');

        $counts = $this->scopedDocuments($user, $view)
            ->where('created_at', '>=', $since)
            ->selectRaw("{$monthExpr} as month_key, count(*) as aggregate")
            ->groupBy('month_key')
            ->pluck('aggregate', 'month_key');

        return $months->map(function (Carbon $month) use ($counts) {
            $key = $month->format('Y-m');

            return [
                'month' => $key,
                'label' => $month->format('M'),
                'value' => (int) ($counts[$key] ?? 0),
            ];
        })->values()->all();
    }

    /**
     * @return list<array{id: int, name: string, value: int}>
     */
    private function documentsByDepartment(User $user, string $view): array
    {
        $counts = $this->scopedDocuments($user, $view)
            ->whereNotNull('department_id')
            ->selectRaw('department_id, count(*) as aggregate')
            ->groupBy('department_id')
            ->orderByDesc('aggregate')
            ->limit(6)
            ->pluck('aggregate', 'department_id');

        if ($counts->isEmpty()) {
            return [];
        }

        $names = Department::query()
            ->whereIn('id', $counts->keys())
            ->pluck('name', 'id');

        return $counts
            ->map(fn (int|string $value, int|string $id) => [
                'id' => (int) $id,
                'name' => (string) ($names[$id] ?? 'Unknown'),
                'value' => (int) $value,
            ])
            ->values()
            ->all();
    }

    private function monthBucketExpression(string $column): string
    {
        $qualified = 'documents.'.$column;

        return match (DB::connection()->getDriverName()) {
            'sqlite' => "strftime('%Y-%m', {$qualified})",
            'pgsql' => "to_char({$qualified}, 'YYYY-MM')",
            default => "DATE_FORMAT({$qualified}, '%Y-%m')",
        };
    }
}
