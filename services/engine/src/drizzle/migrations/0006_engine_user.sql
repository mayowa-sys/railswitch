DO $$
DECLARE
    user_name TEXT;

BEGIN
SELECT rolname INTO user_name FROM pg_roles WHERE rolname='engine_user';

IF user_name IS NULL THEN
    CREATE USER engine_user WITH PASSWORD 'railswitch_dev';
    GRANT USAGE ON SCHEMA public TO engine_user;
    GRANT SELECT, UPDATE, INSERT, DELETE ON ALL TABLES IN SCHEMA public TO engine_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO engine_user;
    REVOKE UPDATE, INSERT, DELETE ON webhook_events, webhook_delivery_attempts, webhook_endpoints FROM engine_user;
END IF;


END $$;