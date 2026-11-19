<?php

namespace App\Models;

use App\Support\AppSettings;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Document extends Model
{
    protected $fillable = [
        'department_id', 'title', 'description', 'category_id', 'file_path', 'signed_file_path', 'file_size', 'mime_type',
        'version', 'parent_version_id', 'status', 'encrypted', 'encryption_key',
        'access_expires_at', 'watermark_enabled', 'requires_approval', 'approval_started_at', 'approval_completed_at',
        'uploaded_by_id', 'searchable_content',
    ];

    protected $hidden = ['file_path', 'signed_file_path', 'encryption_key', 'searchable_content'];

    protected $appends = ['is_pdf', 'is_signed'];

    protected function casts(): array
    {
        return [
            'access_expires_at' => 'datetime',
            'approval_started_at' => 'datetime',
            'approval_completed_at' => 'datetime',
            'encrypted' => 'boolean',
            'watermark_enabled' => 'boolean',
            'requires_approval' => 'boolean',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(DocumentCategory::class, 'category_id');
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_id');
    }

    public function parentVersion(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_version_id');
    }

    public function childVersions(): HasMany
    {
        return $this->hasMany(self::class, 'parent_version_id');
    }

    public function visibleTo(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'document_visible_to');
    }

    public function positions(): BelongsToMany
    {
        return $this->belongsToMany(Position::class)->withTimestamps();
    }

    public function pendingApprovers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'document_pending_approvers')
            ->withPivot(['sort_order', 'status', 'acted_at'])
            ->orderByPivot('sort_order');
    }

    public function approvedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'document_approved_by')->withPivot('approved_at');
    }

    public function annotations(): HasMany
    {
        return $this->hasMany(DocumentAnnotation::class);
    }

    public function signatures(): HasMany
    {
        return $this->hasMany(DocumentSignature::class);
    }

    public function accessLogs(): HasMany
    {
        return $this->hasMany(DocumentAccessLog::class);
    }

    public function getIsPdfAttribute(): bool
    {
        return str_contains((string) $this->mime_type, 'pdf')
            || Str::endsWith(Str::lower((string) $this->file_path), '.pdf');
    }

    public function getIsSignedAttribute(): bool
    {
        return filled($this->signed_file_path);
    }

    public function currentFilePath(): string
    {
        return $this->signed_file_path ?: $this->file_path;
    }

    /**
     * Sync ordered approval chain. First becomes current; rest waiting.
     *
     * @param  list<int>  $userIds
     */
    public function syncApprovalChain(array $userIds): void
    {
        $sync = [];
        foreach (array_values($userIds) as $index => $userId) {
            $sync[(int) $userId] = [
                'sort_order' => $index,
                'status' => $index === 0 ? 'current' : 'waiting',
                'acted_at' => null,
            ];
        }

        $this->pendingApprovers()->sync($sync);

        if ($userIds !== []) {
            $this->forceFill([
                'requires_approval' => true,
                'approval_started_at' => $this->approval_started_at ?? now(),
                'approval_completed_at' => null,
            ])->save();
        }
    }

    public function currentApproverId(): ?int
    {
        $current = $this->pendingApprovers()
            ->wherePivot('status', 'current')
            ->first();

        return $current?->id;
    }

    public function isCurrentApprover(User $user): bool
    {
        return $this->pendingApprovers()
            ->where('users.id', $user->id)
            ->where('document_pending_approvers.status', 'current')
            ->exists();
    }

    public function isBlockedApprover(User $user): bool
    {
        if (! $this->requires_approval || in_array($this->status, ['APPROVED', 'REJECTED', 'ARCHIVED'], true)) {
            return false;
        }

        return $this->pendingApprovers()
            ->where('users.id', $user->id)
            ->whereIn('document_pending_approvers.status', ['waiting', 'skipped'])
            ->exists();
    }

    public function approverCanView(User $user): bool
    {
        if (! $this->requires_approval) {
            return false;
        }

        // After completion, everyone in the chain can view again.
        if (in_array($this->status, ['APPROVED', 'REJECTED', 'ARCHIVED'], true)) {
            return $this->pendingApprovers()->where('users.id', $user->id)->exists();
        }

        return $this->pendingApprovers()
            ->where('users.id', $user->id)
            ->whereIn('document_pending_approvers.status', ['current', 'approved', 'rejected'])
            ->exists();
    }

    /**
     * @return array{seconds: int, label: string, completed: bool}
     */
    public function tatSummary(): array
    {
        $start = $this->approval_started_at ?? ($this->requires_approval ? $this->created_at : null);
        if (! $start) {
            return ['seconds' => 0, 'label' => '', 'completed' => false];
        }

        $end = $this->approval_completed_at ?? now();
        $seconds = max(0, $end->getTimestamp() - $start->getTimestamp());
        $completed = $this->approval_completed_at !== null;

        return [
            'seconds' => $seconds,
            'label' => self::formatDuration($seconds),
            'completed' => $completed,
        ];
    }

    public static function formatDuration(int $seconds): string
    {
        if ($seconds < 60) {
            return $seconds.'s';
        }

        $minutes = intdiv($seconds, 60);
        if ($minutes < 60) {
            return $minutes.'m';
        }

        $hours = intdiv($minutes, 60);
        $remMinutes = $minutes % 60;
        if ($hours < 48) {
            return $remMinutes > 0 ? "{$hours}h {$remMinutes}m" : "{$hours}h";
        }

        $days = intdiv($hours, 24);
        $remHours = $hours % 24;

        return $remHours > 0 ? "{$days}d {$remHours}h" : "{$days}d";
    }

    public function userCanViewAccessLogs(User $user): bool
    {
        if ($user->canPerm('documents.view_all') || $user->isAdmin()) {
            return true;
        }

        if ($this->uploaded_by_id === $user->id) {
            return true;
        }

        return in_array($user->id, AppSettings::viewAccessUserIds(), true);
    }

    public function scopeAccessibleBy(Builder $query, User $user): Builder
    {
        return $query->where(function (Builder $query) use ($user) {
            $query->where('uploaded_by_id', $user->id)
                ->orWhere(function (Builder $query) use ($user) {
                    $query->where(function (Builder $inner) use ($user) {
                        $inner->where(function (Builder $approver) use ($user) {
                            $approver->where(function (Builder $done) use ($user) {
                                $done->whereIn('status', ['APPROVED', 'REJECTED', 'ARCHIVED'])
                                    ->whereHas('pendingApprovers', fn (Builder $q) => $q->where('users.id', $user->id));
                            })->orWhereHas('pendingApprovers', function (Builder $q) use ($user) {
                                $q->where('users.id', $user->id)
                                    ->whereIn('document_pending_approvers.status', ['current', 'approved', 'rejected']);
                            });
                        })->orWhere(function (Builder $query) use ($user) {
                            $query->where(fn (Builder $q) => $q->whereNull('access_expires_at')->orWhere('access_expires_at', '>', now()));

                            $query->where(function (Builder $access) use ($user) {
                                $access->whereHas('visibleTo', fn (Builder $r) => $r->whereKey($user->id))
                                    ->orWhereHas('positions.users', fn (Builder $p) => $p->whereKey($user->id));

                                if ($user->canPerm('documents.view_all')) {
                                    $access->orWhere(function (Builder $open) {
                                        $open->whereDoesntHave('visibleTo')->whereDoesntHave('positions');
                                    });

                                    return;
                                }

                                $departmentIds = $user->departmentIds();
                                $access->orWhere(function (Builder $open) use ($departmentIds) {
                                    $open->whereDoesntHave('visibleTo')
                                        ->whereDoesntHave('positions')
                                        ->whereNotNull('department_id');

                                    if ($departmentIds === []) {
                                        $open->whereRaw('0 = 1');
                                    } else {
                                        $open->whereIn('department_id', $departmentIds);
                                    }
                                });
                            });
                        });
                    })->whereDoesntHave('pendingApprovers', function (Builder $q) use ($user) {
                        $q->where('users.id', $user->id)
                            ->whereIn('document_pending_approvers.status', ['waiting', 'skipped']);
                    });
                });
        });
    }

    public function isAccessibleBy(User $user): bool
    {
        if ($this->uploaded_by_id === $user->id) {
            return true;
        }

        // Later steps in the approval chain cannot open the document yet.
        if ($this->isBlockedApprover($user)) {
            return false;
        }

        if ($this->approverCanView($user)) {
            return true;
        }

        if ($this->access_expires_at?->isPast()) {
            return false;
        }

        if ($this->visibleTo()->whereKey($user->id)->exists()) {
            return true;
        }

        if ($this->positions()->whereHas('users', fn (Builder $q) => $q->whereKey($user->id))->exists()) {
            return true;
        }

        if ($this->visibleTo()->exists() || $this->positions()->exists()) {
            return false;
        }

        if ($this->department_id === null) {
            return $user->canPerm('documents.view_all');
        }

        return $user->canPerm('documents.view_all') || $user->belongsToDepartment($this->department_id);
    }
}
