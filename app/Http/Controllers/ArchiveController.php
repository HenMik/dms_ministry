<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Archive;
use App\Models\Document;
use App\Models\SearchHistory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ArchiveController extends Controller
{
    private const TYPES = [
        'document' => Document::class,
    ];

    public function index(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user->canPerm('archive.view') || $user->canPerm('documents.archive'), 403);

        $query = Archive::with(['archivable', 'archivedBy:id,first_name,last_name'])
            ->where('archivable_type', Document::class)
            ->latest('archived_at');

        if (! $user->canPerm('documents.archive')) {
            $query->where(fn (Builder $q) => $q->where('restricted_access', false)
                ->orWhereHas('allowedUsers', fn (Builder $r) => $r->whereKey($user->id)));
        }

        $archives = $query->paginate(20)->withQueryString();
        $archives->getCollection()->transform(function (Archive $archive) {
            $archive->setAttribute('type', 'document');
            $archive->setAttribute('url', $this->urlFor($archive));

            return $archive;
        });

        return Inertia::render('Archive/Index', [
            'archives' => $archives,
            'filters' => (object) $request->only(['type']),
            'canManage' => $user->canPerm('documents.archive'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->canPerm('documents.archive'), 403);

        $data = $request->validate([
            'type' => ['required', 'in:document'],
            'id' => ['required', 'integer'],
            'reason' => ['nullable', 'string', 'max:2000'],
            'restricted_access' => ['boolean'],
            'allowed_user_ids' => ['array'],
            'allowed_user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $document = Document::findOrFail($data['id']);
        abort_unless($request->user()->can('archive', $document), 403);

        if (Archive::where('archivable_type', Document::class)->where('archivable_id', $document->id)->exists()) {
            return back()->with('error', 'This item is already archived.');
        }

        $archive = Archive::create([
            'archivable_type' => Document::class,
            'archivable_id' => $document->id,
            'archived_by_id' => $request->user()->id,
            'archived_at' => now(),
            'reason' => $data['reason'] ?? '',
            'restricted_access' => $request->boolean('restricted_access'),
            'previous_status' => $document->status,
        ]);

        $archive->allowedUsers()->sync($data['allowed_user_ids'] ?? []);
        $document->update(['status' => 'ARCHIVED']);

        ActivityLog::record($request->user(), 'ARCHIVE', 'Document #'.$document->id);

        return back()->with('success', 'Document archived.');
    }

    public function unarchive(Request $request, Archive $archive): RedirectResponse
    {
        abort_unless($request->user()->canPerm('documents.archive'), 403);

        $model = $archive->archivable;

        if ($model instanceof Document && $archive->previous_status && $model->status === 'ARCHIVED') {
            $model->update(['status' => $archive->previous_status]);
        }

        $archive->delete();

        return back()->with('success', 'Document restored from archive.');
    }

    public function search(Request $request): Response
    {
        $user = $request->user();
        $q = trim($request->string('q')->toString());

        $results = ['documents' => []];

        if ($q !== '') {
            $term = "%{$q}%";
            $results = [
                'documents' => Document::accessibleBy($user)
                    ->where(fn (Builder $b) => $b->where('title', 'like', $term)->orWhere('description', 'like', $term))
                    ->with(['category:id,name', 'department:id,name'])
                    ->latest('updated_at')
                    ->limit(20)
                    ->get(),
            ];

            SearchHistory::create([
                'user_id' => $user->id,
                'query' => mb_substr($q, 0, 500),
                'results_count' => collect($results)->sum(fn ($c) => $c->count()),
                'search_filters' => $request->only('type'),
                'searched_at' => now(),
            ]);
        }

        return Inertia::render('Archive/Search', [
            'query' => $q,
            'results' => $results,
            'resultsCount' => collect($results)->sum(fn ($c) => count($c)),
        ]);
    }

    private function urlFor(Archive $archive): ?string
    {
        if (! $archive->archivable) {
            return null;
        }

        return match ($archive->archivable_type) {
            Document::class => route('documents.show', $archive->archivable_id),
            default => null,
        };
    }
}
