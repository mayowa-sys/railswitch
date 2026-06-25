import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  AnyPgColumn,
} from "drizzle-orm/pg-core";
import { prefixedId } from "../utils/id_prefix.js";
import { MerchantsTable } from "./merchants.schema.js";
import { pgEnum } from "drizzle-orm/pg-core";
import { PlansTable } from "./plans.schema.js";
import { CustomersTable } from "./customers.schema.js";
import { InvoicesTable } from "./invoices.schema.js";
import { merchantIsolationPolicy } from "../utils/merchant_isolation_policy.js";

export const SubscriptionStateEnum = pgEnum("subscription_state", [
  "pending",
  "trialing",
  "active",
  "charging",
  "retrying",
  "va_fallback",
  "ussd_fallback",
  "whatsapp_fallback",
  "paused",
  "past_due",
  "cancelled",
]);

interface DunningPolicy {
  maxRetries: number;
  ussdEnabled: boolean;
  graceHours: number;
  baseDelayMinutes: number;
  maxDelayHours: number;
}

export const SubscriptionsTable = pgTable(
  "subscriptions",
  {
    id: prefixedId("id", "sub").primaryKey(),
    merchant_id: text("merchant_id")
      .notNull()
      .references(() => MerchantsTable.id),
    customer_id: text("customer_id")
      .notNull()
      .references(() => CustomersTable.id),
    plan_id: text("plan_id")
      .notNull()
      .references(() => PlansTable.id),
    policy: jsonb("policy")
      .$type<DunningPolicy>()
      .notNull()
      .default({
        maxRetries: 3,
        ussdEnabled: true,
        graceHours: 72,
        baseDelayMinutes: 60,
        maxDelayHours: 72,
      }),
    state: SubscriptionStateEnum("state").notNull().default("pending"),
    version: integer("version").notNull().default(1),
    retry_count: integer("retry_count").notNull().default(0),
    last_failure_reason: text("last_failure_reason"),
    last_failure_retryable: boolean("last_failure_retryable"),
    va_id: text("va_id"),
    va_expires_at: timestamp("va_expires_at", { withTimezone: true }),
    current_invoice_id: text("current_invoice_id").references((): AnyPgColumn => InvoicesTable.id),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    next_billing_at: timestamp('next_billing_at', {withTimezone: true}), 
    trial_ends_at: timestamp('trial_ends_at', {withTimezone: true}), 
    current_period_start: timestamp('current_period_start', {withTimezone: true}).notNull(), 
    current_period_end: timestamp('current_period_end', {withTimezone: true}).notNull(),
    paused_at: timestamp('paused_at', {withTimezone: true}), 
    cancelled_at: timestamp('cancelled_at', {withTimezone: true})
  },  
  (table) => [
    index("subscriptions_merchant_id_state_idx").on(
      table.merchant_id,
      table.state,
    ),
    index("subscriptions_merchant_id_current_invoice_id_idx").on(
      table.merchant_id,
      table.current_invoice_id,
    ),
    merchantIsolationPolicy(),
    index("subscriptoin_merchant_id_next_billing_at_idx").on(
      table.merchant_id, 
      table.next_billing_at
    )
  ],
);

