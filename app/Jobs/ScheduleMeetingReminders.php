<?php

namespace App\Jobs;

use App\Models\AppNotification;
use App\Models\Meeting;
use App\Models\MeetingReminder;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ScheduleMeetingReminders implements ShouldQueue
{
    use Queueable;

    public function __construct(public Meeting $meeting) {}

    public function handle(): void
    {
        $attendeeIds = $this->meeting->requiredAttendees()->pluck('users.id')
            ->merge($this->meeting->optionalAttendees()->pluck('users.id'))
            ->unique();

        $reminderTime = $this->meeting->scheduled_at->copy()->subHours(24);

        foreach ($attendeeIds as $userId) {
            MeetingReminder::updateOrCreate(
                [
                    'meeting_id' => $this->meeting->id,
                    'user_id' => $userId,
                    'reminder_type' => 'PUSH',
                    'reminder_time' => $reminderTime,
                ],
                []
            );

            AppNotification::create([
                'user_id' => $userId,
                'notification_type' => 'MEETING_REMINDER',
                'title' => 'Upcoming meeting',
                'message' => "{$this->meeting->title} on {$this->meeting->scheduled_at->toDayDateTimeString()}",
                'related_type' => Meeting::class,
                'related_id' => $this->meeting->id,
            ]);
        }
    }
}
