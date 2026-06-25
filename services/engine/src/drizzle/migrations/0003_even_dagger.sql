ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "processed_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "api_keys" AS RESTRICTIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "audit_log" AS RESTRICTIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "customers" AS RESTRICTIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "plans" AS RESTRICTIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "processed_events" AS RESTRICTIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "subscriptions" AS RESTRICTIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);