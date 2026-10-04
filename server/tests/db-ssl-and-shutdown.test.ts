import assert from 'node:assert';
import { validateEnvConfig, resolveDatabaseSsl } from '../src/config/env';
import { Database } from '../src/db';
import { Migrator } from '../src/db/migrator';
import { ShutdownManager } from '../src/shutdown';
import { buildApp } from '../src/app';

let passed = 0;
let failed = 0;

function it(desc: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`  [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${desc}:`, err);
      failed++;
    }
  })();
}

console.log('\n============================================================');
console.log('MODULE 15 STEP 1 — DB SSL & GRACEFUL SHUTDOWN TESTS');
console.log('============================================================\n');

async function runTests() {
  console.log('--- 1. DATABASE_SSL Environment Configuration ---');

  await it('1.1 DATABASE_SSL=false parses to boolean false', () => {
    const config = validateEnvConfig({ DATABASE_SSL: 'false' });
    assert.strictEqual(config.DATABASE_SSL, false);
  });

  await it('1.2 DATABASE_SSL=true parses to boolean true', () => {
    const config = validateEnvConfig({ DATABASE_SSL: 'true' });
    assert.strictEqual(config.DATABASE_SSL, true);
  });

  await it('1.3 DATABASE_SSL case-insensitive ("TRUE", "False") parses correctly', () => {
    const cfgTrue = validateEnvConfig({ DATABASE_SSL: 'TRUE' });
    assert.strictEqual(cfgTrue.DATABASE_SSL, true);
    const cfgFalse = validateEnvConfig({ DATABASE_SSL: 'False' });
    assert.strictEqual(cfgFalse.DATABASE_SSL, false);
  });

  await it('1.4 DATABASE_SSL omitted defaults safely to false', () => {
    const config = validateEnvConfig({});
    assert.strictEqual(config.DATABASE_SSL, false);
  });

  await it('1.5 DATABASE_SSL empty string defaults safely to false', () => {
    const config = validateEnvConfig({ DATABASE_SSL: '' });
    assert.strictEqual(config.DATABASE_SSL, false);
  });

  await it('1.6 Invalid DATABASE_SSL value "invalid" fails validation clearly', () => {
    assert.throws(
      () => validateEnvConfig({ DATABASE_SSL: 'invalid' }),
      (err: any) => {
        assert(err.message.includes('Invalid DATABASE_SSL value'));
        return true;
      }
    );
  });

  await it('1.7 Invalid DATABASE_SSL value "yes" fails validation', () => {
    assert.throws(
      () => validateEnvConfig({ DATABASE_SSL: 'yes' }),
      (err: any) => {
        assert(err.message.includes('Invalid DATABASE_SSL value'));
        return true;
      }
    );
  });

  await it('1.8 Invalid DATABASE_SSL value "1" fails validation', () => {
    assert.throws(
      () => validateEnvConfig({ DATABASE_SSL: '1' }),
      (err: any) => {
        assert(err.message.includes('Invalid DATABASE_SSL value'));
        return true;
      }
    );
  });

  console.log('\n--- 2. Database & Migrator SSL Resolution ---');

  await it('2.1 resolveDatabaseSsl(false) returns undefined (no SSL)', () => {
    const ssl = resolveDatabaseSsl(false);
    assert.strictEqual(ssl, undefined);
  });

  await it('2.2 resolveDatabaseSsl("false") returns undefined (no SSL)', () => {
    const ssl = resolveDatabaseSsl('false');
    assert.strictEqual(ssl, undefined);
  });

  await it('2.3 resolveDatabaseSsl(true) returns TLS configuration', () => {
    const ssl = resolveDatabaseSsl(true);
    assert.deepStrictEqual(ssl, { rejectUnauthorized: false });
  });

  await it('2.4 resolveDatabaseSsl("true") returns TLS configuration', () => {
    const ssl = resolveDatabaseSsl('true');
    assert.deepStrictEqual(ssl, { rejectUnauthorized: false });
  });

  await it('2.5 Database instance with ssl: false has SSL disabled', () => {
    const db = new Database({ connectionString: 'postgresql://user:pass@127.0.0.1:5432/testdb', ssl: false });
    assert.strictEqual(db.isSsl(), false);
  });

  await it('2.6 Database instance with ssl: true has SSL enabled', () => {
    const db = new Database({ connectionString: 'postgresql://user:pass@127.0.0.1:5432/testdb', ssl: true });
    assert.strictEqual(db.isSsl(), true);
  });

  await it('2.7 Migrator instance with ssl: false has SSL disabled', () => {
    const migrator = new Migrator({ connectionString: 'postgresql://user:pass@127.0.0.1:5432/testdb', ssl: false });
    assert.strictEqual(migrator.isSsl(), false);
  });

  await it('2.8 Migrator instance with ssl: true has SSL enabled', () => {
    const migrator = new Migrator({ connectionString: 'postgresql://user:pass@127.0.0.1:5432/testdb', ssl: true });
    assert.strictEqual(migrator.isSsl(), true);
  });

  console.log('\n--- 3. Graceful Shutdown & Signal Handling ---');

  await it('3.1 SIGTERM triggers clean Fastify close and DB close', async () => {
    const manager = new ShutdownManager();
    const app = await buildApp();

    let dbClosed = false;
    const mockDb = {
      close: async () => {
        dbClosed = true;
      },
    };

    const result = await manager.shutdown('SIGTERM', app, { dbInstance: mockDb, timeoutMs: 5000 });
    assert.strictEqual(result, true);
    assert.strictEqual(dbClosed, true);
    assert.strictEqual(manager.getIsShutdownComplete(), true);
  });

  await it('3.2 SIGINT triggers clean Fastify close and DB close', async () => {
    const manager = new ShutdownManager();
    const app = await buildApp();

    let dbClosed = false;
    const mockDb = {
      close: async () => {
        dbClosed = true;
      },
    };

    const result = await manager.shutdown('SIGINT', app, { dbInstance: mockDb, timeoutMs: 5000 });
    assert.strictEqual(result, true);
    assert.strictEqual(dbClosed, true);
    assert.strictEqual(manager.getIsShutdownComplete(), true);
  });

  await it('3.3 Repeated shutdown signals are ignored (idempotent)', async () => {
    const manager = new ShutdownManager();
    const app = await buildApp();

    let closeCount = 0;
    const mockDb = {
      close: async () => {
        closeCount++;
      },
    };

    // First call succeeds
    const first = await manager.shutdown('SIGTERM', app, { dbInstance: mockDb, timeoutMs: 5000 });
    assert.strictEqual(first, true);
    assert.strictEqual(closeCount, 1);

    // Second call is ignored safely
    const second = await manager.shutdown('SIGINT', app, { dbInstance: mockDb, timeoutMs: 5000 });
    assert.strictEqual(second, false);
    assert.strictEqual(closeCount, 1);
  });

  await it('3.4 Bounded shutdown timeout prevents process hanging if close stalls', async () => {
    const manager = new ShutdownManager();
    const app = await buildApp();

    const hangingDb = {
      close: async () => {
        // Simulates a hanging DB connection
        await new Promise((r) => setTimeout(r, 5000));
      },
    };

    await assert.rejects(
      async () => {
        await manager.shutdown('SIGTERM', app, { dbInstance: hangingDb, timeoutMs: 200 });
      },
      (err: any) => {
        assert(err.message.includes('Graceful shutdown timed out'));
        return true;
      }
    );
  });

  await it('3.5 Real Database pool close() method is safe and idempotent', async () => {
    const db = new Database();
    // close when pool is null is safe
    await db.close();
    assert.strictEqual(db.getPool(), null);
  });

  console.log('\n============================================================');
  console.log(`TOTAL HARDENING TESTS: ${passed} PASS, ${failed} FAIL`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
