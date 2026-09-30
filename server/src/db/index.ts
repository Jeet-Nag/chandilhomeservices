import pg from 'pg';
import { env } from '../config/env';

const { Pool } = pg;

export class Database {
  private pool: pg.Pool | null = null;
  private isConnected = false;

  constructor() {
    if (env.DATABASE_URL) {
      const connectionString = env.DATABASE_URL.replace('@localhost:', '@127.0.0.1:').replace('@localhost/', '@127.0.0.1/');
      this.pool = new Pool({
        connectionString,
        ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      this.pool.on('error', (err) => {
        console.error('[DB] Unexpected error on idle client', err);
      });
    }
  }

  public async checkHealth(): Promise<{ connected: boolean; message: string }> {
    if (!this.pool) {
      return { connected: false, message: 'DATABASE_URL not configured. Running in memory/mock mode.' };
    }
    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        this.isConnected = true;
        return { connected: true, message: 'Database connected successfully.' };
      } finally {
        client.release();
      }
    } catch (err) {
      this.isConnected = false;
      return { connected: false, message: (err as Error).message };
    }
  }

  public getPool(): pg.Pool | null {
    return this.pool;
  }

  public async query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database pool is not available.');
    }
    return this.pool.query<T>(text, params);
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
    }
  }
}

export const db = new Database();
