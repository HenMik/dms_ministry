<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SmsGatewayService
{
    /**
     * Send an SMS via the UCSSACCO ClickSMS gateway used by the loans system.
     */
    public function send(string $phone, string $message, ?string $refId = null): bool
    {
        $phone = trim($phone);
        if ($phone === '') {
            return false;
        }

        if (! config('services.sms_gateway.enabled', true)) {
            Log::warning('SMS gateway disabled; message not sent');

            return false;
        }

        if (config('services.sms_gateway.driver') === 'log') {
            Log::info('SMS (log driver)', [
                'phone' => $phone,
                'message' => $message,
                'refId' => $refId,
            ]);

            return true;
        }

        $token = config('services.sms_gateway.token');
        $url = config('services.sms_gateway.url');
        $sender = config('services.sms_gateway.sender', 'ucssacco');

        if (! $token || ! $url) {
            Log::error('SMS gateway not configured');

            return false;
        }

        $refId ??= 'dms_'.Str::lower(Str::random(8));

        try {
            $response = Http::timeout(10)
                ->withHeaders(['Authorization' => $token])
                ->acceptJson()
                ->asJson()
                ->post($url, [
                    'from' => $sender,
                    'to' => $phone,
                    'message' => $message,
                    'refId' => $refId,
                ]);

            $payload = $response->json();
            $gatewayAccepted = is_array($payload)
                && (
                    (string) ($payload['statusCode'] ?? '') === '0'
                    || strtoupper((string) ($payload['status'] ?? '')) === 'SUCCESS'
                );

            if ($response->successful() && $gatewayAccepted) {
                Log::info('SMS accepted by gateway', [
                    'msgId' => $payload['msgId'] ?? null,
                    'refId' => $refId,
                ]);

                return true;
            }

            // Some gateway responses only return HTTP 200 without the status payload.
            if ($response->successful() && ! is_array($payload)) {
                return true;
            }

            Log::error('SMS send failed', [
                'status' => $response->status(),
                'gateway_status' => is_array($payload) ? ($payload['status'] ?? null) : null,
                'gateway_status_code' => is_array($payload) ? ($payload['statusCode'] ?? null) : null,
                'refId' => $refId,
            ]);

            return false;
        } catch (\Throwable $e) {
            Log::error('SMS send exception', [
                'error' => $e->getMessage(),
                'refId' => $refId,
            ]);

            return false;
        }
    }
}
