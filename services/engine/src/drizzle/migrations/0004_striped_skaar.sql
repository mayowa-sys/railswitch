ALTER TYPE "public"."invoice_status" ADD VALUE 'pending_retry';--> statement-breakpoint
ALTER TYPE "public"."invoice_status" ADD VALUE 'recovered';--> statement-breakpoint
ALTER TABLE "charge_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "merchants" ALTER COLUMN "email" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "merchants" ALTER COLUMN "company" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "charge_attempts" ADD COLUMN "merchant_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "merchant_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "next_billing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "current_period_start" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "current_period_end" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "charge_attempts" ADD CONSTRAINT "charge_attempts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptoin_merchant_id_next_billing_at_idx" ON "subscriptions" USING btree ("merchant_id","next_billing_at");--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "charge_attempts" AS RESTRICTIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "invoices" AS RESTRICTIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
ALTER POLICY "audit_log_no_delete_policy" ON "audit_log" TO public USING (false);--> statement-breakpoint
ALTER POLICY "audit_log_no_update_policy" ON "audit_log" TO public USING (false);