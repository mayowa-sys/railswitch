import { boolean, pgTable, text, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { prefixedId } from "../utils/id_prefix.js";
import { CustomersTable } from "./customers.schema.js";
import { MerchantsTable } from "./merchants.schema.js";
import { merchantIsolationPolicy } from "../utils/merchant_isolation_policy.js";

export const PaymentMethodTypeEnum = pgEnum("payment_method_type", ["card", "virtual_account", "ussd"]);

export const PaymentMethodsTable = pgTable('payment_methods', {
    id: prefixedId('id', 'pm').primaryKey(), 
    customer_id: text('customer_id').notNull().references(() => CustomersTable.id), 
    type: PaymentMethodTypeEnum("type").notNull(),
    nomba_token: text('nomba_token').notNull(), 
    merchant_id: text('merchant_id').notNull().references(() => MerchantsTable.id),
    last4: text('last4').notNull(), 
    brand: text('brand').notNull(), 
    exp_month: text('exp_month').notNull(),
    exp_year: text('exp_year').notNull(),
    is_default: boolean('is_default').notNull().default(false),
    metadata: jsonb('metadata').default({}),
    created_at: timestamp('created_at', {withTimezone: true}).defaultNow(), 
    deleted_at: timestamp('deleted_at', {withTimezone: true})
}, (_t) => [
    merchantIsolationPolicy()
]);