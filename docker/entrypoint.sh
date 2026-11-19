#!/bin/sh
set -e

php artisan config:clear || true
php artisan migrate --force || true
php artisan storage:link || true
php artisan db:seed --force || true

exec "$@"
