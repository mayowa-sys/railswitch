import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
    out: './src/drizzle/migrations',
    schema: './src/schema/*.ts',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL,
    },
    migrations: {
        table: 'drizzle-migrations',
        schema: 'public'
    }
});
