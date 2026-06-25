import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { prefixedId } from "../utils/id_prefix.js";
import { InvoicesTable } from "./invoices.schema.js";
import { MerchantsTable } from "./merchants.schema.js";
import { merchantIsolationPolicy } from "../utils/merchant_isolation_policy.js";

export const ChargeStatus = pgEnum('charge_status', ['failed', 'success']);

export const ChargeAttempts = pgTable('charge_attempts', {
    id: prefixedId('id', 'ch').primaryKey(), 
    invoice_id: text('invoice_id').notNull().references(() => InvoicesTable.id), 
    merchant_id: text('merchant_id').notNull().references(() => MerchantsTable.id),
    attempted_at: timestamp('attempted_at', {withTimezone: true}).defaultNow(), 
    status: ChargeStatus('status').notNull(), 
    reason: text('reason')
}, (_t) => [
    merchantIsolationPolicy()
]);