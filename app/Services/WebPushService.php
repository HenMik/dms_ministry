<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\PushSubscription;
use App\Models\User;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class WebPushService
{
    public function send(User $user, AppNotification $notification): void
    {
        $publicKey = config('services.vapid.public_key');
        $privateKey = config('services.vapid.private_key');

        if (! $publicKey || ! $privateKey) {
            return;
        }

        $auth = [
            'VAPID' => [
                'subject' => config('services.vapid.subject', 'mailto:admin@example.com'),
                'publicKey' => $publicKey,
                'privateKey' => $privateKey,
            ],
        ];

        $webPush = new WebPush($auth);
        $payload = json_encode([
            'title' => $notification->title,
            'body' => $notification->message,
            'url' => $notification->url ?? route('notifications.index'),
        ]);

        foreach ($user->pushSubscriptions as $sub) {
            $webPush->queueNotification(
                Subscription::create([
                    'endpoint' => $sub->endpoint,
                    'publicKey' => $sub->p256dh_key,
                    'authToken' => $sub->auth_key,
                ]),
                $payload
            );
        }

        foreach ($webPush->flush() as $report) {
            if (! $report->isSuccess() && $report->isSubscriptionExpired()) {
                PushSubscription::where('endpoint', $report->getRequest()->getUri()->__toString())->delete();
            }
        }

        $notification->update(['sent_push' => true]);
    }
}
