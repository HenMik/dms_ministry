<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Archive extends Model
{
    protected $fillable = [
        'archivable_type', 'archivable_id', 'archived_by_id', 'archived_at',
        'reason', 'restricted_access', 'previous_status',
    ];

    protected function casts(): array
    {
        return [
            'archived_at' => 'datetime',
            'restricted_access' => 'boolean',
        ];
    }

    public function archivable(): MorphTo
    {
        return $this->morphTo();
    }

    public function archivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'archived_by_id');
    }

    public function allowedUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'archive_allowed_users');
    }
}
