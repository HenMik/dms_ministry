<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    public const CACHE_KEY = 'app.settings.map';

    protected $fillable = [
        'key',
        'value',
    ];

    /**
     * @return array<string, string|null>
     */
    public static function map(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, function () {
            return static::query()
                ->pluck('value', 'key')
                ->map(fn ($value) => $value === null ? null : (string) $value)
                ->all();
        });
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $map = static::map();

        if (! array_key_exists($key, $map)) {
            return $default;
        }

        return $map[$key] ?? $default;
    }

    public static function put(string $key, mixed $value): void
    {
        static::query()->updateOrCreate(
            ['key' => $key],
            ['value' => $value === null ? null : (string) $value],
        );

        Cache::forget(self::CACHE_KEY);
    }

    /**
     * @param  array<string, mixed>  $values
     */
    public static function putMany(array $values): void
    {
        foreach ($values as $key => $value) {
            static::query()->updateOrCreate(
                ['key' => $key],
                ['value' => $value === null ? null : (string) $value],
            );
        }

        Cache::forget(self::CACHE_KEY);
    }

    public static function forgetCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
