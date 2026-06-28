import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { pgPolicy } from "drizzle-orm/pg-core";
import { prefixedId } from "../utils/id_prefix.js";
import { MerchantsTable } from "./merchants.schema.js";

export const WebhookStatusEnum = pgEnum("webhook_endpoint_status", ["active", "failing", "disabled"]);

export const WebhookEndpointsTable = pgTable("webhook_endpoints", {
    id: prefixedId("id", "wep").primaryKey(),
    merchant_id: text("merchant_id").notNull().references(() => MerchantsTable.id),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    status: WebhookStatusEnum("status").notNull().default("active"),
    last_delivery_at: timestamp("last_delivery_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (_t) => [
    pgPolicy("merchant_isolation", {
        as: "permissive",
        for: "all",
        using: sql`merchant_id = current_setting('app.current_merchant_id')::text`,
        withCheck: sql`merchant_id = current_setting('app.current_merchant_id')::text`,
    }),
]);
