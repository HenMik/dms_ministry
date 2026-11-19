<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-full bg-slate-50 dark:bg-night-950">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="theme-color" content="#1f4d87">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="Boardpack">
        <meta name="application-name" content="Boardpack">

        <title inertia>{{ config('app.name', 'Boardpack') }}</title>

        <script>
            (function () {
                try {
                    var key = 'dms.theme';
                    var mode = localStorage.getItem(key) || 'system';
                    var dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                    var root = document.documentElement;
                    root.classList.toggle('dark', dark);
                    root.style.colorScheme = dark ? 'dark' : 'light';
                    root.style.backgroundColor = dark ? '#151b28' : '#f8fafc';
                    var meta = document.querySelector('meta[name="theme-color"]');
                    if (meta) meta.setAttribute('content', dark ? '#151b28' : '#1f4d87');
                } catch (e) {}
            })();
        </script>

        <link rel="manifest" href="/manifest.webmanifest">
        <link rel="apple-touch-icon" href="/icons/icon-180.png">
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-48.png">
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=poppins:300,400,500,600,700|dancing-script:600|great-vibes:400|caveat:600&display=swap" rel="stylesheet" />

        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/Pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="h-full bg-slate-50 font-sans text-slate-900 antialiased dark:bg-night-950 dark:text-night-100">
        @inertia
        <style>[data-page]{min-height:100%}</style>
    </body>
</html>
