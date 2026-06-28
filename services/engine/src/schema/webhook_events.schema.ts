import { pgTable, text, timestamp, integer, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { pgPolicy } from "drizzle-orm/pg-core";
import { prefixedId } from "../utils/id_prefix.js";
import { MerchantsTable } from "./merchants.schema.js";
import { WebhookEndpointsTable } from "./webhook_endpoints.schema.js";

export const WebhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", ["delivered", "failed", "pending"]);

export const WebhookEventsTable = pgTable("webhook_events", {
    id: prefixedId("id", "wev").primaryKey(),
    merchant_id: text("merchant_id").notNull().references(() => MerchantsTable.id),
    event: text("event").notNull(),
    payload: jsonb("payload").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (_t) => [
    pgPolicy("merchant_isolation", {
        as: "permissive",
        for: "all",
        using: sql`merchant_id = current_setting('app.current_merchant_id')::text`,
        withCheck: sql`merchant_id = current_setting('app.current_merchant_id')::text`,
    }),
]);

export const WebhookDeliveryAttemptsTable = pgTable("webhook_delivery_attempts", {
    id: prefixedId("id", "wda").primaryKey(),
    endpoint_id: text("endpoint_id").notNull().references(() => WebhookEndpointsTable.id),
    event_id: text("event_id").notNull().references(() => WebhookEventsTable.id),
    merchant_id: text("merchant_id").notNull().references(() => MerchantsTable.id),
    status: WebhookDeliveryStatusEnum("status").notNull().default("pending"),
    status_code: integer("status_code"),
    attempts: integer("attempts").notNull().default(0),
    next_attempt_at: timestamp("next_attempt_at", { withTimezone: true }),
    delivered_at: timestamp("delivered_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (_t) => [
    pgPolicy("merchant_isolation", {
        as: "permissive",
        for: "all",
        using: sql`merchant_id = current_setting('app.current_merchant_id')::text`,
        withCheck: sql`merchant_id = current_setting('app.current_merchant_id')::text`,
    }),
]);
