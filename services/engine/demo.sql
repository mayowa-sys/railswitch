BEGIN;

SET LOCAL app.current_merchant_id = 'mer_demo12345';

INSERT INTO merchants (id, name, email, company)
VALUES (
  'mer_demo12345',
  'Demo Merchant',
  'demo@example.com',
  'Demo Company'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO plans (id, merchant_id, name, amount, currency, interval, interval_count)
VALUES (
  'plan_demo12345',
  'mer_demo12345',
  'demo_plan',
  5000,
  'NGN',
  'month',
  1
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO customers (id, merchant_id, email, phone, metadata)
VALUES (
  'cus_demo12345',
  'mer_demo12345',
  'customer@example.com',
  '+2348000000000',
  '{"source":"demo"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscriptions (
  id,
  merchant_id,
  customer_id,
  plan_id,
  policy,
  state,
  version,
  retry_count,
  current_period_start,
  current_period_end,
  created_at,
  updated_at, 
  next_billing_at
)
VALUES (
  'sub_demo12345',
  'mer_demo12345',
  'cus_demo12345',
  'plan_demo12345',
  '{"maxRetries":3,"ussdEnabled":true,"graceHours":72,"baseDelayMinutes":60,"maxDelayHours":72}'::jsonb,
  'active',
  1,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '30 days',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP, 
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO payment_methods (
  id,
  customer_id,
  nomba_token,
  merchant_id,
  type,
  last4,
  brand,
  exp_month,
  exp_year,
  is_default
)
VALUES (
  'pm_demo12345',
  'cus_demo12345',
  'tok_demo12345',
  'mer_demo12345',
  'card',
  '4242',
  'visa',
  '12',
  '2028',
  true
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
