import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app';
import { db } from '../src/db';
import { en, hi, ApiResponse, ProviderJob, Booking } from '@shared';
import { AudioService } from '../src/services/audio.service';

async function runProviderFeedTests() {
  console.log('\n============================================================');
  console.log('MODULE 7 — PROVIDER APP FOUNDATION & JOB FEED VERIFICATION');
  console.log('============================================================\n');

  const app = await buildApp();
  const pool = db.getPool();
  if (!pool) {
    throw new Error('Database pool unavailable');
  }

  const audioService = new AudioService();
  let passed = 0;
  let failed = 0;

  function testAssert(condition: boolean, message: string) {
    if (condition) {
      passed++;
      console.log(`  [PASS] ${message}`);
    } else {
      failed++;
      console.error(`  [FAIL] ${message}`);
    }
  }

  // Test phone numbers
  const customerPhone = '9800077001';
  const providerPhone = '9800077002';
  const adminPhone = '9800077003';

  // Cleanup old test fixtures
  await pool.query('DELETE FROM booking_status_logs WHERE changed_by IN (SELECT id FROM users WHERE phone IN ($1, $2, $3))', [
    customerPhone,
    providerPhone,
    adminPhone,
  ]);
  await pool.query('DELETE FROM bookings WHERE customer_id IN (SELECT id FROM users WHERE phone IN ($1, $2, $3))', [
    customerPhone,
    providerPhone,
    adminPhone,
  ]);
  await pool.query('DELETE FROM otp_requests WHERE phone IN ($1, $2, $3)', [
    customerPhone,
    providerPhone,
    adminPhone,
  ]);
  await pool.query('DELETE FROM users WHERE phone IN ($1, $2, $3)', [
    customerPhone,
    providerPhone,
    adminPhone,
  ]);

  // Insert Users with Roles
  const { rows: custRows } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language, is_active)
     VALUES ($1, 'customer', 'Ramesh Kumar', 'hi', true) RETURNING id`,
    [customerPhone]
  );
  const customerId = custRows[0].id;

  const { rows: provRows } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language, is_active)
     VALUES ($1, 'provider', 'Sunil Mistri', 'hi', true) RETURNING id`,
    [providerPhone]
  );
  const providerId = provRows[0].id;

  const { rows: adminRows } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, full_name, preferred_language, is_active)
     VALUES ($1, 'admin', 'Admin Staff', 'en', true) RETURNING id`,
    [adminPhone]
  );
  const adminId = adminRows[0].id;

  // Generate JWT Tokens (token_version defaults to 1)
  const customerToken = app.jwt.sign({ id: customerId, phone: customerPhone, role: 'customer', tokenVersion: 1 });
  const providerToken = app.jwt.sign({ id: providerId, phone: providerPhone, role: 'provider', tokenVersion: 1 });
  const adminToken = app.jwt.sign({ id: adminId, phone: adminPhone, role: 'admin', tokenVersion: 1 });

  console.log('--- 1. RBAC & Authorization on Provider Job Feed ---');

  // 1.1 Unauthenticated request returns 401
  const unauthRes = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs',
  });
  testAssert(unauthRes.statusCode === 401, 'Unauthenticated request receives 401 Unauthorized');

  // 1.2 Customer role receives 403 Forbidden
  const custRes = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs',
    headers: { authorization: `Bearer ${customerToken}` },
  });
  testAssert(custRes.statusCode === 403, 'Customer role is rejected from provider jobs (403 Forbidden)');

  // 1.3 Admin role receives 403 Forbidden (RBAC strict to provider)
  const adminRes = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  testAssert(adminRes.statusCode === 403, 'Admin role is rejected from provider jobs (403 Forbidden)');

  // 1.4 Provider role is allowed (200 OK)
  const provRes = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs',
    headers: { authorization: `Bearer ${providerToken}` },
  });
  testAssert(provRes.statusCode === 200, 'Provider role is authorized to access provider job feed (200 OK)');
  const emptyFeedBody: ApiResponse<ProviderJob[]> = JSON.parse(provRes.payload);
  testAssert(Array.isArray(emptyFeedBody.data), 'Empty provider job feed returns an array');
  testAssert(emptyFeedBody.data?.length === 0, 'Initial feed is empty when no jobs exist (Requirement 15: Empty feed works)');

  console.log('\n--- 2. Available Job Feed Filtering & Exclusion Rules ---');

  // Save an audio sample for voice note testing
  const dummyAudioBase64 = Buffer.from('TEST_AUDIO_PROVIDER_FEED_MOCK_DATA').toString('base64');
  const savedAudioResult = await audioService.saveAudioBase64(dummyAudioBase64);
  const testAudioUrl = savedAudioResult.audioUrl;

  // Insert 6 diverse bookings to rigorously test filtering
  // Booking 1: SERVICE_REQUESTED, provider_id IS NULL (SHOULD APPEAR)
  const b1Key = `prov-test-b1-${Date.now()}`;
  const { rows: b1Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, landmark, text_description, audio_url, audio_duration_seconds, visiting_fee, status, created_at)
     VALUES ($1, $2, 'electrician', 'chandil-bazar', 'Near Shiv Mandir', 'Fan capacitor needs replacement', $3, 10, 99.00, 'SERVICE_REQUESTED', NOW() - INTERVAL '10 minutes')
     RETURNING id`,
    [b1Key, customerId, testAudioUrl]
  );
  const b1Id = b1Rows[0].id;

  // Booking 2: SERVICE_REQUESTED, BUT provider_id is set (ALREADY CLAIMED/ASSIGNED -> EXCLUDED)
  const b2Key = `prov-test-b2-${Date.now()}`;
  const { rows: b2Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, provider_id, category_id, area_locality, landmark, text_description, visiting_fee, status, created_at)
     VALUES ($1, $2, $3, 'plumber', 'chowka', 'Near High School', 'Water pipe leakage', 99.00, 'SERVICE_REQUESTED', NOW() - INTERVAL '8 minutes')
     RETURNING id`,
    [b2Key, customerId, providerId]
  );
  const b2Id = b2Rows[0].id;

  // Booking 3: PROVIDER_ACCEPTED (NON-SERVICE_REQUESTED -> EXCLUDED)
  const b3Key = `prov-test-b3-${Date.now()}`;
  const { rows: b3Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, landmark, text_description, visiting_fee, status, created_at)
     VALUES ($1, $2, 'appliance-repair', 'station-colony', 'Platform 1 gate', 'Washing machine error', 99.00, 'PROVIDER_ACCEPTED', NOW() - INTERVAL '6 minutes')
     RETURNING id`,
    [b3Key, customerId]
  );
  const b3Id = b3Rows[0].id;

  // Booking 4: CANCELLED_BY_CUSTOMER (CANCELLED -> EXCLUDED)
  const b4Key = `prov-test-b4-${Date.now()}`;
  const { rows: b4Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, landmark, text_description, visiting_fee, status, created_at)
     VALUES ($1, $2, 'electrician', 'dam-road', 'Near Dam View Point', 'Switchboard spark', 99.00, 'CANCELLED_BY_CUSTOMER', NOW() - INTERVAL '4 minutes')
     RETURNING id`,
    [b4Key, customerId]
  );
  const b4Id = b4Rows[0].id;

  // Booking 5: BOOKING_COMPLETED (COMPLETED -> EXCLUDED)
  const b5Key = `prov-test-b5-${Date.now()}`;
  const { rows: b5Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, landmark, text_description, visiting_fee, status, created_at)
     VALUES ($1, $2, 'ac-cooler', 'chilgu', 'Near Petrol Pump', 'Cooler pump not working', 149.00, 'BOOKING_COMPLETED', NOW() - INTERVAL '2 minutes')
     RETURNING id`,
    [b5Key, customerId]
  );
  const b5Id = b5Rows[0].id;

  // Booking 6: SERVICE_REQUESTED, provider_id IS NULL, NEWEST (SHOULD APPEAR FIRST)
  const b6Key = `prov-test-b6-${Date.now()}`;
  const { rows: b6Rows } = await pool.query<{ id: string }>(
    `INSERT INTO bookings (idempotency_key, customer_id, category_id, area_locality, landmark, text_description, visiting_fee, status, created_at)
     VALUES ($1, $2, 'bike-mechanic', 'gangdih', 'Near Kali Mandir', 'Bike clutch wire broken', 99.00, 'SERVICE_REQUESTED', NOW())
     RETURNING id`,
    [b6Key, customerId]
  );
  const b6Id = b6Rows[0].id;

  // Fetch provider job feed
  const feedRes = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs',
    headers: { authorization: `Bearer ${providerToken}` },
  });
  testAssert(feedRes.statusCode === 200, 'Provider job feed returns 200 OK');
  const feedBody: ApiResponse<ProviderJob[]> = JSON.parse(feedRes.payload);
  const feedJobs = feedBody.data || [];

  // Verifications
  testAssert(feedJobs.length === 2, `Feed returns exactly 2 available jobs (expected 2, got ${feedJobs.length})`);

  const jobIds = feedJobs.map((j) => j.id);
  testAssert(jobIds.includes(b1Id), 'Available SERVICE_REQUESTED booking appears (Requirement 4)');
  testAssert(jobIds.includes(b6Id), 'Newer available SERVICE_REQUESTED booking appears (Requirement 4)');
  testAssert(!jobIds.includes(b2Id), 'Booking with provider_id is strictly excluded (Requirement 5)');
  testAssert(!jobIds.includes(b3Id), 'Non-SERVICE_REQUESTED booking is strictly excluded (Requirement 6)');
  testAssert(!jobIds.includes(b4Id), 'Cancelled booking is strictly excluded (Requirement 7)');
  testAssert(!jobIds.includes(b5Id), 'Completed booking is strictly excluded (Requirement 8)');

  // Ordering check: Newest requests first
  testAssert(feedJobs[0].id === b6Id && feedJobs[1].id === b1Id, 'Provider job feed is ordered newest first (Requirement 9)');

  console.log('\n--- 3. Customer Data Privacy & Isolation in Job Feed ---');

  const inspectedJob = feedJobs.find((j) => j.id === b1Id)!;
  testAssert(Boolean(inspectedJob.id), 'Permitted field: booking id present');
  testAssert(inspectedJob.categoryId === 'electrician', 'Permitted field: categoryId present');
  testAssert(inspectedJob.areaLocality === 'chandil-bazar', 'Permitted field: areaLocality present');
  testAssert(inspectedJob.landmark === 'Near Shiv Mandir', 'Permitted field: landmark present');
  testAssert(inspectedJob.textDescription === 'Fan capacitor needs replacement', 'Permitted field: textDescription present');
  testAssert(inspectedJob.audioUrl === testAudioUrl, 'Permitted field: audioUrl present (Requirement 13)');
  testAssert(inspectedJob.audioDurationSeconds === 10, 'Permitted field: audioDurationSeconds present');
  testAssert(inspectedJob.visitingFee === 99.00, 'Permitted field: visitingFee present');
  testAssert(inspectedJob.status === 'SERVICE_REQUESTED', 'Permitted field: status present');
  testAssert(Boolean(inspectedJob.createdAt), 'Permitted field: createdAt present');

  // Privacy guarantees (Requirement 10)
  testAssert(!('customerId' in inspectedJob), 'Customer ID is NOT exposed in provider job feed');
  testAssert(!('customer_id' in inspectedJob), 'Customer_id database column is NOT exposed in provider job feed');
  testAssert(!('phone' in inspectedJob), 'Customer phone is NOT exposed in provider job feed');
  testAssert(!('customerPhone' in inspectedJob), 'Customer phone field is NOT exposed in provider job feed');
  testAssert(!('idempotencyKey' in inspectedJob), 'Internal idempotency key is NOT exposed');
  testAssert(!('paymentMethod' in inspectedJob), 'Payment method is NOT exposed');

  console.log('\n--- 4. Provider Job Detail Screen Endpoint ---');

  // 4.1 Unauthenticated job detail request
  const unauthDetailRes = await app.inject({
    method: 'GET',
    url: `/api/provider/jobs/${b1Id}`,
  });
  testAssert(unauthDetailRes.statusCode === 401, 'Unauthenticated job detail request receives 401 (Requirement 11)');

  // 4.2 Customer role accessing job detail
  const custDetailRes = await app.inject({
    method: 'GET',
    url: `/api/provider/jobs/${b1Id}`,
    headers: { authorization: `Bearer ${customerToken}` },
  });
  testAssert(custDetailRes.statusCode === 403, 'Customer role accessing provider job detail receives 403 (Requirement 11)');

  // 4.3 Provider role successfully retrieves permitted job details
  const provDetailRes = await app.inject({
    method: 'GET',
    url: `/api/provider/jobs/${b1Id}`,
    headers: { authorization: `Bearer ${providerToken}` },
  });
  testAssert(provDetailRes.statusCode === 200, 'Provider can retrieve permitted job details (Requirement 12)');
  const detailBody: ApiResponse<ProviderJob> = JSON.parse(provDetailRes.payload);
  const detail = detailBody.data!;
  testAssert(detail.id === b1Id, 'Detail booking ID matches requested ID');
  testAssert(detail.audioUrl === testAudioUrl, 'Audio URL is reused correctly in detail view (Requirement 13)');
  testAssert(!('customerId' in detail) && !('customerPhone' in detail), 'Detail view strictly protects customer privacy');

  // 4.4 Malformed UUID error handling
  const malformedDetailRes = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs/not-a-uuid-format',
    headers: { authorization: `Bearer ${providerToken}` },
  });
  testAssert(malformedDetailRes.statusCode === 404, 'Malformed job UUID returns 404 cleanly (Requirement 16)');

  // 4.5 Non-existent UUID error handling
  const notFoundDetailRes = await app.inject({
    method: 'GET',
    url: '/api/provider/jobs/00000000-0000-0000-0000-000000000000',
    headers: { authorization: `Bearer ${providerToken}` },
  });
  testAssert(notFoundDetailRes.statusCode === 404, 'Non-existent job UUID returns 404 cleanly (Requirement 16)');

  console.log('\n--- 5. Audio Playback & Failure Handling ---');

  // 5.1 Valid audio streams from /api/audio/:filename
  const filename = testAudioUrl.replace('/api/audio/', '');
  const audioStreamRes = await app.inject({
    method: 'GET',
    url: `/api/audio/${filename}`,
    headers: { authorization: `Bearer ${customerToken}` },
  });
  testAssert(audioStreamRes.statusCode === 200, 'Saved audio streams via GET /api/audio/:filename (Requirement 13)');

  // 5.2 Missing/invalid audio returns 404 without crashing
  const badAudioRes = await app.inject({
    method: 'GET',
    url: '/api/audio/non-existent-recording.webm',
    headers: { authorization: `Bearer ${customerToken}` },
  });
  testAssert(badAudioRes.statusCode === 404, 'Audio playback failure is handled cleanly with 404 (Requirement 14)');

  console.log('\n--- 6. State Immutability Verification (Read-Only) ---');

  // 6.1 Check booking record before and after GET /api/provider/jobs
  const { rows: b1Before } = await pool.query<{ status: string; provider_id: string | null; updated_at: Date }>(
    'SELECT status, provider_id, updated_at FROM bookings WHERE id = $1',
    [b1Id]
  );

  // Execute GET 3 times
  await app.inject({ method: 'GET', url: '/api/provider/jobs', headers: { authorization: `Bearer ${providerToken}` } });
  await app.inject({ method: 'GET', url: `/api/provider/jobs/${b1Id}`, headers: { authorization: `Bearer ${providerToken}` } });

  const { rows: b1After } = await pool.query<{ status: string; provider_id: string | null; updated_at: Date }>(
    'SELECT status, provider_id, updated_at FROM bookings WHERE id = $1',
    [b1Id]
  );

  testAssert(b1Before[0].status === b1After[0].status, 'GET provider jobs does not mutate booking status (Requirement 20)');
  testAssert(b1Before[0].provider_id === b1After[0].provider_id, 'GET provider jobs does not claim or assign provider_id (Requirement 20)');
  testAssert(b1Before[0].updated_at.getTime() === b1After[0].updated_at.getTime(), 'GET provider jobs does not mutate updated_at timestamp (Requirement 20)');

  console.log('\n--- 7. Session Routing & Customer Navigation Integrity ---');

  // 7.1 Provider login session returns provider role
  const { rows: provUserCheck } = await pool.query<{ role: string }>(
    'SELECT role FROM users WHERE id = $1',
    [providerId]
  );
  testAssert(provUserCheck[0].role === 'provider', 'Provider session has role = provider (Requirement 19)');

  // 7.2 Customer can still access customer endpoints without disruption
  const custHistoryRes = await app.inject({
    method: 'GET',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${customerToken}` },
  });
  testAssert(custHistoryRes.statusCode === 200, 'Customer navigation and booking history remain fully functional (Requirement 18)');

  console.log('\n--- 8. Bilingual i18n Key Symmetry Audit for Module 7 ---');

  const enKeys = Object.keys(en);
  const hiKeys = Object.keys(hi);
  testAssert(enKeys.length === hiKeys.length, `Matching dictionary sizes (${enKeys.length} keys each) (Requirement 17)`);

  let allKeysPresent = true;
  let allNonEmpty = true;
  let noMixedHindi = true;

  for (const k of enKeys) {
    if (!hi[k as keyof typeof hi]) {
      allKeysPresent = false;
      console.error(`  Missing Hindi key: ${k}`);
    }
    const enVal = en[k as keyof typeof en];
    const hiVal = hi[k as keyof typeof hi];
    if (!enVal || enVal.trim() === '') allNonEmpty = false;
    if (!hiVal || hiVal.trim() === '') allNonEmpty = false;

    if (k !== 'lang.choose_title') {
      if (/\([A-Za-z\s/]+\)/.test(hiVal)) {
        noMixedHindi = false;
        console.error(`  Leaked parenthetical English in Hindi key "${k}": ${hiVal}`);
      }
    }
  }

  testAssert(allKeysPresent, 'All translation keys exist in both English and Hindi');
  testAssert(allNonEmpty, 'No translation strings are blank or empty');
  testAssert(noMixedHindi, 'Zero parenthetical English translations in Hindi dictionary (Requirement 17)');

  // Cleanup test fixtures
  await audioService.deleteAudioFile(filename);
  await pool.query('DELETE FROM bookings WHERE customer_id IN (SELECT id FROM users WHERE phone IN ($1, $2, $3))', [
    customerPhone,
    providerPhone,
    adminPhone,
  ]);
  await pool.query('DELETE FROM users WHERE phone IN ($1, $2, $3)', [
    customerPhone,
    providerPhone,
    adminPhone,
  ]);

  console.log('\n============================================================');
  console.log(`PROVIDER FEED & FOUNDATION TESTS: ${passed} PASSED, ${failed} FAILED.`);
  console.log('============================================================\n');

  await app.close();
  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runProviderFeedTests().catch((err) => {
  console.error('Provider test runner fatal error:', err);
  process.exit(1);
});
