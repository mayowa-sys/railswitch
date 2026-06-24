import { text, bigint, integer, pgTable } from "drizzle-orm/pg-core";
import { MerchantsTable } from "./merchants.schema.js";
import { prefixedId } from "../utils/id_prefix.js";
import { merchantIsolationPolicy } from "../utils/merchant_isolation_policy.js";

export const PlansTable = pgTable("plans", {
    id: prefixedId("id", "plan").primaryKey(),
    merchant_id: text("merchant_id")
        .notNull()
        .references(() => MerchantsTable.id),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("NGN"),
    interval: text("interval").notNull(),
    interval_count: integer("interval_count").notNull(),
}, (_t) => [
    merchantIsolationPolicy()
]);

export type Plan = typeof PlansTable.$inferSelect;
export type NewPlan = typeof PlansTable.$inferInsert;