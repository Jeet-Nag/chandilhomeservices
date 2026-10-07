import pg from 'pg';
import { env } from '../src/config/env';
import { Migrator } from '../src/db/migrator';
import { i18n, en, hi, TranslationKey } from '@shared';

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

async function runMigration009Verification() {
  console.log('\n============================================================');
  console.log('CHANDIL HOME SERVICES - MIGRATION 009 & SHARED TYPES / i18n VERIFICATION');
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

    // 1. Run migrations to apply 009
    console.log('--- 1. Applying Pending Migrations (including 009) ---');
    const firstRun = await migrator.runMigrations();
    console.log(`  Applied: ${firstRun.applied.join(', ') || 'none'}`);
    console.log(`  Skipped: ${firstRun.skipped.length} existing migrations`);
    assert(
      firstRun.applied.includes('009_worker_onboarding_and_verification.sql') ||
        firstRun.skipped.includes('009_worker_onboarding_and_verification.sql'),
      'Migration 009_worker_onboarding_and_verification.sql was applied or previously applied'
    );

    // 2. Migration idempotency
    console.log('\n--- 2. Verifying Migration Idempotency ---');
    const secondRun = await migrator.runMigrations();
    assert(secondRun.applied.length === 0, 'Second migration run applied 0 files (fully idempotent)');

    // 3. Verify columns on provider_profiles
    console.log('\n--- 3. Verifying provider_profiles Extended Columns ---');
    const { rows: cols } = await client.query<{ column_name: string; data_type: string }>(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'provider_profiles'
    `);
    const colMap = new Map(cols.map((c) => [c.column_name, c.data_type]));

    assert(colMap.has('verification_status'), 'provider_profiles.verification_status exists');
    assert(colMap.get('verification_status') === 'character varying', 'verification_status is character varying');
    assert(colMap.get('aadhaar_front_data') === 'bytea', 'aadhaar_front_data is bytea');
    assert(colMap.get('aadhaar_front_mime') === 'character varying', 'aadhaar_front_mime is character varying');
    assert(colMap.get('aadhaar_back_data') === 'bytea', 'aadhaar_back_data is bytea');
    assert(colMap.get('aadhaar_back_mime') === 'character varying', 'aadhaar_back_mime is character varying');
    assert(colMap.get('photo_data') === 'bytea', 'photo_data is bytea');
    assert(colMap.get('photo_mime') === 'character varying', 'photo_mime is character varying');
    assert(colMap.get('submitted_at') === 'timestamp with time zone', 'submitted_at is timestamptz');
    assert(colMap.get('verified_at') === 'timestamp with time zone', 'verified_at is timestamptz');
    assert(colMap.get('verified_by') === 'uuid', 'verified_by is uuid');

    // 4. Verify indexes
    console.log('\n--- 4. Verifying Required Indexes ---');
    const { rows: indexRows } = await client.query<{ indexname: string }>(`
      SELECT indexname FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname IN (
          'idx_provider_profiles_verification_status',
          'idx_provider_profiles_category_id'
        )
    `);
    const indexNames = new Set(indexRows.map((r) => r.indexname));
    assert(
      indexNames.has('idx_provider_profiles_verification_status'),
      'Index idx_provider_profiles_verification_status exists'
    );
    assert(
      indexNames.has('idx_provider_profiles_category_id'),
      'Index idx_provider_profiles_category_id exists'
    );

    // 5. Existing provider profiles verification status migration check
    console.log('\n--- 5. Verifying Existing Provider Profiles are VERIFIED ---');
    const { rows: existingProviders } = await client.query<{
      user_id: string;
      role: string;
      verification_status: string;
    }>(`
      SELECT pp.user_id, u.role, pp.verification_status 
      FROM provider_profiles pp
      JOIN users u ON pp.user_id = u.id
      WHERE u.role = 'provider'
    `);
    const allExistingVerified = existingProviders.every((p) => p.verification_status === 'VERIFIED');
    assert(
      allExistingVerified,
      `All existing provider users in provider_profiles are marked 'VERIFIED' (count: ${existingProviders.length})`
    );

    // 6. Test Data Operations & Foreign Key Constraints
    console.log('\n--- 6. Verifying Worker Lifecycle Insertion & Constraints ---');
    const testAdminId = '00000000-0000-0000-0000-000000000901';
    const testAdminPhone = '9999900901';
    const testWorkerId = '00000000-0000-0000-0000-000000000902';
    const testWorkerPhone = '9999900902';

    // Cleanup previous runs if any
    await client.query('DELETE FROM users WHERE phone IN ($1, $2)', [testAdminPhone, testWorkerPhone]);

    // Insert Admin
    await client.query(
      `INSERT INTO users (id, phone, full_name, role, preferred_language)
       VALUES ($1, $2, 'Admin Tester', 'admin', 'en')`,
      [testAdminId, testAdminPhone]
    );

    // Insert Worker as role='customer' initially
    await client.query(
      `INSERT INTO users (id, phone, full_name, role, preferred_language)
       VALUES ($1, $2, 'Worker Ram', 'customer', 'hi')`,
      [testWorkerId, testWorkerPhone]
    );

    // Insert Pending Worker Profile
    const dummyBytes = Buffer.from('image_bytes_12345');
    await client.query(
      `INSERT INTO provider_profiles (
         user_id, category_id, service_area, verification_status,
         aadhaar_front_data, aadhaar_front_mime,
         aadhaar_back_data, aadhaar_back_mime,
         photo_data, photo_mime, submitted_at
       ) VALUES ($1, 'electrician', 'Chandil', 'PENDING_VERIFICATION', $2, 'image/jpeg', $2, 'image/jpeg', $2, 'image/jpeg', NOW())`,
      [testWorkerId, dummyBytes]
    );

    const { rows: insertedProfile } = await client.query<{
      verification_status: string;
      category_id: string;
      aadhaar_front_mime: string;
    }>('SELECT verification_status, category_id, aadhaar_front_mime FROM provider_profiles WHERE user_id = $1', [testWorkerId]);

    assert(insertedProfile.length === 1, 'Worker profile inserted successfully');
    assert(insertedProfile[0].verification_status === 'PENDING_VERIFICATION', 'Initial status is PENDING_VERIFICATION');
    assert(insertedProfile[0].aadhaar_front_mime === 'image/jpeg', 'Aadhaar mime type stored correctly');

    // Test Foreign Key on verified_by with non-existent user
    let fkRejected = false;
    try {
      await client.query(
        `UPDATE provider_profiles 
         SET verification_status = 'VERIFIED', verified_by = '00000000-0000-0000-0000-999999999999' 
         WHERE user_id = $1`,
        [testWorkerId]
      );
    } catch (err: any) {
      if (err.code === '23503') fkRejected = true;
    }
    assert(fkRejected, 'Invalid verified_by UUID correctly rejected by FK constraint (23503)');

    // Legitimate verification by Admin
    await client.query(
      `UPDATE provider_profiles 
       SET verification_status = 'VERIFIED', verified_at = NOW(), verified_by = $1 
       WHERE user_id = $2`,
      [testAdminId, testWorkerId]
    );
    await client.query("UPDATE users SET role = 'provider' WHERE id = $1", [testWorkerId]);

    const { rows: verifiedProfile } = await client.query<{
      verification_status: string;
      verified_by: string;
      role: string;
    }>(`
      SELECT pp.verification_status, pp.verified_by, u.role
      FROM provider_profiles pp
      JOIN users u ON pp.user_id = u.id
      WHERE pp.user_id = $1
    `, [testWorkerId]);

    assert(verifiedProfile[0].verification_status === 'VERIFIED', 'Worker profile marked VERIFIED');
    assert(verifiedProfile[0].verified_by === testAdminId, 'verified_by correctly records admin UUID');
    assert(verifiedProfile[0].role === 'provider', 'User role upgraded to provider upon verification');

    // Cleanup test users (verifies cascade delete)
    await client.query('DELETE FROM users WHERE id = $1', [testWorkerId]);
    const { rows: remainingWorkerProfile } = await client.query('SELECT 1 FROM provider_profiles WHERE user_id = $1', [testWorkerId]);
    assert(remainingWorkerProfile.length === 0, 'Cascade delete: provider_profiles row removed when user deleted');

    await client.query('DELETE FROM users WHERE id = $1', [testAdminId]);

    // 7. Verify Shared i18n & Translation Keys
    console.log('\n--- 7. Verifying Shared i18n Onboarding Keys ---');
    const requiredKeys: TranslationKey[] = [
      'onboarding.role_title',
      'onboarding.role_customer',
      'onboarding.role_customer_sub',
      'onboarding.role_worker',
      'onboarding.role_worker_sub',
      'onboarding.returning_user_sign_in',
      'onboarding.customer_title',
      'onboarding.full_name_required',
      'onboarding.full_name_placeholder',
      'onboarding.customer_create_passkey',
      'onboarding.worker_title',
      'onboarding.worker_setup_title',
      'onboarding.worker_setup_sub',
      'onboarding.work_category_label',
      'onboarding.select_category_prompt',
      'onboarding.aadhaar_title',
      'onboarding.aadhaar_sub',
      'onboarding.aadhaar_front_label',
      'onboarding.aadhaar_back_label',
      'onboarding.btn_camera',
      'onboarding.btn_gallery',
      'onboarding.btn_retake',
      'onboarding.btn_confirm_photo',
      'onboarding.btn_replace',
      'onboarding.photo_title',
      'onboarding.photo_sub',
      'onboarding.btn_take_photo',
      'onboarding.btn_choose_gallery',
      'onboarding.btn_switch_camera',
      'onboarding.btn_use_photo',
      'onboarding.btn_submit_profile',
      'onboarding.submitting_profile',
      'onboarding.submitted_success',
      'onboarding.pending_verification_title',
      'onboarding.pending_verification_desc',
      'onboarding.status_check_btn',
      'admin.verify_worker',
      'admin.verifying_worker',
      'admin.worker_verified_success',
      'admin.aadhaar_front',
      'admin.aadhaar_back',
      'admin.worker_photo',
      'admin.filter_pending_verification',
      'admin.filter_verified',
      'worker.verified_badge',
      'worker.verified_tick',
      'customer.verified_workers_title',
      'customer.no_verified_workers',
    ];

    let allEnPresent = true;
    let allHiPresent = true;

    for (const key of requiredKeys) {
      if (!en[key]) {
        console.error(`  [FAIL] Missing English key: ${key}`);
        allEnPresent = false;
      }
      if (!hi[key]) {
        console.error(`  [FAIL] Missing Hindi key: ${key}`);
        allHiPresent = false;
      }
    }

    assert(allEnPresent, `All ${requiredKeys.length} onboarding keys exist in English dictionary`);
    assert(allHiPresent, `All ${requiredKeys.length} onboarding keys exist in Hindi dictionary`);

    // Verify key translations exact match against specs
    assert(i18n.t('onboarding.role_title', undefined, 'en') === 'Who are you?', 'English role title matches spec');
    assert(i18n.t('onboarding.role_title', undefined, 'hi') === 'आप कौन हैं?', 'Hindi role title matches spec');
    assert(i18n.t('onboarding.role_customer', undefined, 'en') === 'Customer', 'English Customer role matches spec');
    assert(i18n.t('onboarding.role_customer', undefined, 'hi') === 'ग्राहक', 'Hindi Customer role matches spec');
    assert(i18n.t('onboarding.role_worker', undefined, 'en') === 'Worker', 'English Worker role matches spec');
    assert(i18n.t('onboarding.role_worker', undefined, 'hi') === 'काम करने वाले', 'Hindi Worker role matches spec');

    console.log('\n============================================================');
    console.log(`MIGRATION 009 & i18n VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED.`);
    console.log('============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration009Verification().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
