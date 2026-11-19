<?php

namespace App\Http\Controllers;

use App\Models\DocumentCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DocumentCategoryController extends Controller
{
    public function index(Request $request): RedirectResponse
    {
        abort_unless($request->user()->canPerm('folders.manage'), 403);

        return redirect()->route('documents.index');
    }

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        abort_unless($request->user()->canPerm('folders.manage'), 403);

        $parentId = $request->input('parent_id');

        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('document_categories', 'name')->where(
                    fn ($q) => $parentId
                        ? $q->where('parent_id', $parentId)
                        : $q->whereNull('parent_id')
                ),
            ],
            'description' => ['nullable', 'string'],
            'parent_id' => ['nullable', 'exists:document_categories,id'],
            'department_ids' => ['array'],
            'department_ids.*' => ['integer', 'exists:departments,id'],
            'visible_to_ids' => ['array'],
            'visible_to_ids.*' => ['integer', 'exists:users,id'],
        ]);

        if ($request->exists('department_ids')) {
            $departmentIds = array_values(array_unique(array_map('intval', $data['department_ids'] ?? [])));
        } elseif ($parentId) {
            $parent = DocumentCategory::with('departments:id')->find($parentId);
            $departmentIds = $parent?->departmentIds() ?? [];
        } else {
            $departmentIds = [];
        }

        foreach ($departmentIds as $departmentId) {
            if (! $request->user()->canPerm('documents.view_all') && ! $request->user()->belongsToDepartment($departmentId)) {
                abort(403);
            }
        }

        $folder = DocumentCategory::create([
            'name' => $data['name'],
            'description' => $data['description'] ?? '',
            'parent_id' => $data['parent_id'] ?? null,
        ]);

        $folder->syncDepartments($departmentIds);
        $folder->visibleTo()->sync($data['visible_to_ids'] ?? []);

        if ($request->wantsJson() || $request->boolean('json')) {
            $options = DocumentCategory::flatOptions(
                $request->user()->canPerm('documents.view_all') ? null : $request->user()->departmentIds(),
                $request->user()
            );
            $option = $options->firstWhere('id', $folder->id);

            return response()->json([
                'folder' => [
                    'id' => $folder->id,
                    'name' => $folder->name,
                    'parent_id' => $folder->parent_id,
                    'department_ids' => $folder->departmentIds(),
                    'label' => $option?->getAttribute('label') ?? $folder->name,
                ],
                'categories' => $options->map(fn (DocumentCategory $c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'label' => $c->getAttribute('label'),
                    'parent_id' => $c->parent_id,
                    'department_ids' => $c->departmentIds(),
                ])->values(),
            ]);
        }

        if ($request->boolean('browse')) {
            return redirect()
                ->route('documents.index', ['folder' => $folder->id])
                ->with('success', 'Folder created.');
        }

        return back()->with('success', 'Folder created.');
    }

    public function update(Request $request, DocumentCategory $category): RedirectResponse
    {
        abort_unless($request->user()->canPerm('folders.manage'), 403);

        $parentId = $request->input('parent_id', $category->parent_id);

        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('document_categories', 'name')
                    ->where(
                        fn ($q) => $parentId
                            ? $q->where('parent_id', $parentId)
                            : $q->whereNull('parent_id')
                    )
                    ->ignore($category->id),
            ],
            'description' => ['nullable', 'string'],
            'parent_id' => [
                'nullable',
                'exists:document_categories,id',
                Rule::notIn([$category->id]),
            ],
            'department_ids' => ['array'],
            'department_ids.*' => ['integer', 'exists:departments,id'],
            'visible_to_ids' => ['array'],
            'visible_to_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $category->update([
            'name' => $data['name'],
            'description' => $data['description'] ?? '',
            'parent_id' => $data['parent_id'] ?? null,
        ]);

        if ($request->has('department_ids')) {
            $departmentIds = array_values(array_unique(array_map('intval', $data['department_ids'] ?? [])));

            foreach ($departmentIds as $departmentId) {
                if (! $request->user()->canPerm('documents.view_all') && ! $request->user()->belongsToDepartment($departmentId)) {
                    abort(403);
                }
            }

            $category->syncDepartments($departmentIds);
        }

        if ($request->has('visible_to_ids')) {
            $category->visibleTo()->sync($data['visible_to_ids'] ?? []);
        }

        return back()->with('success', 'Folder updated.');
    }

    public function destroy(Request $request, DocumentCategory $category): RedirectResponse
    {
        abort_unless($request->user()->canPerm('folders.manage'), 403);

        $parentId = $category->parent_id;
        $category->delete();

        if ($request->boolean('browse')) {
            return redirect()
                ->route('documents.index', array_filter(['folder' => $parentId]))
                ->with('success', 'Folder deleted.');
        }

        return back()->with('success', 'Folder deleted.');
    }
}
