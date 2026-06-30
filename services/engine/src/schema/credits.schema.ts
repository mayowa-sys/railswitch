import { pgTable, uuid, text, decimal, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { MerchantsTable } from "./merchants.schema";
import { SubscriptionsTable } from "./subscriptions.schema";
import { merchantIsolationPolicy } from "../utils/merchant_isolation_policy";

export const CreditSourceEnum = pgEnum("credit_source", ["downgrade"]);

export const CreditsTable = pgTable('credits', {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`), 
    amount_consumed: decimal('amount_consumed').notNull().default('0'),
    amount: decimal('amount').notNull(),  // starting amount of credit
    merchant_id: text('merchant_id').notNull().references(() => MerchantsTable.id), 
    subscription_id: text('subscription_id').notNull().references(() => SubscriptionsTable.id), 
    source: CreditSourceEnum("source"),

    consumed_at: timestamp('consumed_at', {withTimezone: true}),
    expires_at: timestamp('expires_at', {withTimezone: true}),
    created_at: timestamp('created_at', {withTimezone: true}).notNull().defaultNow()
}, (_t) =>[
    merchantIsolationPolicy()
])