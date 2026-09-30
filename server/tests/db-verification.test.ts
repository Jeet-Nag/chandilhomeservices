import pg from 'pg';
import { env } from '../src/config/env';
import { Migrator } from '../src/db/migrator';

async function verifyDatabase() {
  console.log('\n============================================================');
  console.log('CHANDIL HOME SERVICES - DATABASE VERIFICATION SUITE');
  console.log('============================================================\n');

  if (!env.DATABASE_URL) {
    console.error('[BLOCKER] DATABASE_URL is not set.');
    process.exit(1);
  }

  const connectionString = env.DATABASE_URL.replace('@localhost:', '@127.0.0.1:').replace('@localhost/', '@127.0.0.1/');
  console.log(`Connecting to: ${connectionString.replace(/:[^:@]*@/, ':****@')}`);
  const pool = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
  });

  try {
    // 1. Connection check
    console.log('\n1. Testing Database Connection...');
    const connClient = await pool.connect();
    const { rows: testRows } = await connClient.query('SELECT current_database(), version()');
    console.log(`  [PASS] Connected to database: ${testRows[0].current_database}`);
    console.log(`  [INFO] PostgreSQL Version: ${testRows[0].version}`);
    connClient.release();

    const migrator = new Migrator(pool);

    // 2. Migration from Clean / Pending State
    console.log('\n2. Executing Database Migrations...');
    const firstRun = await migrator.runMigrations();
    console.log(`  [PASS] Migrations executed: ${firstRun.applied.length} applied, ${firstRun.skipped.length} previously applied.`);

    // 3. Repeatability / Idempotency Check
    console.log('\n3. Verifying Migration Idempotency...');
    const secondRun = await migrator.runMigrations();
    if (secondRun.applied.length === 0) {
      console.log(`  [PASS] Repeat migration resulted in 0 applied (fully idempotent).`);
    } else {
      console.error(`  [FAIL] Repeat migration unexpectedly applied ${secondRun.applied.length} files.`);
      process.exit(1);
    }

    // 4. Seed Data Execution & Verification
    console.log('\n4. Executing & Verifying Seed Data...');
    const seeds = await migrator.runSeeds();
    console.log(`  [PASS] Applied ${seeds.length} seed files.`);

    const client = await pool.connect();
    try {
      const { rows: categories } = await client.query('SELECT id, title_en, title_hi FROM service_categories ORDER BY sort_order ASC');
      console.log(`  [PASS] Found ${categories.length} service categories in database:`);
      for (const cat of categories) {
        console.log(`         • ${cat.id}: ${cat.title_en} (${cat.title_hi})`);
      }
      if (categories.length !== 5) {
        throw new Error(`Expected exactly 5 categories, got ${categories.length}`);
      }

      const { rows: configs } = await client.query('SELECT key, value FROM app_configs');
      console.log(`  [PASS] Found ${configs.length} app configuration keys.`);

      // 5. Schema Validation & Integrity Checks
      console.log('\n5. Testing Schema Constraints & Integrity Rules...');

      // A. Unique Constraint on Phone
      console.log('   A. Testing User Phone Unique Constraint...');
      const userAId = '00000000-0000-0000-0000-000000000001';
      const userBId = '00000000-0000-0000-0000-000000000002';
      const testPhone = '9999900001';

      await client.query('DELETE FROM users WHERE phone = $1', [testPhone]);
      await client.query('INSERT INTO users (id, phone, role, preferred_language) VALUES ($1, $2, $3, $4)', [userAId, testPhone, 'customer', 'hi']);
      
      let phoneDupFailed = false;
      try {
        await client.query('INSERT INTO users (id, phone, role, preferred_language) VALUES ($1, $2, $3, $4)', [userBId, testPhone, 'customer', 'en']);
      } catch (err: any) {
        if (err.code === '23505') { // unique_violation
          phoneDupFailed = true;
          console.log('      [PASS] Duplicate phone correctly rejected by unique constraint (23505).');
        }
      }
      if (!phoneDupFailed) throw new Error('Unique phone constraint failed to trigger!');

      // B. Booking Idempotency Constraint
      console.log('   B. Testing Booking Idempotency Key Constraint...');
      const testKey = 'test-idemp-' + Date.now();
      const bookingAId = '00000000-0000-0000-0000-000000000011';
      const bookingBId = '00000000-0000-0000-0000-000000000012';

      await client.query(`
        INSERT INTO bookings (id, idempotency_key, customer_id, category_id, area_locality, status)
        VALUES ($1, $2, $3, 'electrician', 'Chowka', 'SERVICE_REQUESTED')
      `, [bookingAId, testKey, userAId]);

      let idempFailed = false;
      try {
        await client.query(`
          INSERT INTO bookings (id, idempotency_key, customer_id, category_id, area_locality, status)
          VALUES ($1, $2, $3, 'electrician', 'Chowka', 'SERVICE_REQUESTED')
        `, [bookingBId, testKey, userAId]);
      } catch (err: any) {
        if (err.code === '23505') {
          idempFailed = true;
          console.log('      [PASS] Duplicate idempotency key correctly rejected by database (23505).');
        }
      }
      if (!idempFailed) throw new Error('Duplicate idempotency key failed to trigger unique violation!');

      // C. Foreign Key Constraint Checks
      console.log('   C. Testing Foreign Key Integrity...');
      let fkFailed = false;
      try {
        await client.query(`
          INSERT INTO bookings (id, idempotency_key, customer_id, category_id, area_locality, status)
          VALUES ('00000000-0000-0000-0000-000000000099', 'fk-test-key', '00000000-0000-0000-0000-999999999999', 'electrician', 'Chowka', 'SERVICE_REQUESTED')
        `);
      } catch (err: any) {
        if (err.code === '23503') { // foreign_key_violation
          fkFailed = true;
          console.log('      [PASS] Non-existent customer_id rejected by foreign key constraint (23503).');
        }
      }
      if (!fkFailed) throw new Error('Invalid customer foreign key was accepted unexpectedly!');

      // D. Invalid Enum Value
      console.log('   D. Testing Enum Validation...');
      let enumFailed = false;
      try {
        await client.query(`
          INSERT INTO bookings (id, idempotency_key, customer_id, category_id, area_locality, status)
          VALUES ('00000000-0000-0000-0000-000000000098', 'enum-test-key', $1, 'electrician', 'Chowka', 'INVALID_FAKE_STATUS')
        `, [userAId]);
      } catch (err: any) {
        if (err.code === '22P02') { // invalid_text_representation
          enumFailed = true;
          console.log('      [PASS] Invalid booking status rejected by enum check (22P02).');
        }
      }
      if (!enumFailed) throw new Error('Invalid enum value was accepted unexpectedly!');

      // Clean up test rows
      await client.query('DELETE FROM bookings WHERE customer_id = $1', [userAId]);
      await client.query('DELETE FROM users WHERE id = $1', [userAId]);
      console.log('  [PASS] Test fixtures cleaned up successfully.');

    } finally {
      client.release();
    }

    await pool.end();
    console.log('\n============================================================');
    console.log('DATABASE VERIFICATION SUITE: ALL CHECKS PASSED.');
    console.log('============================================================\n');

  } catch (err: any) {
    await pool.end();
    console.error('\n[DATABASE VERIFICATION FAILED]:', err.message);
    if (err.code === 'ECONNREFUSED' || err.message.includes('connect ECONNREFUSED')) {
      console.error('\n--> BLOCKER: PostgreSQL is not listening on the configured host/port.');
      console.error('--> Connection Target:', env.DATABASE_URL.replace(/:[^:@]*@/, ':****@'));
      console.error('--> Ensure PostgreSQL is installed and running locally, or configure a Neon cloud database in .env.');
    }
    process.exit(1);
  }
}

verifyDatabase();
