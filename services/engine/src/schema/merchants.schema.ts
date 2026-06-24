import { pgTable, text, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { prefixedId } from "../utils/id_prefix.js";

export const MerchantsTable = pgTable("merchants", {
    id: prefixedId('id', 'mer').primaryKey(), 
    name: text('name').notNull(), 
    email: varchar('email').unique().notNull(), 
    company: varchar('company').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});