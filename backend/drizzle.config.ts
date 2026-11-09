import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for Drizzle Kit');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  schemaFilter: ['public'],
  dbCredentials: { url: process.env.DATABASE_URL },
});
