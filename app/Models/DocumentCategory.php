<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

class DocumentCategory extends Model
{
    protected $fillable = ['name', 'description', 'parent_id'];

    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(Department::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('name');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'category_id');
    }

    public function visibleTo(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'document_category_visible_to');
    }

    /**
     * @param  list<int>  $departmentIds
     */
    public function syncDepartments(array $departmentIds): void
    {
        $this->departments()->sync(array_values(array_unique(array_map('intval', $departmentIds))));
    }

    public function scopeAccessibleBy(Builder $query, User $user): Builder
    {
        if ($user->canPerm('documents.view_all') || $user->canPerm('folders.manage')) {
            return $query;
        }

        $departmentIds = $user->departmentIds();

        return $query->where(function (Builder $query) use ($user, $departmentIds) {
            $query->where(function (Builder $open) use ($departmentIds) {
                $open->whereDoesntHave('visibleTo');

                if ($departmentIds === []) {
                    $open->whereDoesntHave('departments');
                } else {
                    $open->where(function (Builder $dept) use ($departmentIds) {
                        $dept->whereDoesntHave('departments')
                            ->orWhereHas('departments', fn (Builder $q) => $q->whereIn('departments.id', $departmentIds));
                    });
                }
            })->orWhereHas('visibleTo', fn (Builder $visible) => $visible->whereKey($user->id));
        });
    }

    public function isAccessibleBy(User $user): bool
    {
        if ($user->canPerm('documents.view_all') || $user->canPerm('folders.manage')) {
            return true;
        }

        if ($this->visibleTo()->whereKey($user->id)->exists()) {
            return true;
        }

        if ($this->visibleTo()->exists()) {
            return false;
        }

        $departmentIds = $this->departments()->pluck('departments.id')->all();

        if ($departmentIds === []) {
            return true;
        }

        foreach ($departmentIds as $departmentId) {
            if ($user->belongsToDepartment((int) $departmentId)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    public function breadcrumbTrail(): array
    {
        $crumbs = [];
        $current = $this;

        while ($current) {
            array_unshift($crumbs, ['id' => $current->id, 'name' => $current->name]);
            if (! $current->relationLoaded('parent')) {
                $current->load('parent');
            }
            $current = $current->parent;
        }

        return $crumbs;
    }

    /**
     * @param  list<int>|null  $departmentIds
     * @return Collection<int, self>
     */
    public static function flatOptions(?array $departmentIds = null, ?User $user = null): Collection
    {
        $query = self::query()->with('departments:id,name,code')->orderBy('name');

        if ($user) {
            $query->accessibleBy($user);
        } elseif ($departmentIds !== null) {
            $query->where(function ($q) use ($departmentIds) {
                $q->whereDoesntHave('departments')
                    ->orWhereHas('departments', fn ($dept) => $dept->whereIn('departments.id', $departmentIds));
            });
        }

        $categories = $query->get(['id', 'name', 'parent_id']);
        $byParent = $categories->groupBy(fn (self $category) => $category->parent_id ?? 0);

        $walk = function (?int $parentId, int $depth) use (&$walk, $byParent): Collection {
            return ($byParent[$parentId ?? 0] ?? collect())->flatMap(function (self $category) use (&$walk, $depth) {
                $category->setAttribute('depth', $depth);
                $category->setAttribute('label', str_repeat('— ', $depth).$category->name);

                return collect([$category])->merge($walk($category->id, $depth + 1));
            });
        };

        return $walk(null, 0)->values();
    }

    /**
     * @return list<int>
     */
    public function departmentIds(): array
    {
        if ($this->relationLoaded('departments')) {
            return $this->departments->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
        }

        return $this->departments()->pluck('departments.id')->map(fn ($id) => (int) $id)->values()->all();
    }
}
