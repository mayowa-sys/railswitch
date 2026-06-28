# Infrastructure

- `docker-compose.yml` — Local dev environment: Postgres, Redis, engine, gateway
- `railway.toml` — Production deployment configuration
- `setup.sql` — One-shot role bootstrap for shared environments; run it manually after migrations with `DATABASE_ROLE_PASSWORD` set

## Role bootstrap

Run the role bootstrap once per environment after the schema migrations have been applied:

```bash
export DATABASE_ROLE_PASSWORD='...'
psql "$DATABASE_URL" -v DATABASE_ROLE_PASSWORD="$DATABASE_ROLE_PASSWORD" -f infra/setup.sql
```

This keeps the password out of the migration files and avoids shipping credentials to shared databases such as Neon staging or production.
