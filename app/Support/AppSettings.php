<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Crypt;
use Throwable;

class AppSettings
{
    public const AUTH_REQUIRE_OTP_AFTER_PASSWORD = 'auth.require_otp_after_password';

    public const MAIL_MAILER = 'mail.mailer';

    public const MAIL_HOST = 'mail.host';

    public const MAIL_PORT = 'mail.port';

    public const MAIL_USERNAME = 'mail.username';

    public const MAIL_PASSWORD = 'mail.password';

    public const MAIL_SCHEME = 'mail.scheme';

    public const MAIL_FROM_ADDRESS = 'mail.from_address';

    public const MAIL_FROM_NAME = 'mail.from_name';

    public const SMS_ENABLED = 'sms.enabled';

    public const SMS_DRIVER = 'sms.driver';

    public const SMS_URL = 'sms.url';

    public const SMS_TOKEN = 'sms.token';

    public const SMS_SENDER = 'sms.sender';

    public const DOCUMENTS_VIEW_ACCESS_USER_IDS = 'documents.view_access_user_ids';

    /**
     * @return list<string>
     */
    public static function secretKeys(): array
    {
        return [
            self::MAIL_PASSWORD,
            self::SMS_TOKEN,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return [
            self::AUTH_REQUIRE_OTP_AFTER_PASSWORD => false,
            self::MAIL_MAILER => (string) config('mail.default', 'log'),
            self::MAIL_HOST => (string) config('mail.mailers.smtp.host', '127.0.0.1'),
            self::MAIL_PORT => (string) config('mail.mailers.smtp.port', '2525'),
            self::MAIL_USERNAME => (string) config('mail.mailers.smtp.username', ''),
            self::MAIL_PASSWORD => '',
            self::MAIL_SCHEME => (string) (config('mail.mailers.smtp.scheme') ?? ''),
            self::MAIL_FROM_ADDRESS => (string) config('mail.from.address', 'noreply@example.com'),
            self::MAIL_FROM_NAME => (string) config('mail.from.name', config('app.name', 'DMS')),
            self::SMS_ENABLED => (bool) config('services.sms_gateway.enabled', true),
            self::SMS_DRIVER => (string) config('services.sms_gateway.driver', 'log'),
            self::SMS_URL => (string) config('services.sms_gateway.url', ''),
            self::SMS_TOKEN => '',
            self::SMS_SENDER => (string) config('services.sms_gateway.sender', 'ucssacco'),
            self::DOCUMENTS_VIEW_ACCESS_USER_IDS => [],
        ];
    }

    /**
     * @return list<int>
     */
    public static function viewAccessUserIds(): array
    {
        $value = static::get(self::DOCUMENTS_VIEW_ACCESS_USER_IDS, []);

        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : [];
        }

        if (! is_array($value)) {
            return [];
        }

        return array_values(array_unique(array_map('intval', $value)));
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $defaults = static::defaults();
        $fallback = array_key_exists($key, $defaults) ? $defaults[$key] : $default;
        $raw = Setting::get($key, null);

        if ($raw === null) {
            return $fallback;
        }

        if (in_array($key, static::secretKeys(), true)) {
            return static::decryptSecret((string) $raw) ?? $fallback;
        }

        return static::cast($key, $raw);
    }

    public static function requireOtpAfterPassword(): bool
    {
        return (bool) static::get(self::AUTH_REQUIRE_OTP_AFTER_PASSWORD, false);
    }

    /**
     * Values safe to show in the admin UI (secrets masked).
     *
     * @return array<string, mixed>
     */
    public static function forAdminForm(): array
    {
        $values = [];

        foreach (array_keys(static::defaults()) as $key) {
            if (in_array($key, static::secretKeys(), true)) {
                $secret = (string) static::get($key, '');
                $values[$key] = [
                    'configured' => $secret !== '',
                    'value' => '',
                ];

                continue;
            }

            $values[$key] = static::get($key);
        }

        return $values;
    }

    /**
     * @param  array<string, mixed>  $input
     */
    public static function update(array $input): void
    {
        $payload = [];

        foreach (array_keys(static::defaults()) as $key) {
            if (! array_key_exists($key, $input)) {
                continue;
            }

            $value = $input[$key];

            if (in_array($key, static::secretKeys(), true)) {
                $value = is_string($value) ? trim($value) : '';
                if ($value === '') {
                    continue;
                }
                $payload[$key] = Crypt::encryptString($value);

                continue;
            }

            if ($key === self::DOCUMENTS_VIEW_ACCESS_USER_IDS) {
                $ids = is_array($value) ? $value : [];
                $payload[$key] = json_encode(array_values(array_unique(array_map('intval', $ids))));

                continue;
            }

            if (is_bool($value)) {
                $payload[$key] = $value ? '1' : '0';
            } else {
                $payload[$key] = $value === null ? null : (string) $value;
            }
        }

        if ($payload !== []) {
            Setting::putMany($payload);
        }

        static::apply();
    }

    public static function apply(): void
    {
        try {
            $mailer = (string) static::get(self::MAIL_MAILER, config('mail.default'));
            config([
                'mail.default' => $mailer,
                'mail.mailers.smtp.host' => (string) static::get(self::MAIL_HOST),
                'mail.mailers.smtp.port' => (int) static::get(self::MAIL_PORT),
                'mail.mailers.smtp.username' => (string) static::get(self::MAIL_USERNAME),
                'mail.mailers.smtp.scheme' => ((string) static::get(self::MAIL_SCHEME)) ?: null,
                'mail.from.address' => (string) static::get(self::MAIL_FROM_ADDRESS),
                'mail.from.name' => (string) static::get(self::MAIL_FROM_NAME),
                'services.sms_gateway.enabled' => (bool) static::get(self::SMS_ENABLED),
                'services.sms_gateway.driver' => (string) static::get(self::SMS_DRIVER),
                'services.sms_gateway.url' => (string) static::get(self::SMS_URL),
                'services.sms_gateway.sender' => (string) static::get(self::SMS_SENDER),
            ]);

            $mailPassword = (string) static::get(self::MAIL_PASSWORD, '');
            if ($mailPassword !== '') {
                config(['mail.mailers.smtp.password' => $mailPassword]);
            }

            $smsToken = (string) static::get(self::SMS_TOKEN, '');
            if ($smsToken !== '') {
                config(['services.sms_gateway.token' => $smsToken]);
            } elseif (Setting::get(self::SMS_TOKEN) === null && config('services.sms_gateway.token')) {
                // Keep env token when nothing stored yet.
            }
        } catch (Throwable) {
            // Settings table may not exist yet during early migrate/install.
        }
    }

    private static function cast(string $key, mixed $raw): mixed
    {
        $defaults = static::defaults();
        $default = $defaults[$key] ?? null;

        if ($key === self::DOCUMENTS_VIEW_ACCESS_USER_IDS) {
            if (is_array($raw)) {
                return array_values(array_unique(array_map('intval', $raw)));
            }

            $decoded = json_decode((string) $raw, true);

            return is_array($decoded)
                ? array_values(array_unique(array_map('intval', $decoded)))
                : [];
        }

        if (is_bool($default)) {
            return in_array((string) $raw, ['1', 'true', 'on', 'yes'], true);
        }

        return $raw;
    }

    private static function decryptSecret(string $raw): ?string
    {
        if ($raw === '') {
            return '';
        }

        try {
            return Crypt::decryptString($raw);
        } catch (Throwable) {
            // Legacy/plaintext fallback for local testing only.
            return $raw;
        }
    }
}
