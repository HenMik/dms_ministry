<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\AppNotification;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentAccessLog;
use App\Models\DocumentAnnotation;
use App\Models\DocumentCategory;
use App\Models\DocumentSignature;
use App\Models\Position;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    private const DISK = 'local';

    private const ALLOWED_MIMES = 'pdf';

    public function index(Request $request): Response
    {
        $user = $request->user();
        $awaiting = $request->boolean('awaiting');
        $searching = $request->filled('q');
        $folderId = $request->filled('folder') ? $request->integer('folder') : null;
        $folder = $folderId
            ? DocumentCategory::with(['parent', 'visibleTo:id,first_name,last_name'])->findOrFail($folderId)
            : null;

        if ($folder && ! $folder->isAccessibleBy($user)) {
            abort(403);
        }

        $departmentId = $request->filled('department') ? $request->integer('department') : null;

        $query = Document::accessibleBy($user)
            ->with(['category:id,name', 'department:id,name,code', 'uploadedBy:id,first_name,last_name'])
            ->withCount('signatures')
            ->latest('updated_at');

        if ($departmentId) {
            $query->where('department_id', $departmentId);
        }

        if ($awaiting) {
            $query->whereHas('pendingApprovers', fn ($q) => $q->where('users.id', $user->id)
                ->where('document_pending_approvers.status', 'current'));
        } elseif ($searching) {
            $term = '%'.$request->string('q')->toString().'%';
            $query->where(fn ($q) => $q->where('title', 'like', $term)->orWhere('description', 'like', $term));
        } else {
            $query->where('category_id', $folderId);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        $folders = collect();
        if (! $awaiting && ! $searching) {
            $foldersQuery = DocumentCategory::query()
                ->accessibleBy($user)
                ->withCount('visibleTo')
                ->where('parent_id', $folderId);

            if ($departmentId) {
                $foldersQuery->where(function ($q) use ($departmentId) {
                    $q->whereDoesntHave('departments')
                        ->orWhereHas('departments', fn ($dept) => $dept->whereKey($departmentId));
                });
            }

            $folders = $foldersQuery
                ->with('departments:id,name,code')
                ->orderBy('name')
                ->get(['id', 'name', 'parent_id', 'updated_at'])
                ->map(function (DocumentCategory $category) use ($user) {
                    $category->setAttribute(
                        'documents_count',
                        Document::accessibleBy($user)->where('category_id', $category->id)->count()
                    );
                    $category->setAttribute(
                        'folders_count',
                        $category->children()->accessibleBy($user)->count()
                    );
                    $category->setAttribute('is_restricted', $category->visible_to_count > 0);
                    $category->setAttribute('department_ids', $category->departmentIds());

                    return $category;
                });
        }

        $breadcrumbs = [['label' => 'Documents', 'href' => route('documents.index')]];
        if ($folder) {
            foreach ($folder->breadcrumbTrail() as $crumb) {
                $breadcrumbs[] = [
                    'label' => $crumb['name'],
                    'href' => route('documents.index', ['folder' => $crumb['id']]),
                ];
            }
            $breadcrumbs[count($breadcrumbs) - 1]['href'] = null;
        }

        return Inertia::render('Documents/Index', [
            'documents' => $query->paginate(40)->withQueryString(),
            'folders' => $folders,
            'currentFolder' => $folder ? [
                'id' => $folder->id,
                'name' => $folder->name,
                'parent_id' => $folder->parent_id,
            ] : null,
            'breadcrumbs' => $breadcrumbs,
            'folderOptions' => DocumentCategory::flatOptions(
                $user->canPerm('documents.view_all') ? null : $user->departmentIds(),
                $user
            )->map(fn (DocumentCategory $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'label' => $c->getAttribute('label'),
                'parent_id' => $c->parent_id,
                'department_ids' => $c->departmentIds(),
            ]),
            'filters' => (object) [
                'status' => $request->input('status'),
                'q' => $request->input('q'),
                'folder' => $folderId,
                'department' => $departmentId,
                'awaiting' => $awaiting ? '1' : null,
            ],
            'departments' => $user->canPerm('documents.view_all')
                ? Department::where('is_active', true)->orderBy('name')->get(['id', 'name', 'code'])
                : $user->departments()->where('is_active', true)->orderBy('name')->get(['departments.id', 'departments.name', 'departments.code']),
            'users' => User::where('is_active', true)->orderBy('first_name')->get(['id', 'first_name', 'last_name', 'email']),
            'awaitingCount' => Document::whereHas('pendingApprovers', fn ($q) => $q->where('users.id', $user->id)
                ->where('document_pending_approvers.status', 'current'))->count(),
            'canCreate' => Gate::allows('create', Document::class),
            'canManageFolders' => $user->canPerm('folders.manage'),
            'viewMode' => $awaiting ? 'awaiting' : ($searching ? 'search' : 'folder'),
        ]);
    }

    public function create(Request $request): Response
    {
        Gate::authorize('create', Document::class);

        return Inertia::render('Documents/Form', [
            'document' => null,
            'defaultFolderId' => $request->integer('folder') ?: null,
            ...$this->formOptions(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', Document::class);

        $data = $this->validateDocument($request, creating: true);
        $departmentId = isset($data['department_id']) ? (int) $data['department_id'] : null;
        if ($departmentId !== null) {
            $this->assertDepartmentAccess($request, $departmentId);
        }
        $file = $request->file('file');
        $approverIds = $request->boolean('requires_approval') ? array_values($data['pending_approver_ids'] ?? []) : [];
        $positionId = isset($data['position_id']) ? (int) $data['position_id'] : null;

        $document = DB::transaction(function () use ($request, $data, $file, $approverIds, $departmentId, $positionId) {
            $visibleIds = array_values(array_unique(array_map('intval', $data['visible_to_ids'] ?? [])));

            if ($positionId) {
                $position = Position::with('users:id')->findOrFail($positionId);
                if ($departmentId === null) {
                    $departmentId = $position->department_id;
                }
                $visibleIds = array_values(array_unique(array_merge($visibleIds, $position->userIds())));
            }

            $document = Document::create([
                'department_id' => $departmentId,
                'title' => $data['title'],
                'description' => $data['description'] ?? '',
                'category_id' => $data['category_id'] ?? null,
                'file_path' => $file->store('documents', self::DISK),
                'file_size' => $file->getSize(),
                'mime_type' => $file->getMimeType() ?? '',
                'requires_approval' => $approverIds !== [],
                'approval_started_at' => $approverIds !== [] ? now() : null,
                'access_expires_at' => $data['access_expires_at'] ?? null,
                'status' => $approverIds !== [] ? 'REVIEW' : 'DRAFT',
                'uploaded_by_id' => $request->user()->id,
            ]);

            $document->visibleTo()->sync($visibleIds);
            if ($positionId) {
                $document->positions()->sync([$positionId]);
            }
            if ($approverIds !== []) {
                $document->syncApprovalChain($approverIds);
            }

            return $document;
        });

        if ($approverIds !== []) {
            $this->notifyApprovers($document, [(int) $approverIds[0]]);
        }
        ActivityLog::record($request->user(), 'DOCUMENT_UPLOAD', $document->title);

        if ($request->boolean('async') || $request->expectsJson()) {
            return response()->json([
                'ok' => true,
                'id' => $document->id,
                'title' => $document->title,
            ]);
        }

        $folderQuery = $document->category_id ? ['folder' => $document->category_id] : [];

        return redirect()
            ->route('documents.index', $folderQuery)
            ->with('success', 'Document uploaded.');
    }

    public function show(Request $request, Document $document): Response
    {
        Gate::authorize('view', $document);

        $user = $request->user();

        $document->load([
            'category:id,name',
            'uploadedBy:id,first_name,last_name,email',
            'annotations' => fn ($q) => $q->with('user:id,first_name,last_name')->oldest(),
            'signatures' => fn ($q) => $q->with('user:id,first_name,last_name')->latest('signed_at'),
            'approvedBy',
            'pendingApprovers',
            'visibleTo',
            'positions:id,name,department_id',
        ]);

        $this->healSignedFilePath($document);

        $document->signatures->each(function (DocumentSignature $signature) use ($document) {
            $signature->setAttribute(
                'is_current',
                filled($document->signed_file_path)
                    && data_get($signature->signature_data, 'file_path') === $document->signed_file_path
            );
        });

        $this->logAccess($request, $document, 'VIEW');

        $canViewAccessLogs = $document->userCanViewAccessLogs($user);
        $accessLogs = $canViewAccessLogs
            ? $document->accessLogs()
                ->with('user:id,first_name,last_name,email')
                ->latest('accessed_at')
                ->limit(50)
                ->get()
                ->map(fn (DocumentAccessLog $log) => [
                    'id' => $log->id,
                    'action' => $log->action,
                    'accessed_at' => $log->accessed_at,
                    'user' => $log->user,
                ])
            : [];

        $approvalChain = $document->pendingApprovers->map(fn (User $approver) => [
            'id' => $approver->id,
            'first_name' => $approver->first_name,
            'last_name' => $approver->last_name,
            'email' => $approver->email,
            'sort_order' => (int) $approver->pivot->sort_order,
            'status' => $approver->pivot->status,
            'acted_at' => $approver->pivot->acted_at,
        ])->values();

        return Inertia::render('Documents/Show', [
            'document' => $document,
            'approvalChain' => $approvalChain,
            'tat' => $document->requires_approval ? $document->tatSummary() : null,
            'accessLogs' => $accessLogs,
            'fileUrl' => route('documents.file', ['document' => $document, 'v' => $document->updated_at?->timestamp]),
            'savedSignature' => $user->signature_image,
            'savedStamp' => $user->stamp_image,
            'can' => [
                'update' => Gate::allows('update', $document),
                'delete' => Gate::allows('delete', $document),
                'approve' => Gate::allows('approve', $document),
                'sign' => Gate::allows('sign', $document),
                'annotate' => Gate::allows('annotate', $document),
                'archive' => Gate::allows('archive', $document),
                'moderate' => $user->isAdmin(),
                'view_access_logs' => $canViewAccessLogs,
            ],
        ]);
    }

    public function edit(Document $document): Response
    {
        Gate::authorize('update', $document);

        $document->load(['visibleTo:id', 'pendingApprovers:id', 'positions:id']);

        return Inertia::render('Documents/Form', [
            'document' => $document,
            'defaultFolderId' => $document->category_id,
            ...$this->formOptions(),
        ]);
    }

    public function move(Request $request, Document $document): RedirectResponse
    {
        Gate::authorize('update', $document);

        $data = $request->validate([
            'category_id' => ['nullable', 'exists:document_categories,id'],
        ]);

        $document->update(['category_id' => $data['category_id'] ?? null]);
        ActivityLog::record($request->user(), 'DOCUMENT_MOVE', $document->title, [
            'category_id' => $document->category_id,
        ]);

        return back()->with('success', 'Document moved.');
    }

    public function update(Request $request, Document $document): RedirectResponse
    {
        Gate::authorize('update', $document);

        $data = $this->validateDocument($request, creating: false);
        $departmentId = isset($data['department_id']) ? (int) $data['department_id'] : null;
        if ($departmentId !== null) {
            $this->assertDepartmentAccess($request, $departmentId);
        }
        $replaced = $request->hasFile('file');

        $attributes = [
            'department_id' => $departmentId,
            'title' => $data['title'],
            'description' => $data['description'] ?? '',
            'category_id' => $data['category_id'] ?? null,
            'access_expires_at' => $data['access_expires_at'] ?? null,
            'requires_approval' => $request->boolean('requires_approval'),
        ];

        if (isset($data['status'])) {
            $attributes['status'] = $data['status'];
        }

        if ($replaced) {
            $file = $request->file('file');
            $attributes += [
                'file_path' => $file->store('documents', self::DISK),
                'file_size' => $file->getSize(),
                'mime_type' => $file->getMimeType() ?? '',
                'signed_file_path' => null,
                'version' => $document->version + 1,
            ];
        }

        $approverIds = $request->boolean('requires_approval') ? array_values($data['pending_approver_ids'] ?? []) : [];
        $positionId = isset($data['position_id']) ? (int) $data['position_id'] : null;

        if ($approverIds !== []) {
            $attributes['requires_approval'] = true;
            $attributes['approval_started_at'] = $document->approval_started_at ?? now();
            $attributes['approval_completed_at'] = null;
            if (! in_array($attributes['status'] ?? $document->status, ['APPROVED', 'REJECTED', 'ARCHIVED'], true)) {
                $attributes['status'] = 'REVIEW';
            }
        } else {
            $attributes['requires_approval'] = false;
        }

        $notifyIds = DB::transaction(function () use ($document, $attributes, $replaced, $data, $approverIds, $positionId) {
            $visibleIds = array_values(array_unique(array_map('intval', $data['visible_to_ids'] ?? [])));

            if ($positionId) {
                $position = Position::with('users:id')->findOrFail($positionId);
                if (($attributes['department_id'] ?? null) === null) {
                    $attributes['department_id'] = $position->department_id;
                }
                $visibleIds = array_values(array_unique(array_merge($visibleIds, $position->userIds())));
                $document->positions()->sync([$positionId]);
            } else {
                $document->positions()->sync([]);
            }

            $document->update($attributes);

            if ($replaced) {
                $document->signatures()->delete();
            }

            $document->visibleTo()->sync($visibleIds);

            if ($approverIds !== []) {
                $document->syncApprovalChain($approverIds);

                return [(int) $approverIds[0]];
            }

            $document->pendingApprovers()->detach();

            return [];
        });

        if ($notifyIds !== []) {
            $this->notifyApprovers($document, $notifyIds);
        }
        ActivityLog::record($request->user(), 'DOCUMENT_UPDATE', $document->title);

        return redirect()->route('documents.show', $document)->with(
            'success',
            $replaced ? 'New version uploaded. Previous signatures were cleared.' : 'Document updated.'
        );
    }

    public function destroy(Request $request, Document $document): RedirectResponse
    {
        Gate::authorize('delete', $document);

        $paths = collect([$document->file_path, $document->signed_file_path])
            ->merge($document->signatures->map(fn ($s) => data_get($s->signature_data, 'file_path')))
            ->filter()
            ->unique()
            ->all();

        ActivityLog::record($request->user(), 'DOCUMENT_DELETE', $document->title);
        $document->delete();
        Storage::disk(self::DISK)->delete($paths);

        return redirect()->route('documents.index')->with('success', 'Document deleted.');
    }

    public function file(Request $request, Document $document): StreamedResponse
    {
        Gate::authorize('view', $document);

        $path = $this->resolvePath($request, $document);

        return Storage::disk(self::DISK)->response($path, $this->fileName($document, $path), [
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function download(Request $request, Document $document): StreamedResponse
    {
        Gate::authorize('view', $document);

        $path = $this->resolvePath($request, $document);
        $this->logAccess($request, $document, 'DOWNLOAD');

        return Storage::disk(self::DISK)->download($path, $this->fileName($document, $path));
    }

    public function approve(Request $request, Document $document): RedirectResponse
    {
        Gate::authorize('approve', $document);

        $user = $request->user();
        $nextApproverId = null;

        DB::transaction(function () use ($document, $user, &$nextApproverId) {
            $document->pendingApprovers()->updateExistingPivot($user->id, [
                'status' => 'approved',
                'acted_at' => now(),
            ]);
            $document->approvedBy()->syncWithoutDetaching([$user->id => ['approved_at' => now()]]);

            $next = $document->pendingApprovers()
                ->wherePivot('status', 'waiting')
                ->orderByPivot('sort_order')
                ->first();

            if ($next) {
                $document->pendingApprovers()->updateExistingPivot($next->id, [
                    'status' => 'current',
                ]);
                $nextApproverId = $next->id;
            } else {
                $document->update([
                    'status' => 'APPROVED',
                    'approval_completed_at' => now(),
                ]);
            }
        });

        if ($nextApproverId) {
            $this->notifyApprovers($document, [$nextApproverId]);
        }

        $this->notifyUploader($document, $user, 'DOCUMENT_UPDATE', 'Document approved', "{$user->name} approved {$document->title}");
        ActivityLog::record($user, 'DOCUMENT_APPROVE', $document->title);

        return back()->with('success', 'Document approved.');
    }

    public function reject(Request $request, Document $document): RedirectResponse
    {
        Gate::authorize('approve', $document);

        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        $user = $request->user();

        DB::transaction(function () use ($document, $user, $data) {
            $document->pendingApprovers()->updateExistingPivot($user->id, [
                'status' => 'rejected',
                'acted_at' => now(),
            ]);

            $waitingIds = $document->pendingApprovers()
                ->wherePivot('status', 'waiting')
                ->pluck('users.id');

            foreach ($waitingIds as $waitingId) {
                $document->pendingApprovers()->updateExistingPivot($waitingId, [
                    'status' => 'skipped',
                    'acted_at' => now(),
                ]);
            }

            $document->update([
                'status' => 'REJECTED',
                'approval_completed_at' => now(),
            ]);
            $document->annotations()->create([
                'user_id' => $user->id,
                'annotation_type' => 'COMMENT',
                'content' => 'Rejected: '.$data['reason'],
                'color' => '#DC2626',
            ]);
        });

        $this->notifyUploader($document, $user, 'DOCUMENT_UPDATE', 'Document rejected', "{$user->name} rejected {$document->title}: {$data['reason']}");
        ActivityLog::record($user, 'DOCUMENT_REJECT', $document->title);

        return back()->with('success', 'Document rejected.');
    }

    public function storeAnnotation(Request $request, Document $document): RedirectResponse
    {
        Gate::authorize('view', $document);

        $data = $request->validate([
            'annotation_type' => ['required', Rule::in(['COMMENT', 'HIGHLIGHT', 'NOTE'])],
            'page_number' => ['required', 'integer', 'min:1'],
            'coordinates' => ['nullable', 'array'],
            'coordinates.x' => ['required_with:coordinates', 'numeric', 'between:0,1'],
            'coordinates.y' => ['required_with:coordinates', 'numeric', 'between:0,1'],
            'coordinates.w' => ['nullable', 'numeric', 'between:0,1'],
            'coordinates.h' => ['nullable', 'numeric', 'between:0,1'],
            'coordinates.size' => ['nullable', 'numeric', 'between:0,1'],
            'coordinates.bold' => ['nullable', 'boolean'],
            'coordinates.italic' => ['nullable', 'boolean'],
            'content' => [Rule::requiredIf($request->input('annotation_type') !== 'HIGHLIGHT'), 'nullable', 'string', 'max:5000'],
            'color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ]);

        $user = $request->user();

        $document->annotations()->create([
            'user_id' => $user->id,
            'annotation_type' => $data['annotation_type'],
            'page_number' => $data['page_number'],
            'coordinates' => isset($data['coordinates']) ? $this->annotationCoordinates($data['coordinates']) : null,
            'content' => $data['content'] ?? '',
            'color' => $data['color'] ?? ($data['annotation_type'] === 'NOTE' ? '#0F172A' : '#FDE047'),
        ]);

        if ($data['annotation_type'] !== 'NOTE') {
            $this->notifyUploader($document, $user, 'COMMENT', 'New comment', "{$user->name} commented on {$document->title}");
        }

        return back();
    }

    public function resolveAnnotation(Request $request, DocumentAnnotation $annotation): RedirectResponse
    {
        Gate::authorize('view', $annotation->document);

        $resolved = ! $annotation->resolved;

        $annotation->update([
            'resolved' => $resolved,
            'resolved_by_id' => $resolved ? $request->user()->id : null,
            'resolved_at' => $resolved ? now() : null,
        ]);

        return back();
    }

    public function updateAnnotation(Request $request, DocumentAnnotation $annotation): RedirectResponse
    {
        abort_unless($annotation->user_id === $request->user()->id || $request->user()->isAdmin(), 403);
        Gate::authorize('view', $annotation->document);

        $data = $request->validate([
            'content' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'color' => ['sometimes', 'nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'coordinates' => ['sometimes', 'nullable', 'array'],
            'coordinates.x' => ['required_with:coordinates', 'numeric', 'between:0,1'],
            'coordinates.y' => ['required_with:coordinates', 'numeric', 'between:0,1'],
            'coordinates.w' => ['nullable', 'numeric', 'between:0,1'],
            'coordinates.h' => ['nullable', 'numeric', 'between:0,1'],
            'coordinates.size' => ['nullable', 'numeric', 'between:0,1'],
            'coordinates.bold' => ['nullable', 'boolean'],
            'coordinates.italic' => ['nullable', 'boolean'],
        ]);

        $attributes = Arr::only($data, ['content', 'color']);
        if (array_key_exists('coordinates', $data)) {
            $attributes['coordinates'] = $data['coordinates']
                ? $this->annotationCoordinates($data['coordinates'])
                : null;
        }

        $annotation->update($attributes);

        return back();
    }

    public function destroyAnnotation(Request $request, DocumentAnnotation $annotation): RedirectResponse
    {
        abort_unless($annotation->user_id === $request->user()->id || $request->user()->isAdmin(), 403);

        $annotation->delete();

        return back();
    }

    /**
     * @param  array<string, mixed>  $coordinates
     * @return array<string, mixed>
     */
    private function annotationCoordinates(array $coordinates): array
    {
        $coords = Arr::only($coordinates, ['x', 'y', 'w', 'h', 'size', 'bold', 'italic']);

        if (array_key_exists('bold', $coords)) {
            $coords['bold'] = (bool) $coords['bold'];
        }
        if (array_key_exists('italic', $coords)) {
            $coords['italic'] = (bool) $coords['italic'];
        }
        if (array_key_exists('size', $coords)) {
            $coords['size'] = (float) $coords['size'];
        }

        return $coords;
    }

    public function flatten(Request $request, Document $document): RedirectResponse
    {
        Gate::authorize('annotate', $document);

        $request->validate([
            'marked_pdf' => ['required', 'file', 'mimes:pdf', 'max:102400'],
        ]);

        $user = $request->user();
        $path = $request->file('marked_pdf')->storeAs(
            'documents/signed',
            $document->id.'-marks-'.now()->format('YmdHis').'-'.$user->id.'.pdf',
            self::DISK
        );

        DB::transaction(function () use ($document, $path) {
            $document->update(['signed_file_path' => $path]);
            $document->annotations()->where('annotation_type', 'NOTE')->delete();
        });

        ActivityLog::record($user, 'DOCUMENT_UPDATE', $document->title, ['action' => 'flatten_marks']);

        return back()->with('success', 'Text saved to the document.');
    }

    public function sign(Request $request, Document $document): RedirectResponse
    {
        Gate::authorize('sign', $document);

        $data = $request->validate([
            'signed_pdf' => ['required', 'file', 'mimes:pdf', 'max:102400'],
            'signature_image' => ['required', 'string', 'starts_with:data:image/png;base64,', 'max:3000000'],
            'placements' => ['required', 'json'],
            'save_signature' => ['boolean'],
        ]);

        $placements = json_decode($data['placements'], true);

        Validator::make(['placements' => $placements], [
            'placements' => ['required', 'array', 'min:1', 'max:50'],
            'placements.*.page' => ['required', 'integer', 'min:1'],
            'placements.*.x' => ['required', 'numeric', 'between:0,1'],
            'placements.*.y' => ['required', 'numeric', 'between:0,1'],
            'placements.*.w' => ['required', 'numeric', 'between:0,1'],
            'placements.*.h' => ['required', 'numeric', 'between:0,1'],
        ])->validate();

        $user = $request->user();
        $path = $request->file('signed_pdf')->storeAs(
            'documents/signed',
            $document->id.'-'.now()->format('YmdHis').'-'.$user->id.'.pdf',
            self::DISK
        );
        $hash = hash_file('sha256', Storage::disk(self::DISK)->path($path));

        $previousPath = $document->signed_file_path;

        DB::transaction(function () use ($document, $user, $request, $data, $placements, $path, $hash, $previousPath) {
            $document->update(['signed_file_path' => $path]);

            DocumentSignature::updateOrCreate(
                ['document_id' => $document->id, 'user_id' => $user->id, 'signature_type' => 'INTERNAL'],
                [
                    'signature_type' => 'INTERNAL',
                    'signature_data' => [
                        'image' => $data['signature_image'],
                        'placements' => $placements,
                        'file_path' => $path,
                        'previous_file_path' => $previousPath,
                        'sha256' => $hash,
                    ],
                    'signed_at' => now(),
                    'verified' => true,
                    'verification_certificate' => $hash,
                    'ip_address' => $request->ip(),
                    'user_agent' => (string) $request->userAgent(),
                ]
            );

            // Signatures are admin-managed; ignore client attempts to overwrite during signing.
        });

        $this->notifyUploader($document, $user, 'DOCUMENT_UPDATE', 'Document signed', "{$user->name} signed {$document->title}");
        ActivityLog::record($user, 'DOCUMENT_SIGN', $document->title, ['sha256' => $hash]);

        return back()->with('success', 'Document signed.');
    }

    public function stamp(Request $request, Document $document): RedirectResponse
    {
        Gate::authorize('sign', $document);

        $data = $request->validate([
            'stamped_pdf' => ['required', 'file', 'mimes:pdf', 'max:102400'],
            'stamp_image' => ['required', 'string', 'starts_with:data:image/png;base64,', 'max:3000000'],
            'placements' => ['required', 'json'],
        ]);

        $placements = json_decode($data['placements'], true);

        Validator::make(['placements' => $placements], [
            'placements' => ['required', 'array', 'min:1', 'max:50'],
            'placements.*.page' => ['required', 'integer', 'min:1'],
            'placements.*.x' => ['required', 'numeric', 'between:0,1'],
            'placements.*.y' => ['required', 'numeric', 'between:0,1'],
            'placements.*.w' => ['required', 'numeric', 'between:0,1'],
            'placements.*.h' => ['required', 'numeric', 'between:0,1'],
        ])->validate();

        $user = $request->user();
        $path = $request->file('stamped_pdf')->storeAs(
            'documents/signed',
            $document->id.'-stamp-'.now()->format('YmdHis').'-'.$user->id.'.pdf',
            self::DISK
        );
        $hash = hash_file('sha256', Storage::disk(self::DISK)->path($path));
        $previousPath = $document->signed_file_path;

        DB::transaction(function () use ($document, $user, $request, $data, $placements, $path, $hash, $previousPath) {
            $document->update(['signed_file_path' => $path]);

            DocumentSignature::updateOrCreate(
                ['document_id' => $document->id, 'user_id' => $user->id, 'signature_type' => 'STAMP'],
                [
                    'signature_type' => 'STAMP',
                    'signature_data' => [
                        'image' => $data['stamp_image'],
                        'placements' => $placements,
                        'file_path' => $path,
                        'previous_file_path' => $previousPath,
                        'sha256' => $hash,
                    ],
                    'signed_at' => now(),
                    'verified' => true,
                    'verification_certificate' => $hash,
                    'ip_address' => $request->ip(),
                    'user_agent' => (string) $request->userAgent(),
                ]
            );
        });

        $this->notifyUploader($document, $user, 'DOCUMENT_UPDATE', 'Document stamped', "{$user->name} stamped {$document->title}");
        ActivityLog::record($user, 'DOCUMENT_UPDATE', $document->title, ['action' => 'stamp', 'sha256' => $hash]);

        return back()->with('success', 'Stamp applied to the document.');
    }

    public function destroySignature(Request $request, DocumentSignature $signature): RedirectResponse
    {
        $document = $signature->document;
        Gate::authorize('view', $document);

        $user = $request->user();
        abort_unless(
            $signature->user_id === $user->id || $user->isAdmin(),
            403,
            'You can only remove your own signature or stamp.'
        );

        $this->healSignedFilePath($document);
        $document->refresh();

        $data = $signature->signature_data ?? [];
        $markPath = data_get($data, 'file_path');
        $previousPath = data_get($data, 'previous_file_path');
        $label = $signature->signature_type === 'STAMP' ? 'stamp' : 'signature';
        $signatureId = $signature->id;
        $isCurrent = filled($markPath) && $document->signed_file_path === $markPath;

        if ($isCurrent) {
            $restorePath = $this->resolvePreviousSignedPath($document, $signature, is_string($previousPath) ? $previousPath : null);

            DB::transaction(function () use ($document, $signature, $restorePath) {
                $document->update([
                    'signed_file_path' => $restorePath,
                ]);
                $signature->delete();
            });

            if (is_string($markPath) && $markPath !== '' && $markPath !== $document->file_path && $markPath !== $restorePath) {
                Storage::disk(self::DISK)->delete($markPath);
            }

            ActivityLog::record($user, 'DOCUMENT_UPDATE', $document->title, [
                'action' => 'remove_'.$label,
                'signature_id' => $signatureId,
            ]);

            return back()->with('success', ucfirst($label).' removed from the document.');
        }

        return back()->with(
            'error',
            'This '.$label.' is no longer the latest version of the file, so it cannot be removed without undoing later marks first.'
        );
    }

    public function updatePages(Request $request, Document $document): RedirectResponse
    {
        Gate::authorize('update', $document);

        $request->validate([
            'pages_pdf' => ['required', 'file', 'mimes:pdf', 'max:102400'],
        ]);

        $user = $request->user();
        $path = $request->file('pages_pdf')->storeAs(
            'documents/signed',
            $document->id.'-pages-'.now()->format('YmdHis').'-'.$user->id.'.pdf',
            self::DISK
        );

        DB::transaction(function () use ($document, $path) {
            $document->update(['signed_file_path' => $path]);
            $document->annotations()->delete();
            $document->signatures()->delete();
        });

        ActivityLog::record($user, 'DOCUMENT_UPDATE', $document->title, ['action' => 'pages_edited']);

        return back()->with('success', 'Page changes saved. Comments and signatures were cleared.');
    }

    private function assertDepartmentAccess(Request $request, int $departmentId): void
    {
        $user = $request->user();
        abort_unless(
            $user->canPerm('documents.view_all') || $user->belongsToDepartment($departmentId),
            403,
            'You do not belong to that department.'
        );
    }

    private function validateDocument(Request $request, bool $creating): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:5000'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'category_id' => ['nullable', 'exists:document_categories,id'],
            'file' => [$creating ? 'required' : 'nullable', 'file', 'mimes:'.self::ALLOWED_MIMES, 'max:102400'],
            'status' => ['sometimes', Rule::in(['DRAFT', 'REVIEW', 'APPROVED', 'REJECTED'])],
            'requires_approval' => ['boolean'],
            'access_expires_at' => ['nullable', 'date'],
            'visible_to_ids' => ['array'],
            'visible_to_ids.*' => ['integer', 'exists:users,id'],
            'position_id' => ['nullable', 'integer', 'exists:positions,id'],
            'pending_approver_ids' => ['array', Rule::requiredIf($request->boolean('requires_approval'))],
            'pending_approver_ids.*' => ['integer', 'exists:users,id'],
        ], [
            'pending_approver_ids.required' => 'Choose at least one approver.',
        ]);
    }

    private function formOptions(): array
    {
        $user = request()->user();
        $departmentIds = $user->canPerm('documents.view_all') ? null : $user->departmentIds();

        $positionsQuery = Position::query()
            ->where('is_active', true)
            ->with('department:id,name')
            ->orderBy('name');

        if ($departmentIds !== null) {
            $positionsQuery->whereIn('department_id', $departmentIds);
        }

        return [
            'categories' => DocumentCategory::flatOptions($departmentIds, $user)->map(fn (DocumentCategory $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'label' => $c->getAttribute('label'),
                'parent_id' => $c->parent_id,
                'department_ids' => $c->departmentIds(),
            ]),
            'departments' => $user->canPerm('documents.view_all')
                ? Department::where('is_active', true)->orderBy('name')->get(['id', 'name', 'code'])
                : $user->departments()->where('is_active', true)->orderBy('name')->get(['departments.id', 'departments.name', 'departments.code']),
            'positions' => $positionsQuery->get(['id', 'name', 'code', 'department_id'])->map(fn (Position $position) => [
                'id' => $position->id,
                'name' => $position->name,
                'code' => $position->code,
                'department_id' => $position->department_id,
                'department_name' => $position->department?->name,
            ]),
            'users' => User::where('is_active', true)->orderBy('first_name')
                ->get(['id', 'first_name', 'last_name', 'email', 'is_approver']),
        ];
    }

    /**
     * If the working signed PDF was cleared but signature/stamp records still point at
     * a stored file, restore the newest existing path so marks remain visible.
     */
    private function healSignedFilePath(Document $document): void
    {
        if (filled($document->signed_file_path) && Storage::disk(self::DISK)->exists($document->signed_file_path)) {
            return;
        }

        $signatures = $document->relationLoaded('signatures')
            ? $document->signatures
            : $document->signatures()->latest('signed_at')->get();

        $candidate = $signatures
            ->sortByDesc('signed_at')
            ->map(fn (DocumentSignature $signature) => data_get($signature->signature_data, 'file_path'))
            ->first(fn ($path) => is_string($path) && $path !== '' && Storage::disk(self::DISK)->exists($path));

        if (! is_string($candidate) || $candidate === '') {
            return;
        }

        $document->update(['signed_file_path' => $candidate]);
    }

    private function resolvePreviousSignedPath(Document $document, DocumentSignature $removing, ?string $previousPath): ?string
    {
        if (filled($previousPath) && Storage::disk(self::DISK)->exists($previousPath)) {
            return $previousPath;
        }

        $fallback = $document->signatures()
            ->where('id', '!=', $removing->id)
            ->latest('signed_at')
            ->get()
            ->map(fn (DocumentSignature $signature) => data_get($signature->signature_data, 'file_path'))
            ->first(fn ($path) => is_string($path) && $path !== '' && Storage::disk(self::DISK)->exists($path));

        return is_string($fallback) && $fallback !== '' ? $fallback : null;
    }

    private function resolvePath(Request $request, Document $document): string
    {
        if ($request->query('version') !== 'original') {
            $this->healSignedFilePath($document);
            $document->refresh();
        }

        $path = $request->query('version') === 'original' ? $document->file_path : $document->currentFilePath();

        abort_unless($path && Storage::disk(self::DISK)->exists($path), 404);

        return $path;
    }

    private function fileName(Document $document, string $path): string
    {
        $base = Str::slug($document->title) ?: 'document';
        $suffix = $path === $document->signed_file_path ? '-signed' : '';

        return $base.$suffix.'.'.pathinfo($path, PATHINFO_EXTENSION);
    }

    private function logAccess(Request $request, Document $document, string $action): void
    {
        $userId = $request->user()->id;
        $recent = DocumentAccessLog::query()
            ->where('document_id', $document->id)
            ->where('user_id', $userId)
            ->where('action', $action)
            ->where('accessed_at', '>=', now()->subMinutes(2))
            ->exists();

        if ($recent) {
            return;
        }

        DocumentAccessLog::create([
            'document_id' => $document->id,
            'user_id' => $userId,
            'action' => $action,
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
            'accessed_at' => now(),
        ]);
    }

    private function notifyApprovers(Document $document, array $userIds): void
    {
        foreach ($userIds as $userId) {
            AppNotification::create([
                'user_id' => $userId,
                'notification_type' => 'APPROVAL_REQUEST',
                'title' => 'Approval requested',
                'message' => "Please review and approve {$document->title}",
                'related_type' => Document::class,
                'related_id' => $document->id,
            ]);
        }
    }

    private function notifyUploader(Document $document, User $actor, string $type, string $title, string $message): void
    {
        if (! $document->uploaded_by_id || $document->uploaded_by_id === $actor->id) {
            return;
        }

        AppNotification::create([
            'user_id' => $document->uploaded_by_id,
            'notification_type' => $type,
            'title' => $title,
            'message' => $message,
            'related_type' => Document::class,
            'related_id' => $document->id,
        ]);
    }
}
