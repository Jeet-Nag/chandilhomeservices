import { buildApp } from '../src/app';
import { db } from '../src/db';
import { ApiResponse, Booking, BookingDetail, BookingStatus, en, hi } from '@shared';

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

async function runBookingStatusTests() {
  console.log('\n============================================================');
  console.log('CHANDIL HOME SERVICES - MODULE 6 STATUS & HISTORY VERIFICATION');
  console.log('============================================================\n');

  const app = await buildApp();
  const pool = db.getPool();
  if (!pool) {
    console.error('Fatal: DB pool unavailable.');
    process.exit(1);
  }

  const customer1Phone = '9876543601';
  const customer2Phone = '9876543602';
  const customerEmptyPhone = '9876543603';
  const providerPhone = '9876543604';
  const testOtp = process.env.DEV_MOCK_OTP || '1234';

  // 1. Cleanup old test fixtures
  await pool.query(
    'DELETE FROM booking_status_logs WHERE changed_by IN (SELECT id FROM users WHERE phone IN ($1, $2, $3, $4))',
    [customer1Phone, customer2Phone, customerEmptyPhone, providerPhone]
  );
  await pool.query(
    'DELETE FROM bookings WHERE customer_id IN (SELECT id FROM users WHERE phone IN ($1, $2, $3, $4))',
    [customer1Phone, customer2Phone, customerEmptyPhone, providerPhone]
  );
  await pool.query(
    'DELETE FROM otp_requests WHERE phone IN ($1, $2, $3, $4)',
    [customer1Phone, customer2Phone, customerEmptyPhone, providerPhone]
  );
  await pool.query(
    'DELETE FROM users WHERE phone IN ($1, $2, $3, $4)',
    [customer1Phone, customer2Phone, customerEmptyPhone, providerPhone]
  );

  // 2. Pre-seed users
  const { rows: users } = await pool.query(
    `INSERT INTO users (phone, role, preferred_language, full_name)
     VALUES ($1, 'customer', 'en', 'Customer One'),
            ($2, 'customer', 'hi', 'Customer Two'),
            ($3, 'customer', 'hi', 'Customer Zero'),
            ($4, 'provider', 'hi', 'Technician Ramesh')
     RETURNING id, phone, role`,
    [customer1Phone, customer2Phone, customerEmptyPhone, providerPhone]
  );

  const c1Id = users.find((u) => u.phone === customer1Phone)!.id;
  const c2Id = users.find((u) => u.phone === customer2Phone)!.id;
  const cEmptyId = users.find((u) => u.phone === customerEmptyPhone)!.id;
  const provId = users.find((u) => u.phone === providerPhone)!.id;

  // Authenticate Customer 1
  await app.inject({ method: 'POST', url: '/api/auth/request-otp', payload: { phone: customer1Phone } });
  const auth1Res = await app.inject({ method: 'POST', url: '/api/auth/verify-otp', payload: { phone: customer1Phone, otp: testOtp } });
  const token1 = JSON.parse(auth1Res.payload).data.token;

  // Authenticate Customer 2
  await app.inject({ method: 'POST', url: '/api/auth/request-otp', payload: { phone: customer2Phone } });
  const auth2Res = await app.inject({ method: 'POST', url: '/api/auth/verify-otp', payload: { phone: customer2Phone, otp: testOtp } });
  const token2 = JSON.parse(auth2Res.payload).data.token;

  // Authenticate Customer with Zero Bookings
  await app.inject({ method: 'POST', url: '/api/auth/request-otp', payload: { phone: customerEmptyPhone } });
  const authEmptyRes = await app.inject({ method: 'POST', url: '/api/auth/verify-otp', payload: { phone: customerEmptyPhone, otp: testOtp } });
  const tokenEmpty = JSON.parse(authEmptyRes.payload).data.token;

  // Authenticate Provider
  await app.inject({ method: 'POST', url: '/api/auth/request-otp', payload: { phone: providerPhone } });
  const authPRes = await app.inject({ method: 'POST', url: '/api/auth/verify-otp', payload: { phone: providerPhone, otp: testOtp } });
  const tokenP = JSON.parse(authPRes.payload).data.token;

  console.log('--- 1. Seed Multiple Real Bookings with Timestamps & Status Logs ---');

  // Customer 1: Booking A (Earlier timestamp)
  const bookingAKey = `book-${Date.now()}-c1-a`;
  const bookingARes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${token1}` },
    payload: {
      idempotencyKey: bookingAKey,
      categoryId: 'electrician',
      areaLocality: 'chandil-bazar',
      landmark: 'Near Bazar Mandir',
      textDescription: 'Light flickering in living room',
    },
  });
  assert(bookingARes.statusCode === 201, 'Booking A created successfully');
  const bookingAId = JSON.parse(bookingARes.payload).data.id;

  // Customer 1: Booking B (Later timestamp with voice note)
  const bookingBKey = `book-${Date.now()}-c1-b`;
  const dummyAudioBase64 = Buffer.alloc(10000, 0x12).toString('base64');
  const bookingBRes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${token1}` },
    payload: {
      idempotencyKey: bookingBKey,
      categoryId: 'plumber',
      areaLocality: 'station-colony',
      landmark: 'Quarter 12/B',
      audioBase64: dummyAudioBase64,
      audioDurationSeconds: 5,
    },
  });
  assert(bookingBRes.statusCode === 201, 'Booking B created successfully with voice note');
  const bookingBId = JSON.parse(bookingBRes.payload).data.id;
  const bookingBAudioUrl = JSON.parse(bookingBRes.payload).data.audioUrl;

  // Customer 2: Booking C (Belongs to Customer 2)
  const bookingCKey = `book-${Date.now()}-c2-c`;
  const bookingCRes = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${token2}` },
    payload: {
      idempotencyKey: bookingCKey,
      categoryId: 'appliance-repair',
      areaLocality: 'chowka',
      textDescription: 'TV display is black',
    },
  });
  assert(bookingCRes.statusCode === 201, 'Booking C created for Customer 2');
  const bookingCId = JSON.parse(bookingCRes.payload).data.id;

  console.log('\n--- 2. Customer Booking Ownership & Detail Access Guards ---');

  // 2.1 Customer 1 can retrieve own booking A
  const getARes = await app.inject({
    method: 'GET',
    url: `/api/bookings/${bookingAId}`,
    headers: { authorization: `Bearer ${token1}` },
  });
  assert(getARes.statusCode === 200, 'Customer 1 can retrieve own Booking A (200 OK)');
  const detailA: BookingDetail = JSON.parse(getARes.payload).data;
  assert(detailA.id === bookingAId, 'Returned booking ID matches Booking A');
  assert(detailA.customerId === c1Id, 'Returned booking customer_id matches authenticated user');
  assert(detailA.categoryId === 'electrician', 'Category matches electrician');

  // 2.2 Customer 2 CANNOT retrieve Customer 1 Booking A (403 Forbidden)
  const crossCustomerRes = await app.inject({
    method: 'GET',
    url: `/api/bookings/${bookingAId}`,
    headers: { authorization: `Bearer ${token2}` },
  });
  assert(crossCustomerRes.statusCode === 403, 'Customer 2 is forbidden from accessing Customer 1 booking (403 Forbidden)');

  // 2.3 Unauthenticated access is rejected with 401
  const unauthRes = await app.inject({
    method: 'GET',
    url: `/api/bookings/${bookingAId}`,
  });
  assert(unauthRes.statusCode === 401, 'Unauthenticated GET /api/bookings/:id returns 401 Unauthorized');

  // 2.4 Wrong role (provider) trying to access customer booking list is rejected with 403
  const providerListRes = await app.inject({
    method: 'GET',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenP}` },
  });
  assert(providerListRes.statusCode === 403, 'Provider role is rejected from GET /api/bookings (403 Forbidden)');

  // 2.5 Invalid or non-existent booking IDs handled safely
  const badUuidRes = await app.inject({
    method: 'GET',
    url: '/api/bookings/not-a-valid-uuid',
    headers: { authorization: `Bearer ${token1}` },
  });
  assert(badUuidRes.statusCode === 404, 'Malformed booking ID returns 404 safely without 500 error');

  const nonExistentUuidRes = await app.inject({
    method: 'GET',
    url: '/api/bookings/00000000-0000-0000-0000-000000000000',
    headers: { authorization: `Bearer ${token1}` },
  });
  assert(nonExistentUuidRes.statusCode === 404, 'Non-existent UUID returns 404 BOOKING_NOT_FOUND');

  console.log('\n--- 3. Customer Booking History List & Ordering ---');

  // 3.1 Customer 1 booking list contains only Customer 1 bookings
  const list1Res = await app.inject({
    method: 'GET',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${token1}` },
  });
  assert(list1Res.statusCode === 200, 'Customer 1 can list bookings (200 OK)');
  const list1Data: Booking[] = JSON.parse(list1Res.payload).data;
  assert(Array.isArray(list1Data), 'Booking history is an array');
  assert(list1Data.length === 2, `Customer 1 has exactly 2 bookings (got: ${list1Data.length})`);
  assert(
    list1Data.every((b) => b.customerId === c1Id),
    'All returned bookings strictly belong to Customer 1'
  );
  assert(
    !list1Data.some((b) => b.id === bookingCId),
    'Customer 2 booking is strictly absent from Customer 1 history'
  );

  // 3.2 Ordering is newest first (created_at DESC)
  const time0 = new Date(list1Data[0].createdAt).getTime();
  const time1 = new Date(list1Data[1].createdAt).getTime();
  assert(time0 >= time1, 'Booking history is strictly ordered newest first');
  assert(list1Data[0].id === bookingBId, 'Booking B (newer) appears before Booking A');

  // 3.3 Empty booking history for customer with 0 bookings
  const emptyRes = await app.inject({
    method: 'GET',
    url: '/api/bookings',
    headers: { authorization: `Bearer ${tokenEmpty}` },
  });
  assert(emptyRes.statusCode === 200, 'Customer with zero bookings returns 200 OK');
  const emptyData = JSON.parse(emptyRes.payload).data;
  assert(Array.isArray(emptyData) && emptyData.length === 0, 'Empty history returns clean empty array []');

  console.log('\n--- 4. Real Status Logs & Progression Timeline Integrity ---');

  // 4.1 Initial creation has status log entry
  assert(Array.isArray(detailA.statusLogs), 'BookingDetail includes statusLogs array');
  assert(detailA.statusLogs!.length >= 1, 'Booking A has initial status log');
  assert(detailA.statusLogs![0].toStatus === 'SERVICE_REQUESTED', 'Initial status log toStatus is SERVICE_REQUESTED');
  assert(detailA.statusLogs![0].fromStatus === null, 'Initial status log fromStatus is null');
  assert(Boolean(detailA.statusLogs![0].createdAt), 'Status log has valid ISO timestamp');

  // 4.2 Assigned provider info is strictly null when unassigned
  assert(detailA.provider === null, 'Assigned provider is strictly null when unassigned');

  // 4.3 Transition Booking A: assign provider Ramesh and transition status
  await pool.query(
    `UPDATE bookings SET provider_id = $1, status = 'PROVIDER_ASSIGNED' WHERE id = $2`,
    [provId, bookingAId]
  );
  await pool.query(
    `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
     VALUES ($1, 'SERVICE_REQUESTED', 'PROVIDER_ASSIGNED', $2, 'Technician assigned')`,
    [bookingAId, provId]
  );

  const getAAssignedRes = await app.inject({
    method: 'GET',
    url: `/api/bookings/${bookingAId}`,
    headers: { authorization: `Bearer ${token1}` },
  });
  const detailAAssigned: BookingDetail = JSON.parse(getAAssignedRes.payload).data;
  assert(detailAAssigned.status === 'PROVIDER_ASSIGNED', 'Booking status reflects backend update to PROVIDER_ASSIGNED');
  assert(detailAAssigned.provider !== null, 'Assigned provider is present after assignment');
  assert(detailAAssigned.provider?.name === 'Technician Ramesh', 'Assigned provider name matches technician full_name');
  assert(detailAAssigned.statusLogs!.length === 2, 'Status progression timeline has 2 log entries');
  assert(detailAAssigned.statusLogs![1].toStatus === 'PROVIDER_ASSIGNED', 'Second status log entry is PROVIDER_ASSIGNED');

  console.log('\n--- 5. Exceptional Status Rendering & Backend Truth ---');

  // 5.1 Test CANCELLED_BY_CUSTOMER
  await pool.query(
    `UPDATE bookings SET status = 'CANCELLED_BY_CUSTOMER' WHERE id = $1`,
    [bookingAId]
  );
  await pool.query(
    `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
     VALUES ($1, 'PROVIDER_ASSIGNED', 'CANCELLED_BY_CUSTOMER', $2, 'Customer cancelled request')`,
    [bookingAId, c1Id]
  );

  const getACancelledRes = await app.inject({
    method: 'GET',
    url: `/api/bookings/${bookingAId}`,
    headers: { authorization: `Bearer ${token1}` },
  });
  const detailACancelled: BookingDetail = JSON.parse(getACancelledRes.payload).data;
  assert(detailACancelled.status === 'CANCELLED_BY_CUSTOMER', 'Status accurately reflects CANCELLED_BY_CUSTOMER');
  const cancelLog = detailACancelled.statusLogs!.find((l) => l.toStatus === 'CANCELLED_BY_CUSTOMER');
  assert(Boolean(cancelLog), 'Timeline includes CANCELLED_BY_CUSTOMER terminal log');

  // 5.2 Test REJECTED_BY_PROVIDER
  await pool.query(
    `UPDATE bookings SET status = 'REJECTED_BY_PROVIDER' WHERE id = $1`,
    [bookingBId]
  );
  await pool.query(
    `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
     VALUES ($1, 'SERVICE_REQUESTED', 'REJECTED_BY_PROVIDER', $2, 'Technician busy')`,
    [bookingBId, provId]
  );

  const getBRejectedRes = await app.inject({
    method: 'GET',
    url: `/api/bookings/${bookingBId}`,
    headers: { authorization: `Bearer ${token1}` },
  });
  const detailBRejected: BookingDetail = JSON.parse(getBRejectedRes.payload).data;
  assert(detailBRejected.status === 'REJECTED_BY_PROVIDER', 'Status accurately reflects REJECTED_BY_PROVIDER');

  // 5.3 Test CANCELLED_BY_ADMIN
  await pool.query(
    `UPDATE bookings SET status = 'CANCELLED_BY_ADMIN' WHERE id = $1`,
    [bookingCId]
  );
  await pool.query(
    `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
     VALUES ($1, 'SERVICE_REQUESTED', 'CANCELLED_BY_ADMIN', NULL, 'Administrative cancellation')`,
    [bookingCId]
  );

  const getCAdminRes = await app.inject({
    method: 'GET',
    url: `/api/bookings/${bookingCId}`,
    headers: { authorization: `Bearer ${token2}` },
  });
  const detailCAdmin: BookingDetail = JSON.parse(getCAdminRes.payload).data;
  assert(detailCAdmin.status === 'CANCELLED_BY_ADMIN', 'Status accurately reflects CANCELLED_BY_ADMIN');

  console.log('\n--- 6. Audio Reuse & Playback Endpoint Integrity ---');

  // 6.1 Booking B audio URL is reused correctly
  assert(typeof bookingBAudioUrl === 'string' && bookingBAudioUrl.startsWith('/api/audio/'), 'Booking B audioUrl is valid');
  assert(detailBRejected.audioUrl === bookingBAudioUrl, 'Detail view reuses exact saved audioUrl');
  assert(detailBRejected.audioDurationSeconds === 5, 'Audio duration is 5 seconds');

  // 6.2 Stream audio via GET endpoint
  const streamAudioRes = await app.inject({
    method: 'GET',
    url: bookingBAudioUrl,
    headers: { authorization: `Bearer ${token1}` },
  });
  assert(streamAudioRes.statusCode === 200, 'Audio file streams via GET /api/audio/:filename');
  assert(streamAudioRes.rawPayload.length === 10000, 'Streamed audio length matches exact uploaded binary size');

  console.log('\n--- 7. Bilingual i18n Key Symmetry Audit for Module 6 ---');
  const enKeys = Object.keys(en);
  const hiKeys = Object.keys(hi);
  assert(enKeys.length === hiKeys.length, `Matching dictionary sizes (${enKeys.length} keys each)`);

  let allKeysPresent = true;
  let allNonEmpty = true;
  let noMixedHindi = true;

  const module6Keys = [
    'history.title',
    'history.empty_title',
    'history.empty_desc',
    'history.book_now',
    'history.load_error',
    'history.refresh',
    'history.refreshing',
    'history.view_details',
    'detail.title',
    'detail.refresh',
    'detail.refreshing',
    'detail.timeline_title',
    'detail.provider_label',
    'detail.no_provider',
    'detail.created_at',
    'detail.load_error',
    'detail.audio_error',
    'detail.not_found',
    'detail.service_address',
    'detail.price_breakdown',
    'detail.terminal_cancelled',
    'detail.terminal_rejected',
    'detail.audio_note_title',
  ];

  for (const k of module6Keys) {
    if (!en[k as keyof typeof en]) {
      allKeysPresent = false;
      console.error(`Missing English key: ${k}`);
    }
    if (!hi[k as keyof typeof hi]) {
      allKeysPresent = false;
      console.error(`Missing Hindi key: ${k}`);
    }
    const enVal = en[k as keyof typeof en] || '';
    const hiVal = hi[k as keyof typeof hi] || '';
    if (enVal.trim() === '' || hiVal.trim() === '') {
      allNonEmpty = false;
    }
    if (/\([A-Za-z\s/]+\)/.test(hiVal)) {
      noMixedHindi = false;
      console.error(`Leaked parenthetical English in Hindi key "${k}": ${hiVal}`);
    }
  }

  assert(allKeysPresent, 'All Module 6 keys exist in both English and Hindi dictionaries');
  assert(allNonEmpty, 'No Module 6 translation strings are blank');
  assert(noMixedHindi, 'Zero parenthetical English translations in Hindi dictionary');

  // 8. Clean up fixtures
  await pool.query(
    'DELETE FROM booking_status_logs WHERE changed_by IN (SELECT id FROM users WHERE phone IN ($1, $2, $3, $4))',
    [customer1Phone, customer2Phone, customerEmptyPhone, providerPhone]
  );
  await pool.query(
    'DELETE FROM bookings WHERE customer_id IN (SELECT id FROM users WHERE phone IN ($1, $2, $3, $4))',
    [customer1Phone, customer2Phone, customerEmptyPhone, providerPhone]
  );
  await pool.query(
    'DELETE FROM otp_requests WHERE phone IN ($1, $2, $3, $4)',
    [customer1Phone, customer2Phone, customerEmptyPhone, providerPhone]
  );
  await pool.query(
    'DELETE FROM users WHERE phone IN ($1, $2, $3, $4)',
    [customer1Phone, customer2Phone, customerEmptyPhone, providerPhone]
  );

  console.log('\n============================================================');
  console.log(`STATUS & HISTORY TESTS: ${passed} PASSED, ${failed} FAILED.`);
  console.log('============================================================\n');

  await app.close();
  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runBookingStatusTests().catch((err) => {
  console.error('Fatal error in booking-status test suite:', err);
  process.exit(1);
});
