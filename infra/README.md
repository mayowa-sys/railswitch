# Infrastructure

- `docker-compose.yml` — Local dev environment: Postgres 16, Redis 7, Engine, Gateway
- `setup.sql` — One-shot role bootstrap for shared environments; run it manually after migrations with `DATABASE_ROLE_PASSWORD` set

## Local Development

```bash
docker compose -f infra/docker-compose.yml up
```

Starts Postgres (port 5432) and Redis (port 6379). Engine and Gateway run separately via `npm run dev` and `uvicorn` respectively.

## Role Bootstrap

Run the role bootstrap once per environment after the schema migrations have been applied:

```bash
export DATABASE_ROLE_PASSWORD='...'
psql "$DATABASE_URL" -v DATABASE_ROLE_PASSWORD="$DATABASE_ROLE_PASSWORD" -f infra/setup.sql
```

This keeps the password out of the migration files and avoids shipping credentials to shared databases.
