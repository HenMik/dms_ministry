# DMS

Department-based document management system for a single organization. Built from the board app stack (Laravel + Inertia + React).

## Features

- Department-scoped folders and documents
- Dynamic roles and permission catalog
- Upload, approve/reject, PDF annotate/sign, archive
- Users, directory, notifications, audit log

## Setup

```bash
composer install
cp .env.example .env   # if needed
php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed
npm install --legacy-peer-deps
npm run build
php artisan serve
```

Default admin: `admin@dms.local` / `password`
