CREATE TYPE "public"."api_key_type" AS ENUM('live', 'test');--> statement-breakpoint
CREATE TYPE "public"."actor_enum" AS ENUM('merchant', 'system', 'customer');--> statement-breakpoint
CREATE TYPE "public"."charge_status" AS ENUM('failed', 'success');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('open', 'paid', 'void', 'uncollectible');--> statement-breakpoint
CREATE TYPE "public"."subscription_state" AS ENUM('pending', 'trialing', 'active', 'charging', 'retrying', 'va_fallback', 'ussd_fallback', 'whatsapp_fallback', 'paused', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"type" "api_key_type",
	"revoked_at" timestamp,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"merchant_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"from_state" "subscription_state" NOT NULL,
	"to_state" "subscription_state" NOT NULL,
	"actor" "actor_enum",
	"reason" text,
	"timestamp" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "charge_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now(),
	"status" charge_status NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"status" "invoice_status" DEFAULT 'open' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0' NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" varchar NOT NULL,
	"company" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "merchants_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"nomba_token" text NOT NULL,
	"last4" text NOT NULL,
	"brand" text NOT NULL,
	"exp_month" text NOT NULL,
	"exp_year" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"interval" text NOT NULL,
	"interval_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_events" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"merchant_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"cached_state" "subscription_state" NOT NULL,
	"cached_context" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "processed_events_subscription_id_idempotency_key_unique" UNIQUE("subscription_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"policy" jsonb DEFAULT '{"maxRetries":3,"ussdEnabled":true,"graceHours":72,"baseDelayMinutes":60,"maxDelayHours":72}'::jsonb NOT NULL,
	"state" "subscription_state" DEFAULT 'pending' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_failure_reason" text,
	"last_failure_retryable" boolean,
	"va_id" text,
	"va_expires_at" timestamp with time zone,
	"current_invoice_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_attempts" ADD CONSTRAINT "charge_attempts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_events" ADD CONSTRAINT "processed_events_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_events" ADD CONSTRAINT "processed_events_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_current_invoice_id_invoices_id_fk" FOREIGN KEY ("current_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_merchant_subscription_idx" ON "audit_log" USING btree ("merchant_id","subscription_id","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_merchant_subscription_created" ON "processed_events" USING btree ("merchant_id","subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "subscriptions_merchant_id_state_idx" ON "subscriptions" USING btree ("merchant_id","state");--> statement-breakpoint
CREATE INDEX "subscriptions_merchant_id_current_invoice_id_idx" ON "subscriptions" USING btree ("merchant_id","current_invoice_id");--> statement-breakpoint
CREATE POLICY "audit_log_no_delete_policy" ON "audit_log" AS RESTRICTIVE FOR DELETE TO public;--> statement-breakpoint
CREATE POLICY "audit_log_no_update_policy" ON "audit_log" AS RESTRICTIVE FOR UPDATE TO public;