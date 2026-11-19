# Docker quick start

```bash
cp .env.example .env
# Set APP_KEY after first container boot, or:
php artisan key:generate

docker compose up -d --build
```

Services:

| Service | Host |
|---------|------|
| App (Nginx) | http://localhost:4001 |
| Postgres | localhost:5433 |
| Redis | localhost:6380 |

Inside Compose, set `DB_CONNECTION=pgsql`, `DB_HOST=db`, `REDIS_HOST=redis`, `QUEUE_CONNECTION=redis`.

Default admin after seed: `admin@ucssacco.com` / `password`
