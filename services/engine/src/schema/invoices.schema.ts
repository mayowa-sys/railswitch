import { pgTable, text, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { prefixedId } from "../utils/id_prefix.js";
import { SubscriptionsTable } from "./subscriptions.schema.js";
import { MerchantsTable } from "./merchants.schema.js";
import { merchantIsolationPolicy } from "../utils/merchant_isolation_policy.js";

export const InvoiceStatusEnum = pgEnum('invoice_status', ['open', 'paid', 'void', 'uncollectible', 'pending_retry', 'recovered']);

export const InvoicesTable = pgTable("invoices", {
    id: prefixedId('id', 'inv').primaryKey(),
    subscription_id: text('subscription_id').notNull().references(() => SubscriptionsTable.id),
    merchant_id: text('merchant_id').notNull().references(() => MerchantsTable.id),
    status: InvoiceStatusEnum('status').default('open').notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    amount_paid: numeric('amount_paid', { precision: 10, scale: 2 }).default('0').notNull(),
    due_date: timestamp('due_date', { withTimezone: true }).notNull(),
    paid_at: timestamp('paid_at', { withTimezone: true }),
    next_attempt_at: timestamp('next_attempt_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (_t) => [
    merchantIsolationPolicy()
]);

