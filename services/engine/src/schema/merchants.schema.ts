import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { pgPolicy } from "drizzle-orm/pg-core";
import { prefixedId } from "../utils/id_prefix.js";

export const MerchantsTable = pgTable("merchants", {
    id: prefixedId('id', 'mer').primaryKey(), 
    name: text('name').notNull(), 
    email: text('email').unique().notNull(), 
    company: text('company').notNull(),
    password_hash: text('password_hash').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (_t) => [
    pgPolicy("merchant_isolation", {
        as: "permissive",
        for: "all",
        using: sql`id = current_setting('app.current_merchant_id')::text`,
        withCheck: sql`id = current_setting('app.current_merchant_id')::text`,
    }),
]);
