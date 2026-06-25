import { drizzle } from "drizzle-orm/node-postgres";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ quiet: true });

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export const db = drizzle(pool);
