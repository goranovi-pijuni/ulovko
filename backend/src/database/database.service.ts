import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private pool?: Pool;
  private client?: NodePgDatabase<typeof schema>;

  get db(): NodePgDatabase<typeof schema> {
    if (!this.client) {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) throw new Error('DATABASE_URL is not configured');

      this.pool = new Pool({ connectionString });
      this.client = drizzle({ client: this.pool, schema });
    }
    return this.client;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool?.end();
  }
}
