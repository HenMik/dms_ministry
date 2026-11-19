<?php

namespace App\Models;

use App\Jobs\SendWebPush;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class AppNotification extends Model
{
    protected $fillable = [
        'user_id', 'notification_type', 'title', 'message',
        'related_type', 'related_id', 'is_read', 'read_at', 'sent_email', 'sent_push',
    ];

    protected $appends = ['url'];

    protected function casts(): array
    {
        return [
            'is_read' => 'boolean',
            'read_at' => 'datetime',
            'sent_email' => 'boolean',
            'sent_push' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::created(function (self $notification) {
            if (config('services.vapid.public_key') && config('services.vapid.private_key')) {
                SendWebPush::dispatch($notification)->afterCommit();
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function related(): MorphTo
    {
        return $this->morphTo();
    }

    public function getUrlAttribute(): ?string
    {
        if (! $this->related_id) {
            return null;
        }

        return match ($this->related_type) {
            Document::class => route('documents.show', $this->related_id),
            Meeting::class => route('meetings.show', $this->related_id),
            BoardPack::class => route('boardpacks.show', $this->related_id),
            Minute::class => route('minutes.show', $this->related_id),
            ActionItem::class => ($meetingId = ActionItem::whereKey($this->related_id)->value('minute_id'))
                ? route('minutes.show', $meetingId)
                : null,
            default => null,
        };
    }
}
