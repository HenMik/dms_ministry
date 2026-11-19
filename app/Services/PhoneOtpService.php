<?php

namespace App\Services;

use App\Models\OtpCode;
use App\Models\User;
use App\Support\MalawiPhone;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class PhoneOtpService
{
    public const TYPE_LOGIN = 'LOGIN';

    public const TTL_MINUTES = 5;

    public const MAX_ATTEMPTS = 5;

    public const RESEND_COOLDOWN_SECONDS = 45;

    public function __construct(
        private readonly SmsGatewayService $sms,
    ) {}

    public function findActiveUserByPhone(string $rawPhone): ?User
    {
        $variants = MalawiPhone::variants($rawPhone);
        if ($variants === []) {
            return null;
        }

        return User::query()
            ->where('is_active', true)
            ->where('phone_number', '!=', '')
            ->get(['id', 'phone_number', 'is_active', 'first_name', 'last_name', 'email', 'password', 'role_id', 'force_password_change', 'password_expires_at'])
            ->first(function (User $user) use ($variants) {
                return count(array_intersect($variants, MalawiPhone::variants((string) $user->phone_number))) > 0;
            });
    }

    /**
     * Issue a login OTP for a phone number that must already belong to an active user.
     *
     * @return array{sent: bool, cooldown: bool, user?: User, reason?: string}
     */
    public function requestLoginOtp(string $rawPhone): array
    {
        $user = $this->findActiveUserByPhone($rawPhone);
        if (! $user) {
            return ['sent' => false, 'cooldown' => false, 'reason' => 'not_found'];
        }

        $smsPhone = MalawiPhone::formatForSms((string) $user->phone_number)
            ?? MalawiPhone::formatForSms($rawPhone);

        if (! $smsPhone) {
            return ['sent' => false, 'cooldown' => false, 'reason' => 'invalid'];
        }

        $latest = OtpCode::query()
            ->where('user_id', $user->id)
            ->where('otp_type', self::TYPE_LOGIN)
            ->where('used', false)
            ->latest('id')
            ->first();

        if ($latest && $latest->last_sent_at && $latest->last_sent_at->diffInSeconds(now()) < self::RESEND_COOLDOWN_SECONDS) {
            return ['sent' => false, 'cooldown' => true, 'user' => $user];
        }

        $plain = (string) random_int(100000, 999999);

        DB::transaction(function () use ($user, $plain, $smsPhone) {
            OtpCode::query()
                ->where('user_id', $user->id)
                ->where('otp_type', self::TYPE_LOGIN)
                ->where('used', false)
                ->update(['used' => true]);

            OtpCode::create([
                'user_id' => $user->id,
                'code' => $this->hash($plain),
                'otp_type' => self::TYPE_LOGIN,
                'phone' => $smsPhone,
                'expires_at' => now()->addMinutes(self::TTL_MINUTES),
                'used' => false,
                'attempts' => 0,
                'last_sent_at' => now(),
            ]);
        });

        $delivered = $this->deliver($smsPhone, $plain, 'login_'.$user->id);

        if (! $delivered) {
            throw new RuntimeException('Unable to deliver the verification code.');
        }

        return ['sent' => true, 'cooldown' => false, 'user' => $user];
    }

    /**
     * @return array{ok: bool, user?: User, reason?: string}
     */
    public function verifyLoginOtp(int $userId, string $plainCode): array
    {
        $otp = OtpCode::query()
            ->where('user_id', $userId)
            ->where('otp_type', self::TYPE_LOGIN)
            ->where('used', false)
            ->latest('id')
            ->first();

        if (! $otp) {
            return ['ok' => false, 'reason' => 'expired'];
        }

        if ($otp->expires_at->isPast()) {
            $otp->update(['used' => true]);

            return ['ok' => false, 'reason' => 'expired'];
        }

        if ($otp->attempts >= self::MAX_ATTEMPTS) {
            $otp->update(['used' => true]);

            return ['ok' => false, 'reason' => 'locked'];
        }

        if (! $this->check($plainCode, $otp->code)) {
            $otp->increment('attempts');
            if ($otp->fresh()->attempts >= self::MAX_ATTEMPTS) {
                $otp->update(['used' => true]);

                return ['ok' => false, 'reason' => 'locked'];
            }

            return ['ok' => false, 'reason' => 'invalid'];
        }

        $otp->update(['used' => true]);

        $user = User::query()->whereKey($userId)->where('is_active', true)->first();
        if (! $user) {
            return ['ok' => false, 'reason' => 'inactive'];
        }

        return ['ok' => true, 'user' => $user];
    }

    private function deliver(string $phone, string $code, string $ref): bool
    {
        $message = 'DMS code: '.$code.'. Expires in '.self::TTL_MINUTES.' minutes. Do not share this code.';

        if (config('services.sms_gateway.driver') === 'log') {
            Log::info('OTP SMS (log driver)', ['phone' => MalawiPhone::mask($phone), 'ref' => $ref]);

            // Never log the plaintext code outside local/testing.
            if (app()->environment(['local', 'testing'])) {
                Log::debug('OTP code for local testing', ['code' => $code]);
            }

            return true;
        }

        return $this->sms->send($phone, $message, 'boardpack_'.$ref.'_'.random_int(1000, 9999));
    }

    private function hash(string $code): string
    {
        return hash_hmac('sha256', $code, (string) config('app.key'));
    }

    private function check(string $plain, string $hash): bool
    {
        return hash_equals($hash, $this->hash($plain));
    }
}
