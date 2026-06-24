import { sql } from "drizzle-orm";
import { pgPolicy } from "drizzle-orm/pg-core";

export const merchantIsolationPolicy = () =>
  pgPolicy("merchant_isolation", {
    as: "restrictive",
    for: "all",
    using: sql`merchant_id = current_setting('app.current_merchant_id')::text`,
    withCheck: sql`merchant_id = current_setting('app.current_merchant_id')::text`,
  });
