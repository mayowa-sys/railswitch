CREATE TYPE "public"."webhook_endpoint_status" AS ENUM('active', 'failing', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('delivered', 'failed', 'pending');--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"status" "webhook_endpoint_status" DEFAULT 'active' NOT NULL,
	"last_delivery_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "webhook_delivery_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"endpoint_id" text NOT NULL,
	"event_id" text NOT NULL,
	"merchant_id" text NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"status_code" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "password_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_event_id_webhook_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."webhook_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "webhook_endpoints" AS PERMISSIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "webhook_delivery_attempts" AS PERMISSIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);--> statement-breakpoint
CREATE POLICY "merchant_isolation" ON "webhook_events" AS PERMISSIVE FOR ALL TO public USING (merchant_id = current_setting('app.current_merchant_id')::text) WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);