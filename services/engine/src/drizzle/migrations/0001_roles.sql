-- Custom SQL migration file, put your code below! --
-- Create the engine_user role
CREATE USER engine_user WITH PASSWORD 'railswitch_dev';

-- Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO engine_user;

-- Grant full access (SELECT, INSERT, UPDATE, DELETE) to engine-owned tables
GRANT SELECT, INSERT, UPDATE, DELETE ON 
  merchants,
  api_keys,
  customers,
  plans,
  subscriptions,
  invoices,
  payment_methods,
  charge_attempts,
  audit_log
TO engine_user;

-- Grant sequence permissions for auto-incrementing IDs (if using serial/bigserial)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO engine_user;

-- Grant read-only access to gateway-owned tables
GRANT SELECT ON 
  webhook_endpoints,
  webhook_events,
  webhook_delivery_attempts
TO engine_user;
