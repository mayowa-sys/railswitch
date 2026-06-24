import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { MerchantsTable } from "./merchants.schema.js";
import { prefixedId } from "../utils/id_prefix.js";
import { merchantIsolationPolicy } from "../utils/merchant_isolation_policy.js";

export const ApiKeyTypeEnum = pgEnum('api_key_type', ['live', 'test'])

export const ApiKeysTable = pgTable('api_keys', {
    id: prefixedId('id', 'ak').primaryKey(), 
    merchant_id: text('merchant_id').notNull().references(() => MerchantsTable.id),
    key_hash: text('key_hash').notNull().unique(),
    key_prefix: text('key_prefix').notNull(),
    type: ApiKeyTypeEnum('type'),
    revoked_at: timestamp('revoked_at'),
}, (t) => [
    merchantIsolationPolicy()
]);