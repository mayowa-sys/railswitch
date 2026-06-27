ALTER TABLE "audit_log" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "processed_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();