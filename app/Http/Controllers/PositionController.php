<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Department;
use App\Models\Position;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PositionController extends Controller
{
    public function store(Request $request, Department $department): RedirectResponse
    {
        abort_unless($request->user()->canPerm('departments.manage'), 403);

        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:150',
                Rule::unique('positions', 'name')->where(fn ($q) => $q->where('department_id', $department->id)),
            ],
            'code' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'is_active' => ['boolean'],
            'user_ids' => ['array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $position = $department->positions()->create([
            'name' => $data['name'],
            'code' => $data['code'] ?? null,
            'description' => $data['description'] ?? '',
            'is_active' => $request->boolean('is_active', true),
        ]);

        $position->users()->sync($this->filterUsersForDepartment($department, $data['user_ids'] ?? []));
        ActivityLog::record($request->user(), 'POSITION_CREATE', $position->name);

        return back()->with('success', 'Position created.');
    }

    public function update(Request $request, Position $position): RedirectResponse
    {
        abort_unless($request->user()->canPerm('departments.manage'), 403);

        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:150',
                Rule::unique('positions', 'name')
                    ->where(fn ($q) => $q->where('department_id', $position->department_id))
                    ->ignore($position->id),
            ],
            'code' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'is_active' => ['boolean'],
            'user_ids' => ['array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $position->update([
            'name' => $data['name'],
            'code' => $data['code'] ?? null,
            'description' => $data['description'] ?? '',
            'is_active' => $request->boolean('is_active', true),
        ]);

        if ($request->has('user_ids')) {
            $position->loadMissing('department');
            $position->users()->sync(
                $this->filterUsersForDepartment($position->department, $data['user_ids'] ?? [])
            );
        }

        ActivityLog::record($request->user(), 'POSITION_UPDATE', $position->name);

        return back()->with('success', 'Position updated.');
    }

    public function destroy(Request $request, Position $position): RedirectResponse
    {
        abort_unless($request->user()->canPerm('departments.manage'), 403);

        $name = $position->name;
        $position->delete();
        ActivityLog::record($request->user(), 'POSITION_DELETE', $name);

        return back()->with('success', 'Position deleted.');
    }

    /**
     * @param  list<int>  $userIds
     * @return list<int>
     */
    private function filterUsersForDepartment(Department $department, array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        return User::query()
            ->whereIn('id', $userIds)
            ->whereHas('departments', fn ($q) => $q->whereKey($department->id))
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }
}
