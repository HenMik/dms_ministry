<?php

namespace App\Support;

use App\Models\Department;
use App\Models\Document;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DocumentReportBuilder
{
    /**
     * @return array{
     *     uploaded: int,
     *     awaiting_my_approval: int,
     *     approved_by_me: int,
     *     rejected_by_me: int,
     *     by_status: array<string, int>,
     *     avg_approval_seconds: int|null,
     *     avg_approval_label: string|null,
     *     recent_uploads: list<array{id: int, title: string, status: string, created_at: string|null}>,
     *     pending_for_me: list<array{id: int, title: string, status: string, updated_at: string|null}>
     * }
     */
    public function forUser(User $user): array
    {
        $uploaded = Document::query()->where('uploaded_by_id', $user->id);
        $byStatus = (clone $uploaded)
            ->selectRaw('status, count(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status')
            ->map(fn ($count) => (int) $count)
            ->all();

        $awaiting = Document::query()
            ->where('status', 'REVIEW')
            ->whereHas('pendingApprovers', fn ($q) => $q->where('users.id', $user->id)
                ->where('document_pending_approvers.status', 'current'))
            ->count();

        $approvedByMe = Document::query()
            ->whereHas('pendingApprovers', fn ($q) => $q->where('users.id', $user->id)
                ->where('document_pending_approvers.status', 'approved'))
            ->count();

        $rejectedByMe = Document::query()
            ->whereHas('pendingApprovers', fn ($q) => $q->where('users.id', $user->id)
                ->where('document_pending_approvers.status', 'rejected'))
            ->count();

        $avgSeconds = $this->averageApprovalSeconds(
            Document::query()->where('uploaded_by_id', $user->id),
        );

        return [
            'uploaded' => (clone $uploaded)->count(),
            'awaiting_my_approval' => $awaiting,
            'approved_by_me' => $approvedByMe,
            'rejected_by_me' => $rejectedByMe,
            'by_status' => [
                'DRAFT' => (int) ($byStatus['DRAFT'] ?? 0),
                'REVIEW' => (int) ($byStatus['REVIEW'] ?? 0),
                'APPROVED' => (int) ($byStatus['APPROVED'] ?? 0),
                'REJECTED' => (int) ($byStatus['REJECTED'] ?? 0),
                'ARCHIVED' => (int) ($byStatus['ARCHIVED'] ?? 0),
            ],
            'avg_approval_seconds' => $avgSeconds !== null ? (int) round((float) $avgSeconds) : null,
            'avg_approval_label' => $avgSeconds !== null ? Document::formatDuration((int) round((float) $avgSeconds)) : null,
            'recent_uploads' => (clone $uploaded)
                ->latest('created_at')
                ->limit(8)
                ->get(['id', 'title', 'status', 'created_at'])
                ->map(fn (Document $doc) => [
                    'id' => $doc->id,
                    'title' => $doc->title,
                    'status' => $doc->status,
                    'created_at' => $doc->created_at?->toIso8601String(),
                ])
                ->all(),
            'pending_for_me' => Document::query()
                ->where('status', 'REVIEW')
                ->whereHas('pendingApprovers', fn ($q) => $q->where('users.id', $user->id)
                    ->where('document_pending_approvers.status', 'current'))
                ->latest('updated_at')
                ->limit(8)
                ->get(['id', 'title', 'status', 'updated_at'])
                ->map(fn (Document $doc) => [
                    'id' => $doc->id,
                    'title' => $doc->title,
                    'status' => $doc->status,
                    'updated_at' => $doc->updated_at?->toIso8601String(),
                ])
                ->all(),
        ];
    }

    /**
     * @return array{
     *     totals: array{documents: int, members: int, positions: int, awaiting_approval: int},
     *     by_status: array<string, int>,
     *     avg_approval_seconds: int|null,
     *     avg_approval_label: string|null,
     *     uploads_by_day: list<array{date: string, count: int}>,
     *     top_uploaders: list<array{id: int, name: string, count: int}>,
     *     recent_documents: list<array{id: int, title: string, status: string, updated_at: string|null}>
     * }
     */
    public function forDepartment(Department $department, int $days = 30): array
    {
        $docs = Document::query()->where('department_id', $department->id);
        $byStatus = (clone $docs)
            ->selectRaw('status, count(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status')
            ->map(fn ($count) => (int) $count)
            ->all();

        $avgSeconds = $this->averageApprovalSeconds(clone $docs);

        $since = Carbon::now()->subDays($days)->startOfDay();
        $uploadsByDay = $this->uploadsByDay($department->id, $since);

        $topUploaders = Document::query()
            ->where('department_id', $department->id)
            ->selectRaw('uploaded_by_id, count(*) as aggregate')
            ->groupBy('uploaded_by_id')
            ->orderByDesc('aggregate')
            ->limit(8)
            ->get();

        $uploaderNames = User::query()
            ->whereIn('id', $topUploaders->pluck('uploaded_by_id')->filter())
            ->get(['id', 'first_name', 'last_name'])
            ->keyBy('id');

        return [
            'totals' => [
                'documents' => (clone $docs)->count(),
                'members' => $department->users()->count(),
                'positions' => $department->positions()->count(),
                'awaiting_approval' => (int) ($byStatus['REVIEW'] ?? 0),
            ],
            'by_status' => [
                'DRAFT' => (int) ($byStatus['DRAFT'] ?? 0),
                'REVIEW' => (int) ($byStatus['REVIEW'] ?? 0),
                'APPROVED' => (int) ($byStatus['APPROVED'] ?? 0),
                'REJECTED' => (int) ($byStatus['REJECTED'] ?? 0),
                'ARCHIVED' => (int) ($byStatus['ARCHIVED'] ?? 0),
            ],
            'avg_approval_seconds' => $avgSeconds !== null ? (int) round((float) $avgSeconds) : null,
            'avg_approval_label' => $avgSeconds !== null ? Document::formatDuration((int) round((float) $avgSeconds)) : null,
            'uploads_by_day' => $uploadsByDay,
            'top_uploaders' => $topUploaders->map(fn ($row) => [
                'id' => (int) $row->uploaded_by_id,
                'name' => $uploaderNames->get($row->uploaded_by_id)?->name ?? 'Unknown',
                'count' => (int) $row->aggregate,
            ])->values()->all(),
            'recent_documents' => (clone $docs)
                ->latest('updated_at')
                ->limit(10)
                ->get(['id', 'title', 'status', 'updated_at'])
                ->map(fn (Document $doc) => [
                    'id' => $doc->id,
                    'title' => $doc->title,
                    'status' => $doc->status,
                    'updated_at' => $doc->updated_at?->toIso8601String(),
                ])
                ->all(),
            'days' => $days,
        ];
    }

    /**
     * @param  Builder<Document>  $query
     */
    private function averageApprovalSeconds($query): ?float
    {
        $timed = (clone $query)
            ->whereNotNull('approval_started_at')
            ->whereNotNull('approval_completed_at');

        if (DB::connection()->getDriverName() === 'sqlite') {
            $rows = $timed->get(['approval_started_at', 'approval_completed_at']);

            if ($rows->isEmpty()) {
                return null;
            }

            return (float) $rows->avg(
                fn (Document $doc) => $doc->approval_completed_at->getTimestamp() - $doc->approval_started_at->getTimestamp()
            );
        }

        $avgSeconds = $timed
            ->selectRaw('AVG(TIMESTAMPDIFF(SECOND, approval_started_at, approval_completed_at)) as avg_seconds')
            ->value('avg_seconds');

        return $avgSeconds !== null ? (float) $avgSeconds : null;
    }

    /**
     * @return list<array{date: string, count: int}>
     */
    private function uploadsByDay(int $departmentId, Carbon $since): array
    {
        $driver = DB::connection()->getDriverName();
        $dateExpr = match ($driver) {
            'sqlite' => "strftime('%Y-%m-%d', created_at)",
            default => 'DATE(created_at)',
        };

        /** @var Collection<int, object{day: string, aggregate: int|string}> $rows */
        $rows = Document::query()
            ->where('department_id', $departmentId)
            ->where('created_at', '>=', $since)
            ->selectRaw("{$dateExpr} as day, count(*) as aggregate")
            ->groupBy('day')
            ->orderBy('day')
            ->get();

        $byDay = $rows->mapWithKeys(fn ($row) => [(string) $row->day => (int) $row->aggregate]);

        $series = [];
        $cursor = $since->copy();
        $end = Carbon::now()->startOfDay();
        while ($cursor <= $end) {
            $key = $cursor->toDateString();
            $series[] = [
                'date' => $key,
                'count' => (int) ($byDay[$key] ?? 0),
            ];
            $cursor->addDay();
        }

        return $series;
    }
}
