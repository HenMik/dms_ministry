<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Position extends Model
{
    protected $fillable = [
        'department_id',
        'name',
        'code',
        'description',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }

    public function documents(): BelongsToMany
    {
        return $this->belongsToMany(Document::class)->withTimestamps();
    }

    /**
     * @return list<int>
     */
    public function userIds(): array
    {
        if ($this->relationLoaded('users')) {
            return $this->users->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
        }

        return $this->users()->pluck('users.id')->map(fn ($id) => (int) $id)->values()->all();
    }
}
