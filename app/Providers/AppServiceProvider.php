<?php

namespace App\Providers;

use App\Hashing\DjangoCompatibleHasher;
use App\Support\AppSettings;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        Hash::extend('django_compatible', fn (): DjangoCompatibleHasher => new DjangoCompatibleHasher);
        Hash::extend('bcrypt', fn (): DjangoCompatibleHasher => new DjangoCompatibleHasher);

        if (! $this->app->runningUnitTests() || Schema::hasTable('settings')) {
            try {
                if (Schema::hasTable('settings')) {
                    AppSettings::apply();
                }
            } catch (\Throwable) {
                // Ignore during install/migrate when the database is unavailable.
            }
        }

        $this->configureReportRateLimits();
    }

    private function configureReportRateLimits(): void
    {
        $key = fn (string $action, Request $request): string => $action.'|'.$request->route('token').'|'.$request->ip();

        RateLimiter::for('report', fn (Request $request) => Limit::perMinute(60)->by($key('report', $request)));
        RateLimiter::for('report-upload', fn (Request $request) => Limit::perMinute(20)->by($key('upload', $request)));
    }
}
