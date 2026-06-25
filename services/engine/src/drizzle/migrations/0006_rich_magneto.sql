ALTER TABLE "merchants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "merchant_isolation" ON "api_keys" CASCADE;--> statement-breakpoint
DROP POLICY "merchant_isolation" ON "audit_log" CASCADE;--> statement-breakpoint
DROP POLICY "merchant_isolation" ON "charge_attempts" CASCADE;--> statement-breakpoint
DROP POLICY "merchant_isolation" ON "customers" CASCADE;--> statement-breakpoint
DROP POLICY "merchant_isolation" ON "invoices" CASCADE;--> statement-breakpoint
DROP POLICY "merchant_isolation" ON "payment_methods" CASCADE;--> statement-breakpoint
DROP POLICY "merchant_isolation" ON "plans" CASCADE;--> statement-breakpoint
DROP POLICY "merchant_isolation" ON "processed_events" CASCADE;--> statement-breakpoint
DROP POLICY "merchant_isolation" ON "subscriptions" CASCADE;--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "merchants" AS PERMISSIVE FOR ALL TO public USING (id = current_setting('app.current_merchant_id')::text) WITH CHECK (id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "api_keys" AS PERMISSIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "audit_log" AS PERMISSIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "charge_attempts" AS PERMISSIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "customers" AS PERMISSIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "invoices" AS PERMISSIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "payment_methods" AS PERMISSIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "plans" AS PERMISSIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "processed_events" AS PERMISSIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "subscriptions" AS PERMISSIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);