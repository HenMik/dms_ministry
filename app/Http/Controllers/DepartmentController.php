<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Department;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class DepartmentController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()->canPerm('departments.manage'), 403);

        return Inertia::render('Departments/Index', [
            'departments' => Department::with('parent:id,name')
                ->withCount('users', 'documents')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
            'organogram' => Department::organogram(),
            'parents' => Department::query()->orderBy('name')->get(['id', 'name']),
            'users' => User::where('is_active', true)
                ->orderBy('last_name')
                ->get(['id', 'first_name', 'last_name', 'email']),
        ]);
    }

    public function show(Request $request, Department $department): Response
    {
        abort_unless($request->user()->canPerm('departments.manage'), 403);

        $department->load([
            'parent:id,name,code',
            'children' => fn ($query) => $query->withCount('users', 'documents')->orderBy('sort_order')->orderBy('name'),
            'users' => fn ($query) => $query->orderBy('last_name')->orderBy('first_name'),
            'positions' => fn ($query) => $query->with(['users:id,first_name,last_name,email'])->withCount('users')->orderBy('name'),
        ])->loadCount(['users', 'documents', 'categories']);

        return Inertia::render('Departments/Show', [
            'department' => [
                'id' => $department->id,
                'name' => $department->name,
                'code' => $department->code,
                'description' => $department->description,
                'is_active' => $department->is_active,
                'sort_order' => $department->sort_order,
                'parent' => $department->parent,
                'users_count' => $department->users_count,
                'documents_count' => $department->documents_count,
                'folders_count' => $department->categories_count,
                'children' => $department->children->map(fn (Department $child) => [
                    'id' => $child->id,
                    'name' => $child->name,
                    'code' => $child->code,
                    'is_active' => $child->is_active,
                    'users_count' => $child->users_count,
                    'documents_count' => $child->documents_count,
                ]),
                'members' => $department->users->map(fn (User $user) => [
                    'id' => $user->id,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'email' => $user->email,
                    'is_primary' => (bool) $user->pivot->is_primary,
                ]),
                'positions' => $department->positions->map(fn ($position) => [
                    'id' => $position->id,
                    'name' => $position->name,
                    'code' => $position->code,
                    'description' => $position->description,
                    'is_active' => $position->is_active,
                    'users_count' => $position->users_count,
                    'user_ids' => $position->users->pluck('id')->values()->all(),
                    'users' => $position->users->map(fn (User $holder) => [
                        'id' => $holder->id,
                        'first_name' => $holder->first_name,
                        'last_name' => $holder->last_name,
                        'email' => $holder->email,
                    ]),
                ]),
            ],
        ]);
    }

    public function edit(Request $request, Department $department): Response
    {
        abort_unless($request->user()->canPerm('departments.manage'), 403);

        $department->load(['users:id', 'reportViewers:id']);

        $blockedParentIds = array_merge([$department->id], $department->descendantIds());

        return Inertia::render('Departments/Edit', [
            'department' => [
                'id' => $department->id,
                'name' => $department->name,
                'code' => $department->code,
                'parent_id' => $department->parent_id,
                'description' => $department->description,
                'is_active' => $department->is_active,
                'sort_order' => $department->sort_order,
                'user_ids' => $department->users->pluck('id')->values()->all(),
                'primary_user_id' => $department->users->firstWhere('pivot.is_primary', true)?->id,
                'report_viewer_ids' => $department->reportViewers->pluck('id')->values()->all(),
            ],
            'parents' => Department::query()
                ->whereNotIn('id', $blockedParentIds)
                ->orderBy('name')
                ->get(['id', 'name']),
            'users' => User::where('is_active', true)
                ->orderBy('last_name')
                ->get(['id', 'first_name', 'last_name', 'email']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->canPerm('departments.manage'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:50', 'unique:departments,code'],
            'parent_id' => ['nullable', 'exists:departments,id'],
            'description' => ['nullable', 'string'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'user_ids' => ['array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'primary_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'report_viewer_ids' => ['array'],
            'report_viewer_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $department = Department::create([
            'name' => $data['name'],
            'code' => $data['code'] ?: Str::upper(Str::slug($data['name'], '_')),
            'parent_id' => $data['parent_id'] ?? null,
            'description' => $data['description'] ?? '',
            'is_active' => $request->boolean('is_active', true),
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        $this->syncMembers($department, $data['user_ids'] ?? [], isset($data['primary_user_id']) ? (int) $data['primary_user_id'] : null);
        $department->reportViewers()->sync($data['report_viewer_ids'] ?? []);
        ActivityLog::record($request->user(), 'DEPARTMENT_CREATE', $department->name);

        return redirect()
            ->route('departments.show', $department)
            ->with('success', 'Department created.');
    }

    public function update(Request $request, Department $department): RedirectResponse
    {
        abort_unless($request->user()->canPerm('departments.manage'), 403);

        $blockedParents = array_merge([$department->id], $department->descendantIds());

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:50', Rule::unique('departments', 'code')->ignore($department->id)],
            'parent_id' => ['nullable', 'exists:departments,id', Rule::notIn($blockedParents)],
            'description' => ['nullable', 'string'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'user_ids' => ['array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'primary_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'report_viewer_ids' => ['array'],
            'report_viewer_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $department->update([
            'name' => $data['name'],
            'code' => $data['code'],
            'parent_id' => $data['parent_id'] ?? null,
            'description' => $data['description'] ?? '',
            'is_active' => $request->boolean('is_active', true),
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        if ($request->has('user_ids')) {
            $this->syncMembers(
                $department,
                $data['user_ids'] ?? [],
                isset($data['primary_user_id']) ? (int) $data['primary_user_id'] : null,
            );
        }

        if ($request->has('report_viewer_ids')) {
            $department->reportViewers()->sync($data['report_viewer_ids'] ?? []);
        }

        ActivityLog::record($request->user(), 'DEPARTMENT_UPDATE', $department->name);

        return redirect()
            ->route('departments.show', $department)
            ->with('success', 'Department updated.');
    }

    public function destroy(Request $request, Department $department): RedirectResponse
    {
        abort_unless($request->user()->canPerm('departments.manage'), 403);

        if ($department->documents()->exists() || $department->children()->exists()) {
            return back()->with('error', 'Remove child departments and documents before deleting.');
        }

        $name = $department->name;
        $department->delete();
        ActivityLog::record($request->user(), 'DEPARTMENT_DELETE', $name);

        return redirect()
            ->route('departments.index')
            ->with('success', 'Department deleted.');
    }

    /**
     * @param  list<int>  $userIds
     */
    private function syncMembers(Department $department, array $userIds, ?int $primaryUserId): void
    {
        $sync = [];

        foreach ($userIds as $userId) {
            $sync[$userId] = ['is_primary' => $primaryUserId !== null && (int) $userId === $primaryUserId];
        }

        if ($primaryUserId && ! isset($sync[$primaryUserId])) {
            $sync[$primaryUserId] = ['is_primary' => true];
        }

        $department->users()->sync($sync);
    }
}
