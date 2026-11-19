<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'password',
        'role_id',
        'is_approver',
        'is_active',
        'is_admin',
        'mfa_enabled',
        'totp_secret',
        'backup_codes',
        'password_changed_at',
        'password_expires_at',
        'password_expires_days',
        'force_password_change',
        'recovery_email',
        'recovery_phone',
        'signature_image',
        'stamp_image',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'totp_secret',
        'backup_codes',
        'signature_image',
        'stamp_image',
    ];

    protected $appends = ['name', 'full_name'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_approver' => 'boolean',
            'is_active' => 'boolean',
            'is_admin' => 'boolean',
            'mfa_enabled' => 'boolean',
            'backup_codes' => 'array',
            'password_changed_at' => 'datetime',
            'password_expires_at' => 'datetime',
            'force_password_change' => 'boolean',
        ];
    }

    public function getNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    public function getFullNameAttribute(): string
    {
        return $this->name;
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(Department::class)
            ->withPivot('is_primary')
            ->withTimestamps();
    }

    public function positions(): BelongsToMany
    {
        return $this->belongsToMany(Position::class)->withTimestamps();
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class);
    }

    public function otpCodes(): HasMany
    {
        return $this->hasMany(OtpCode::class);
    }

    public function appNotifications(): HasMany
    {
        return $this->hasMany(AppNotification::class);
    }

    public function pushSubscriptions(): HasMany
    {
        return $this->hasMany(PushSubscription::class);
    }

    public function canPerm(string $permission): bool
    {
        if ($this->is_admin) {
            return true;
        }

        return $this->role?->allows($permission) ?? false;
    }

    public function isAdmin(): bool
    {
        return $this->is_admin || $this->role?->isAdminRole() === true || $this->canPerm('*');
    }

    public function canManageUsers(): bool
    {
        return $this->canPerm('users.manage');
    }

    public function departmentIds(): array
    {
        if ($this->relationLoaded('departments')) {
            return $this->departments->pluck('id')->all();
        }

        return $this->departments()->pluck('departments.id')->all();
    }

    public function belongsToDepartment(?int $departmentId): bool
    {
        if ($departmentId === null) {
            return false;
        }

        if ($this->canPerm('documents.view_all')) {
            return true;
        }

        return in_array($departmentId, $this->departmentIds(), true);
    }

    public function mustChangePassword(): bool
    {
        if ($this->force_password_change) {
            return true;
        }

        return $this->password_expires_at && $this->password_expires_at->isPast();
    }
}
