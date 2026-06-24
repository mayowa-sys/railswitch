import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  index,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { MerchantsTable } from "./merchants.schema.js";
import {
  SubscriptionsTable,
  SubscriptionStateEnum,
} from "./subscriptions.schema.js";
import { merchantIsolationPolicy } from "../utils/merchant_isolation_policy.js";

export const ActorEnum = pgEnum("actor_enum", [
  "merchant",
  "system",
  "customer",
]);
export const AuditLog = pgTable(
  "audit_log",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    merchant_id: text("merchant_id")
      .notNull()
      .references(() => MerchantsTable.id),
    subscription_id: text("subscription_id")
      .notNull()
      .references(() => SubscriptionsTable.id),
    from_state: SubscriptionStateEnum("from_state").notNull(),
    to_state: SubscriptionStateEnum("to_state").notNull(),
    actor: ActorEnum("actor"),
    reason: text("reason"),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("audit_log_merchant_subscription_idx").on(
      table.merchant_id,
      table.subscription_id,
      table.timestamp.desc(),
    ),
    pgPolicy('audit_log_no_delete_policy', {
      as: 'restrictive', 
      for: 'delete',
    }), 
    pgPolicy('audit_log_no_update_policy', {
      as: 'restrictive', 
      for: 'update'
    }), 
    merchantIsolationPolicy()
  ],
);
