<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Role;
use App\Support\PermissionCatalog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RoleController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()->canPerm('roles.manage'), 403);

        return Inertia::render('Roles/Index', [
            'roles' => Role::withCount('users')->orderBy('name')->get()->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'display_name' => $role->display_name,
                'description' => $role->description,
                'permissions' => $role->permissionMap(),
                'users_count' => $role->users_count,
                'is_admin_role' => $role->isAdminRole(),
            ]),
            'permissionGroups' => PermissionCatalog::grouped(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->canPerm('roles.manage'), 403);

        $data = $this->validated($request);
        $name = Str::slug($data['name'] ?: $data['display_name'], '_');

        Role::create([
            'name' => $name,
            'display_name' => $data['display_name'],
            'description' => $data['description'] ?? '',
            'permissions' => $this->normalizePermissions($data['permissions'] ?? []),
        ]);

        ActivityLog::record($request->user(), 'ROLE_CREATE', $data['display_name']);

        return back()->with('success', 'Role created.');
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        abort_unless($request->user()->canPerm('roles.manage'), 403);

        $data = $this->validated($request, $role);

        $attributes = [
            'display_name' => $data['display_name'],
            'description' => $data['description'] ?? '',
            'permissions' => $role->isAdminRole()
                ? ['*' => true]
                : $this->normalizePermissions($data['permissions'] ?? []),
        ];

        if (! $role->isAdminRole() && filled($data['name'] ?? null)) {
            $attributes['name'] = Str::slug($data['name'], '_');
        }

        $role->update($attributes);
        ActivityLog::record($request->user(), 'ROLE_UPDATE', $role->display_name);

        return back()->with('success', 'Role updated.');
    }

    public function destroy(Request $request, Role $role): RedirectResponse
    {
        abort_unless($request->user()->canPerm('roles.manage'), 403);
        abort_if($role->isAdminRole(), 403, 'The administrator role cannot be deleted.');
        abort_if($role->users()->exists(), 422, 'Reassign users before deleting this role.');

        $name = $role->display_name;
        $role->delete();
        ActivityLog::record($request->user(), 'ROLE_DELETE', $name);

        return back()->with('success', 'Role deleted.');
    }

    private function validated(Request $request, ?Role $role = null): array
    {
        return $request->validate([
            'name' => [
                $role ? 'nullable' : 'required',
                'string',
                'max:50',
                Rule::unique('roles', 'name')->ignore($role?->id),
            ],
            'display_name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['boolean'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $permissions
     * @return array<string, bool>
     */
    private function normalizePermissions(array $permissions): array
    {
        $allowed = array_flip(PermissionCatalog::keys());
        $normalized = [];

        foreach ($permissions as $key => $enabled) {
            if (isset($allowed[$key]) && $enabled) {
                $normalized[$key] = true;
            }
        }

        return $normalized;
    }
}
