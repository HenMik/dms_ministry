<?php

namespace Tests\Concerns;

use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use App\Support\PermissionCatalog;

trait CreatesDmsUsers
{
    protected function department(string $code = 'FIN', array $attributes = []): Department
    {
        return Department::firstOrCreate(
            ['code' => $code],
            [
                'name' => $attributes['name'] ?? $code,
                'is_active' => true,
                'sort_order' => 0,
                'description' => '',
                ...$attributes,
            ]
        );
    }

    /**
     * @param  list<string>|array<string, bool>  $permissions
     */
    protected function roleWithPermissions(string $name, array $permissions = [], array $attributes = []): Role
    {
        if ($permissions === [] && $name === Role::ADMIN) {
            $permissions = ['*' => true];
        }

        if (array_is_list($permissions)) {
            $permissions = collect($permissions)->mapWithKeys(fn (string $key) => [$key => true])->all();
        }

        return Role::updateOrCreate(
            ['name' => $name],
            [
                'display_name' => $attributes['display_name'] ?? str_replace('_', ' ', ucfirst($name)),
                'description' => $attributes['description'] ?? '',
                'permissions' => $permissions,
            ]
        );
    }

    protected function dmsUser(string $roleName = 'contributor', array $attributes = [], ?Department $department = null, ?array $permissions = null): User
    {
        $defaultPermissions = match ($roleName) {
            Role::ADMIN, 'admin' => ['*' => true],
            'approver' => [
                'documents.view' => true,
                'documents.approve' => true,
                'documents.sign' => true,
                'documents.annotate' => true,
                'archive.view' => true,
            ],
            'viewer', 'auditor' => [
                'documents.view' => true,
                'archive.view' => true,
            ],
            'manager' => collect(PermissionCatalog::keys())
                ->reject(fn (string $key) => in_array($key, ['roles.manage', 'users.manage', 'settings.manage'], true))
                ->mapWithKeys(fn (string $key) => [$key => true])
                ->all(),
            default => [
                'documents.view' => true,
                'documents.create' => true,
                'documents.update' => true,
                'documents.delete' => true,
                'documents.annotate' => true,
                'documents.archive' => true,
                'folders.manage' => true,
                'archive.view' => true,
            ],
        };

        $role = $this->roleWithPermissions($roleName, $permissions ?? $defaultPermissions);
        $user = User::factory()->create([
            'role_id' => $role->id,
            'is_admin' => $roleName === Role::ADMIN || ($attributes['is_admin'] ?? false),
            'is_approver' => $attributes['is_approver'] ?? in_array($roleName, ['approver', Role::ADMIN], true),
            ...collect($attributes)->except(['is_admin', 'is_approver'])->all(),
        ]);

        $department ??= $this->department();
        $user->departments()->syncWithoutDetaching([
            $department->id => ['is_primary' => true],
        ]);

        return $user->fresh(['role', 'departments']);
    }
}
