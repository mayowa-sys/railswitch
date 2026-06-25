import { pgTable, text, timestamp, jsonb, index, unique, uuid } from "drizzle-orm/pg-core";
import { MerchantsTable } from "./merchants.schema.js";
import { sql } from "drizzle-orm";
import { SubscriptionsTable, SubscriptionStateEnum } from "./subscriptions.schema.js";
import { merchantIsolationPolicy } from "../utils/merchant_isolation_policy.js";

export const ProcessedEventsTable = pgTable(
    "processed_events",
    {
        id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
        merchant_id: text('merchant_id').notNull().references(() => MerchantsTable.id),
        subscription_id: text('subscription_id').notNull().references(() => SubscriptionsTable.id),
        idempotency_key: text('idempotency_key').notNull(),
        cached_state: SubscriptionStateEnum('cached_state').notNull(),
        cached_context: jsonb('cached_context').notNull(),
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    },
    (table) => [
        unique().on(table.subscription_id, table.idempotency_key),
        index('idx_merchant_subscription_created').on(
            table.merchant_id,
            table.subscription_id,
            table.created_at
        ),
        merchantIsolationPolicy()
    ]
);