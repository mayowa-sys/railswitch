import { drizzle } from "drizzle-orm/node-postgres";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ quiet: true });

const pool = new Pool({ connectionString: process.env.ENGINE_USER_URL! });

export const db = drizzle(pool);
