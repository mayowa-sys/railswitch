-- One-shot bootstrap for the engine database role.
-- Usage:
--   export DATABASE_ROLE_PASSWORD='...'
--   psql "$DATABASE_URL" -v DATABASE_ROLE_PASSWORD="$DATABASE_ROLE_PASSWORD" -f infra/setup.sql

DO $$
DECLARE
  role_password text := :'DATABASE_ROLE_PASSWORD';
BEGIN
  IF role_password IS NULL OR role_password = '' THEN
    RAISE EXCEPTION 'DATABASE_ROLE_PASSWORD must be set before running this script';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'engine_user') THEN
    EXECUTE format('ALTER ROLE engine_user WITH LOGIN PASSWORD %L', role_password);
  ELSE
    EXECUTE format('CREATE ROLE engine_user LOGIN PASSWORD %L', role_password);
  END IF;

  EXECUTE 'GRANT USAGE ON SCHEMA public TO engine_user';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON merchants, api_keys, customers, plans, subscriptions, invoices, payment_methods, charge_attempts, audit_log TO engine_user';
END
$$;
