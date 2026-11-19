<?php

namespace App\Support;

class MalawiPhone
{
    /**
     * Normalize a Malawi mobile number to international digits without plus, e.g. 265991234567.
     */
    public static function normalize(string $raw): ?string
    {
        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        if ($digits === '') {
            return null;
        }

        if (str_starts_with($digits, '265') && strlen($digits) === 12) {
            return $digits;
        }

        if (str_starts_with($digits, '0') && strlen($digits) === 10) {
            return '265'.substr($digits, 1);
        }

        if (strlen($digits) === 9 && in_array($digits[0], ['8', '9'], true)) {
            return '265'.$digits;
        }

        return null;
    }

    /**
     * @return list<string>
     */
    public static function variants(string $raw): array
    {
        $normalized = self::normalize($raw) ?? (preg_replace('/\D+/', '', $raw) ?: '');
        if ($normalized === '') {
            return [];
        }

        $variants = [$normalized];
        $tail9 = substr($normalized, -9);
        if ($tail9 !== '') {
            $variants[] = $tail9;
            $variants[] = '0'.$tail9;
            $variants[] = '265'.$tail9;
        }

        return array_values(array_unique(array_filter($variants)));
    }

    public static function mask(string $raw): string
    {
        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        if (strlen($digits) < 4) {
            return '****';
        }

        return str_repeat('*', max(0, strlen($digits) - 4)).substr($digits, -4);
    }

    public static function formatForSms(string $raw): ?string
    {
        $normalized = self::normalize($raw);

        return $normalized ? '+'.$normalized : null;
    }
}
