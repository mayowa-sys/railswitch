import { drizzle } from "drizzle-orm/node-postgres";
import dotenv from "dotenv";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

dotenv.config({ quiet: true });

let pool: Pool | undefined;

export const getDatabase = async (tenantId: string) => {
  // the express middleware will extract the tenantId from the headers and create this database, then attach the database to the request.
  if (!pool) {
    try {
      pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("[Postgres]: DATABASE_URL unavailable");
        throw new Error((err.message as string) || "DATABASE_URL unavailable");
      }
      throw new Error("[Postgres]: Error");
    }

    const client = await pool.connect();
    const drizzleDb = drizzle(client);

    await drizzleDb.execute(
      sql`SET LOCAL app.current.merchant_id = ${tenantId}:text`,
    );

    return drizzleDb;
  }
};
