import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { env } from '../config/env';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Migrator {
  private pool: pg.Pool;

  constructor(pool?: pg.Pool) {
    if (pool) {
      this.pool = pool;
    } else {
      if (!env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not set in environment.');
      }
      const connectionString = env.DATABASE_URL.replace('@localhost:', '@127.0.0.1:').replace('@localhost/', '@127.0.0.1/');
      this.pool = new pg.Pool({
        connectionString,
        ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 5000,
      });
    }
  }

  public async runMigrations(migrationsDir?: string): Promise<{ applied: string[]; skipped: string[] }> {
    const dir = migrationsDir || path.join(__dirname, 'migrations');
    const client = await this.pool.connect();

    try {
      // 1. Ensure migrations tracking table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // 2. Fetch already applied migrations
      const { rows } = await client.query<{ name: string }>('SELECT name FROM _migrations');
      const appliedSet = new Set(rows.map((r) => r.name));

      // 3. Read migration files sorted alphabetically
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

      const applied: string[] = [];
      const skipped: string[] = [];

      for (const file of files) {
        if (appliedSet.has(file)) {
          skipped.push(file);
          continue;
        }

        const filePath = path.join(dir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        console.log(`[Migrator] Applying migration: ${file}...`);
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          applied.push(file);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`[Migrator] Failed to apply ${file}:`, err);
          throw err;
        }
      }

      return { applied, skipped };
    } finally {
      client.release();
    }
  }

  public async runSeeds(seedsDir?: string): Promise<string[]> {
    const dir = seedsDir || path.join(__dirname, 'seeds');
    const client = await this.pool.connect();

    try {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
      const seeded: string[] = [];

      for (const file of files) {
        const filePath = path.join(dir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        console.log(`[Migrator] Running seed: ${file}...`);
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('COMMIT');
          seeded.push(file);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`[Migrator] Failed seed ${file}:`, err);
          throw err;
        }
      }

      return seeded;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

// CLI runner if executed directly
if (process.argv[1] && process.argv[1].endsWith('migrator.ts')) {
  const migrator = new Migrator();
  migrator
    .runMigrations()
    .then(async (res) => {
      console.log(`[Migrator] Applied ${res.applied.length} migrations, skipped ${res.skipped.length} existing.`);
      const seeds = await migrator.runSeeds();
      console.log(`[Migrator] Executed ${seeds.length} seed files.`);
      await migrator.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migrator] Fatal migration error:', err);
      process.exit(1);
    });
}
