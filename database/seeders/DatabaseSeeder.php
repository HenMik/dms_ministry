<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\DocumentCategory;
use App\Models\Organization;
use App\Models\Role;
use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        Organization::updateOrCreate(
            ['id' => 1],
            ['name' => 'DMS Organization', 'settings' => []]
        );

        $allPermissions = collect(PermissionCatalog::keys())
            ->mapWithKeys(fn (string $key) => [$key => true])
            ->all();

        $roles = [
            [
                'name' => Role::ADMIN,
                'display_name' => 'Administrator',
                'description' => 'Full system access',
                'permissions' => ['*' => true],
            ],
            [
                'name' => 'department_manager',
                'display_name' => 'Department Manager',
                'description' => 'Manage documents and folders within departments',
                'permissions' => collect($allPermissions)->except(['roles.manage', 'users.manage', 'settings.manage'])->all(),
            ],
            [
                'name' => 'contributor',
                'display_name' => 'Contributor',
                'description' => 'Upload and edit department documents',
                'permissions' => [
                    'documents.view' => true,
                    'documents.create' => true,
                    'documents.update' => true,
                    'documents.annotate' => true,
                    'folders.manage' => true,
                ],
            ],
            [
                'name' => 'approver',
                'display_name' => 'Approver',
                'description' => 'Review, approve, and sign documents',
                'permissions' => [
                    'documents.view' => true,
                    'documents.approve' => true,
                    'documents.sign' => true,
                    'documents.annotate' => true,
                    'archive.view' => true,
                ],
            ],
            [
                'name' => 'viewer',
                'display_name' => 'Viewer',
                'description' => 'Read-only document access',
                'permissions' => [
                    'documents.view' => true,
                    'archive.view' => true,
                ],
            ],
            [
                'name' => 'auditor',
                'display_name' => 'Auditor',
                'description' => 'Read-only archive and document access',
                'permissions' => [
                    'documents.view' => true,
                    'documents.view_all' => true,
                    'archive.view' => true,
                    'activity.view' => true,
                    'reports.view' => true,
                ],
            ],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(['name' => $role['name']], $role);
        }

        $departments = [
            ['name' => 'Finance', 'code' => 'FIN', 'sort_order' => 1],
            ['name' => 'Human Resources', 'code' => 'HR', 'sort_order' => 2],
            ['name' => 'ICT', 'code' => 'ICT', 'sort_order' => 3],
            ['name' => 'Credit', 'code' => 'CRD', 'sort_order' => 4],
            ['name' => 'Legal', 'code' => 'LEG', 'sort_order' => 5],
        ];

        foreach ($departments as $department) {
            Department::updateOrCreate(
                ['code' => $department['code']],
                [...$department, 'is_active' => true, 'description' => $department['name'].' department']
            );
        }

        $adminRole = Role::where('name', Role::ADMIN)->first();

        $admin = User::updateOrCreate(
            ['email' => 'admin@dms.local'],
            [
                'first_name' => 'System',
                'last_name' => 'Admin',
                'password' => Hash::make('password'),
                'role_id' => $adminRole->id,
                'is_admin' => true,
                'is_approver' => true,
                'is_active' => true,
                'force_password_change' => false,
                'password_changed_at' => now(),
            ]
        );

        $admin->departments()->sync(
            Department::pluck('id')->mapWithKeys(fn ($id, $index) => [$id => ['is_primary' => $index === 0]])->all()
        );

        foreach (Department::all() as $department) {
            $folder = DocumentCategory::updateOrCreate(
                ['name' => $department->name, 'parent_id' => null],
                ['description' => $department->name.' documents']
            );
            $folder->syncDepartments([$department->id]);
        }
    }
}
