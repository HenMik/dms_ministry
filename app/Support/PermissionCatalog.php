<?php

namespace App\Support;

class PermissionCatalog
{
    /**
     * @return array<string, array{label: string, group: string}>
     */
    public static function all(): array
    {
        return [
            'users.manage' => ['label' => 'Manage users', 'group' => 'Administration'],
            'roles.manage' => ['label' => 'Manage roles', 'group' => 'Administration'],
            'departments.manage' => ['label' => 'Manage departments', 'group' => 'Administration'],
            'settings.manage' => ['label' => 'Manage system settings', 'group' => 'Administration'],
            'activity.view' => ['label' => 'View audit log', 'group' => 'Administration'],
            'documents.view' => ['label' => 'View documents', 'group' => 'Documents'],
            'documents.create' => ['label' => 'Upload documents', 'group' => 'Documents'],
            'documents.update' => ['label' => 'Edit documents', 'group' => 'Documents'],
            'documents.delete' => ['label' => 'Delete documents', 'group' => 'Documents'],
            'documents.approve' => ['label' => 'Approve documents', 'group' => 'Documents'],
            'documents.sign' => ['label' => 'Sign documents', 'group' => 'Documents'],
            'documents.annotate' => ['label' => 'Annotate documents', 'group' => 'Documents'],
            'documents.archive' => ['label' => 'Archive documents', 'group' => 'Documents'],
            'documents.view_all' => ['label' => 'View all departments', 'group' => 'Documents'],
            'folders.manage' => ['label' => 'Manage folders', 'group' => 'Documents'],
            'reports.view' => ['label' => 'View all department reports', 'group' => 'Reports'],
            'archive.view' => ['label' => 'View archive', 'group' => 'Archive'],
        ];
    }

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return array_keys(self::all());
    }

    /**
     * @return array<string, list<array{key: string, label: string}>>
     */
    public static function grouped(): array
    {
        $grouped = [];

        foreach (self::all() as $key => $meta) {
            $grouped[$meta['group']][] = [
                'key' => $key,
                'label' => $meta['label'],
            ];
        }

        return $grouped;
    }
}
