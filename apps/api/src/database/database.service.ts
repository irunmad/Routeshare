import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

export type DatabaseHealth = 'connected' | 'not_configured' | 'unavailable';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool | null;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    this.pool = connectionString
      ? new Pool({
          connectionString,
          max: 5,
          connectionTimeoutMillis: 5000,
          ssl:
            process.env.DATABASE_SSL === 'true'
              ? { rejectUnauthorized: false }
              : undefined,
        })
      : null;
  }

  async healthCheck(): Promise<DatabaseHealth> {
    if (!this.pool) return 'not_configured';

    try {
      await this.pool.query('SELECT 1');
      return 'connected';
    } catch {
      return 'unavailable';
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
