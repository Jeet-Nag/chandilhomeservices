import pg from 'pg';
import { env } from '../src/config/env';
import { Migrator } from '../src/db/migrator';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${name}`);
    failed++;
  }
}

async function runMigration008Verification() {
  console.log('\n============================================================');
  console.log('CHANDIL HOME SERVICES - MIGRATION 008 VERIFICATION SUITE');
  console.log('============================================================\n');

  if (!env.DATABASE_URL) {
    console.error('[BLOCKER] DATABASE_URL is not set.');
    process.exit(1);
  }

  const connectionString = env.DATABASE_URL.replace('@localhost:', '@127.0.0.1:').replace('@localhost/', '@127.0.0.1/');
  const pool = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
  });

  const client = await pool.connect();

  try {
    const migrator = new Migrator(pool);

    // 1. Run migrations to apply 008
    console.log('--- 1. Applying Pending Migrations ---');
    const firstRun = await migrator.runMigrations();
    console.log(`  Applied: ${firstRun.applied.join(', ') || 'none'}`);
    console.log(`  Skipped: ${firstRun.skipped.length} existing migrations`);
    assert(
      firstRun.applied.includes('008_create_passkey_auth.sql') || firstRun.skipped.includes('008_create_passkey_auth.sql'),
      'Migration 008_create_passkey_auth.sql was applied or previously applied'
    );

    // 2. Migration idempotency
    console.log('\n--- 2. Verifying Migration Idempotency ---');
    const secondRun = await migrator.runMigrations();
    assert(secondRun.applied.length === 0, 'Second migration run applied 0 files (fully idempotent)');

    // 3. Verify table presence and absence
    console.log('\n--- 3. Verifying Table Presence & Dropped OTP Table ---');
    const { rows: tableRows } = await client.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('user_credentials', 'webauthn_challenges', 'user_recovery_codes', 'otp_requests')
    `);
    const existingTableNames = new Set(tableRows.map((r) => r.table_name));

    assert(existingTableNames.has('user_credentials'), 'Table user_credentials exists');
    assert(existingTableNames.has('webauthn_challenges'), 'Table webauthn_challenges exists');
    assert(existingTableNames.has('user_recovery_codes'), 'Table user_recovery_codes exists');
    assert(!existingTableNames.has('otp_requests'), 'Obsolete table otp_requests is successfully dropped');

    // 4. Verify columns of user_credentials
    console.log('\n--- 4. Verifying user_credentials Columns ---');
    const { rows: credCols } = await client.query<{ column_name: string; data_type: string }>(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'user_credentials'
    `);
    const credColMap = new Map(credCols.map((c) => [c.column_name, c.data_type]));
    assert(credColMap.has('id'), 'user_credentials.id exists');
    assert(credColMap.has('user_id'), 'user_credentials.user_id exists');
    assert(credColMap.has('credential_id'), 'user_credentials.credential_id exists');
    assert(credColMap.get('public_key') === 'bytea', 'user_credentials.public_key is bytea');
    assert(credColMap.get('counter') === 'bigint', 'user_credentials.counter is bigint');
    assert(credColMap.has('device_type'), 'user_credentials.device_type exists');
    assert(credColMap.get('backed_up') === 'boolean', 'user_credentials.backed_up is boolean');
    assert(credColMap.get('transports') === 'ARRAY', 'user_credentials.transports is array');
    assert(credColMap.has('friendly_name'), 'user_credentials.friendly_name exists');
    assert(credColMap.has('created_at'), 'user_credentials.created_at exists');
    assert(credColMap.has('last_used_at'), 'user_credentials.last_used_at exists');

    // 5. Verify columns of webauthn_challenges
    console.log('\n--- 5. Verifying webauthn_challenges Columns ---');
    const { rows: chalCols } = await client.query<{ column_name: string; data_type: string }>(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'webauthn_challenges'
    `);
    const chalColMap = new Map(chalCols.map((c) => [c.column_name, c.data_type]));
    assert(chalColMap.has('id'), 'webauthn_challenges.id exists');
    assert(chalColMap.has('challenge'), 'webauthn_challenges.challenge exists');
    assert(chalColMap.has('user_id'), 'webauthn_challenges.user_id exists');
    assert(chalColMap.has('phone'), 'webauthn_challenges.phone exists');
    assert(chalColMap.has('flow_type'), 'webauthn_challenges.flow_type exists');
    assert(chalColMap.has('expires_at'), 'webauthn_challenges.expires_at exists');
    assert(chalColMap.has('consumed_at'), 'webauthn_challenges.consumed_at exists');
    assert(chalColMap.has('created_at'), 'webauthn_challenges.created_at exists');

    // 6. Verify columns of user_recovery_codes
    console.log('\n--- 6. Verifying user_recovery_codes Columns ---');
    const { rows: recCols } = await client.query<{ column_name: string; data_type: string }>(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'user_recovery_codes'
    `);
    const recColMap = new Map(recCols.map((c) => [c.column_name, c.data_type]));
    assert(recColMap.has('id'), 'user_recovery_codes.id exists');
    assert(recColMap.has('user_id'), 'user_recovery_codes.user_id exists');
    assert(recColMap.has('code_hash'), 'user_recovery_codes.code_hash exists');
    assert(recColMap.has('salt'), 'user_recovery_codes.salt exists');
    assert(recColMap.has('consumed_at'), 'user_recovery_codes.consumed_at exists');
    assert(recColMap.has('created_at'), 'user_recovery_codes.created_at exists');

    // 7. Verify users.token_version is preserved
    console.log('\n--- 7. Verifying users.token_version Preservation ---');
    const { rows: tokenVerCols } = await client.query<{ column_name: string; data_type: string }>(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'token_version'
    `);
    assert(tokenVerCols.length === 1, 'users.token_version exists');
    assert(tokenVerCols[0].data_type === 'integer', 'users.token_version is integer');

    // 8. Verify indexes
    console.log('\n--- 8. Verifying Required Indexes ---');
    const { rows: indexRows } = await client.query<{ indexname: string }>(`
      SELECT indexname FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname IN (
          'idx_user_credentials_user_id',
          'idx_user_credentials_cred_id',
          'idx_webauthn_challenges_lookup',
          'idx_webauthn_challenges_expires',
          'idx_webauthn_challenges_user_id',
          'idx_user_recovery_codes_user_id'
        )
    `);
    const indexNames = new Set(indexRows.map((r) => r.indexname));
    assert(indexNames.has('idx_user_credentials_user_id'), 'Index idx_user_credentials_user_id exists');
    assert(indexNames.has('idx_user_credentials_cred_id'), 'Index idx_user_credentials_cred_id exists');
    assert(indexNames.has('idx_webauthn_challenges_lookup'), 'Index idx_webauthn_challenges_lookup exists');
    assert(indexNames.has('idx_webauthn_challenges_expires'), 'Index idx_webauthn_challenges_expires exists');
    assert(indexNames.has('idx_webauthn_challenges_user_id'), 'Index idx_webauthn_challenges_user_id exists');
    assert(indexNames.has('idx_user_recovery_codes_user_id'), 'Index idx_user_recovery_codes_user_id exists');

    // 9. Constraints & Foreign Key Integrity
    console.log('\n--- 9. Verifying Integrity & Constraint Rules ---');
    const testUserId = '00000000-0000-0000-0000-000000000801';
    const testPhone = '9999900801';
    await client.query('DELETE FROM users WHERE phone = $1', [testPhone]);
    await client.query(
      `INSERT INTO users (id, phone, role, preferred_language, token_version)
       VALUES ($1, $2, 'customer', 'en', 3)`,
      [testUserId, testPhone]
    );

    // Foreign Key constraint on user_credentials
    let fkRejected = false;
    try {
      await client.query(
        `INSERT INTO user_credentials (user_id, credential_id, public_key)
         VALUES ('00000000-0000-0000-0000-999999999999', 'nonexistent-cred', $1)`,
        [Buffer.from('dummy_key')]
      );
    } catch (err: any) {
      if (err.code === '23503') fkRejected = true;
    }
    assert(fkRejected, 'user_credentials rejects non-existent user_id (23503 FK violation)');

    // Insert valid credential
    await client.query(
      `INSERT INTO user_credentials (user_id, credential_id, public_key, counter, device_type, backed_up, transports, friendly_name)
       VALUES ($1, 'cred-12345', $2, 1, 'single_device', false, ARRAY['internal'], 'Pixel Test')`,
      [testUserId, Buffer.from('test_public_key_bytes')]
    );
    assert(true, 'Inserted valid user_credential for test user');

    // Unique constraint on credential_id
    let uniqueCredRejected = false;
    try {
      await client.query(
        `INSERT INTO user_credentials (user_id, credential_id, public_key)
         VALUES ($1, 'cred-12345', $2)`,
        [testUserId, Buffer.from('another_key')]
      );
    } catch (err: any) {
      if (err.code === '23505') uniqueCredRejected = true;
    }
    assert(uniqueCredRejected, 'Duplicate credential_id rejected by unique constraint (23505)');

    // Insert challenge
    await client.query(
      `INSERT INTO webauthn_challenges (challenge, user_id, phone, flow_type, expires_at)
       VALUES ('challenge-abc-123', $1, $2, 'registration', NOW() + INTERVAL '5 minutes')`,
      [testUserId, testPhone]
    );
    assert(true, 'Inserted valid webauthn_challenge');

    // Unique challenge constraint
    let uniqueChallengeRejected = false;
    try {
      await client.query(
        `INSERT INTO webauthn_challenges (challenge, flow_type, expires_at)
         VALUES ('challenge-abc-123', 'login', NOW() + INTERVAL '5 minutes')`
      );
    } catch (err: any) {
      if (err.code === '23505') uniqueChallengeRejected = true;
    }
    assert(uniqueChallengeRejected, 'Duplicate challenge rejected by unique constraint (23505)');

    // Insert recovery code
    await client.query(
      `INSERT INTO user_recovery_codes (user_id, code_hash, salt)
       VALUES ($1, 'hash1234567890abcdef1234567890abcdef', 'salt1234')`,
      [testUserId]
    );
    assert(true, 'Inserted valid user_recovery_codes row');

    // Cascade delete verification: deleting user should delete credentials, challenges, and recovery codes
    await client.query('DELETE FROM users WHERE id = $1', [testUserId]);
    const { rows: remainingCreds } = await client.query('SELECT 1 FROM user_credentials WHERE user_id = $1', [testUserId]);
    const { rows: remainingChals } = await client.query('SELECT 1 FROM webauthn_challenges WHERE user_id = $1', [testUserId]);
    const { rows: remainingRecs } = await client.query('SELECT 1 FROM user_recovery_codes WHERE user_id = $1', [testUserId]);

    assert(remainingCreds.length === 0, 'Cascade delete: user_credentials removed on user deletion');
    assert(remainingChals.length === 0, 'Cascade delete: webauthn_challenges removed on user deletion');
    assert(remainingRecs.length === 0, 'Cascade delete: user_recovery_codes removed on user deletion');

    // 10. Existing Users, Providers, Bookings, Categories Intactness Check
    console.log('\n--- 10. Verifying Existing Data Intactness ---');
    const { rows: categoryCount } = await client.query<{ count: string }>('SELECT COUNT(*)::text as count FROM service_categories');
    assert(parseInt(categoryCount[0].count, 10) === 5, 'All 5 service categories intact');

    const { rows: configCount } = await client.query<{ count: string }>('SELECT COUNT(*)::text as count FROM app_configs');
    assert(parseInt(configCount[0].count, 10) === 3, 'All 3 app configs intact');

    const { rows: userList } = await client.query<{ id: string; role: string; token_version: number }>(
      'SELECT id, role, token_version FROM users'
    );
    console.log(`  Existing users in DB: ${userList.length}`);
    const tokenVersionsValid = userList.every((u) => typeof u.token_version === 'number' && u.token_version >= 1);
    assert(tokenVersionsValid, 'All users have valid token_version >= 1');

    console.log('\n============================================================');
    console.log(`MIGRATION 008 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED.`);
    console.log('============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration008Verification().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
