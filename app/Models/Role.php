<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    public const ADMIN = 'admin';

    protected $fillable = [
        'name',
        'display_name',
        'description',
        'permissions',
    ];

    protected function casts(): array
    {
        return [
            'permissions' => 'array',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function allows(string $permission): bool
    {
        $permissions = $this->permissions ?? [];

        if (in_array('*', $permissions, true) || ($permissions['*'] ?? false) === true) {
            return true;
        }

        if (array_is_list($permissions)) {
            return in_array($permission, $permissions, true);
        }

        return (bool) ($permissions[$permission] ?? false);
    }

    public function isAdminRole(): bool
    {
        return $this->name === self::ADMIN;
    }

    /**
     * @return array<string, bool>
     */
    public function permissionMap(): array
    {
        $permissions = $this->permissions ?? [];

        if (in_array('*', $permissions, true) || data_get($permissions, '*') === true) {
            return ['*' => true];
        }

        if (array_is_list($permissions)) {
            return collect($permissions)->mapWithKeys(fn (string $key) => [$key => true])->all();
        }

        return collect($permissions)
            ->filter(fn ($value) => (bool) $value)
            ->mapWithKeys(fn ($value, $key) => [(string) $key => true])
            ->all();
    }
}
