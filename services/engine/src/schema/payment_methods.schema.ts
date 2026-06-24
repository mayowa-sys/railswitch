import { pgTable, text } from "drizzle-orm/pg-core";
import { prefixedId } from "../utils/id_prefix.js";
import { CustomersTable } from "./customers.js";

export const PaymentMethodsTable = pgTable('payment_methods', {
    id: prefixedId('id', 'pm').primaryKey(), 
    customer_id: text('customer_id').notNull().references(() => CustomersTable.id), 
    nomba_token: text('nomba_token').notNull(), 
    last4: text('last4').notNull(), 
    brand: text('brand').notNull(), 
    exp_month: text('exp_month').notNull(),  // TODO: confirm if this should be saved in text or date format
    exp_year: text('exp_year').notNull()
});