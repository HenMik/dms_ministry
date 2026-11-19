<?php

namespace App\Jobs;

use App\Models\AppNotification;
use App\Services\WebPushService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendWebPush implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public AppNotification $notification) {}

    public function handle(WebPushService $push): void
    {
        $user = $this->notification->user;

        if ($user && $user->pushSubscriptions()->exists()) {
            $push->send($user, $this->notification);
        }
    }
}
