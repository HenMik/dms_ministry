<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Department extends Model
{
    protected $fillable = [
        'name',
        'code',
        'parent_id',
        'is_active',
        'sort_order',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort_order')->orderBy('name');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->withPivot('is_primary')
            ->withTimestamps();
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(DocumentCategory::class);
    }

    public function positions(): HasMany
    {
        return $this->hasMany(Position::class)->orderBy('name');
    }

    public function reportViewers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'department_report_user')->withTimestamps();
    }

    public function userCanViewReports(User $user): bool
    {
        if (
            $user->isAdmin()
            || $user->canPerm('documents.view_all')
            || $user->canPerm('departments.manage')
            || $user->canPerm('reports.view')
        ) {
            return true;
        }

        return $this->reportViewers()->whereKey($user->id)->exists();
    }

    /**
     * @return list<int>
     */
    public function descendantIds(): array
    {
        $ids = [];
        $queue = $this->children()->pluck('id')->all();

        while ($queue !== []) {
            $id = (int) array_shift($queue);
            $ids[] = $id;
            $queue = array_merge(
                $queue,
                self::query()->where('parent_id', $id)->pluck('id')->all()
            );
        }

        return $ids;
    }

    /**
     * Nested organogram nodes for the full department hierarchy.
     *
     * @return list<array{id: int, name: string, code: string, is_active: bool, users_count: int, documents_count: int, children: list<array<string, mixed>>}>
     */
    public static function organogram(): array
    {
        $departments = self::query()
            ->withCount(['users', 'documents'])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'parent_id', 'is_active']);

        $byParent = $departments->groupBy(fn (self $department) => $department->parent_id ?? 0);

        $build = function (?int $parentId) use (&$build, $byParent): array {
            return ($byParent[$parentId ?? 0] ?? collect())
                ->map(fn (self $department) => [
                    'id' => $department->id,
                    'name' => $department->name,
                    'code' => $department->code,
                    'is_active' => $department->is_active,
                    'users_count' => (int) $department->users_count,
                    'documents_count' => (int) $department->documents_count,
                    'children' => $build($department->id),
                ])
                ->values()
                ->all();
        };

        return $build(null);
    }
}
