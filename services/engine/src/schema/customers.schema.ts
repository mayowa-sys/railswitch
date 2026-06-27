import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { prefixedId } from "../utils/id_prefix.js";
import { MerchantsTable } from "./merchants.schema.js";
import { merchantIsolationPolicy } from "../utils/merchant_isolation_policy.js";

export const CustomersTable = pgTable('customers', {
    id: prefixedId('id', 'cus').primaryKey(), 
    merchant_id: text('merchant_id').notNull().references(() => MerchantsTable.id), 
    email: text('email').notNull(), 
    name: text('name'),
    phone: text('phone'), 
    metadata: jsonb('metadata'), 
    created_at: timestamp('created_at', {withTimezone: true}).defaultNow(),
    updated_at: timestamp('updated_at', {withTimezone: true}).defaultNow(),
}, (_t) => [
    merchantIsolationPolicy()
]);