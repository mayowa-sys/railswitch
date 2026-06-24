import { pgTable, text, timestamp, numeric, pgEnum, type PgTable } from "drizzle-orm/pg-core";
import { prefixedId } from "../utils/id_prefix.js";
import { relations } from "drizzle-orm";
import { SubscriptionsTable } from "./subscriptions.schema.js";

export const InvoiceStatusEnum = pgEnum('invoice_status', ['open', 'paid', 'void', 'uncollectible']);

export const InvoicesTable = pgTable("invoices", {
    id: prefixedId('id', 'inv').primaryKey(),
    subscription_id: text('subscription_id').notNull().references(() => SubscriptionsTable.id),
    status: InvoiceStatusEnum('status').default('open').notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    amount_paid: numeric('amount_paid', { precision: 10, scale: 2 }).default('0').notNull(),
    due_date: timestamp('due_date', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

