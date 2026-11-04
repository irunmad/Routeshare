import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

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

  async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new ServiceUnavailableException('Database is not configured.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
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
