import { buildApp } from '../src/app';
import { db } from '../src/db';
import { env } from '../src/config/env';
import { en } from '../../shared/i18n/en';
import { hi } from '../../shared/i18n/hi';

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

async function runAdminFoundationTests() {
  console.log('\n============================================================');
  console.log('CHANDIL HOME SERVICES - MODULE 12A ADMIN FOUNDATION TESTS');
  console.log('============================================================\n');

  const app = await buildApp();
  const pool = db.getPool();
  if (!pool) {
    console.error('Fatal: Database pool unavailable.');
    process.exit(1);
  }

  // Dedicated test phone numbers for Module 12A
  const testCustomerPhone = '9800066001';
  const testProviderPhone = '9800066002';
  const testAdminPhone = '9800066003';
  const testStrangerPhone = '9800066099';
  const testOtp = env.DEV_MOCK_OTP || '1234';

  const allTestPhones = [
    testCustomerPhone,
    testProviderPhone,
    testAdminPhone,
    testStrangerPhone,
  ];

  async function cleanupFixtures() {
    await pool!.query('DELETE FROM otp_requests WHERE phone = ANY($1)', [allTestPhones]);
    await pool!.query('DELETE FROM users WHERE phone = ANY($1)', [allTestPhones]);
  }

  try {
    // 0. Pre-test cleanup
    await cleanupFixtures();

    // 1. Seed Accounts: Customer, Provider, and Admin
    const { rows: customerRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version)
       VALUES ($1, 'customer', 'en', 'Test Customer', true, 1) RETURNING id`,
      [testCustomerPhone]
    );
    const customerId = customerRows[0].id;

    const { rows: providerRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version)
       VALUES ($1, 'provider', 'hi', 'Test Provider', true, 1) RETURNING id`,
      [testProviderPhone]
    );
    const providerId = providerRows[0].id;

    const { rows: adminRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version)
       VALUES ($1, 'admin', 'en', 'Chandil Master Admin', true, 1) RETURNING id`,
      [testAdminPhone]
    );
    const adminId = adminRows[0].id;

    console.log('--- 1. Admin Authentication via Approved OTP/JWT Mechanism ---');

    // 1.1 Request OTP for admin phone
    const reqOtpRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { phone: testAdminPhone },
    });
    assert(reqOtpRes.statusCode === 200, 'Admin can request OTP (200 OK)');

    // 1.2 Verify OTP for existing admin user
    const verifyOtpRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { phone: testAdminPhone, otp: testOtp, preferredLanguage: 'en' },
    });
    assert(verifyOtpRes.statusCode === 200, 'Admin OTP verification succeeds (200 OK)');
    const verifyOtpBody = JSON.parse(verifyOtpRes.payload);
    assert(verifyOtpBody.success === true, 'Admin login response has success: true');
    assert(verifyOtpBody.data.user.role === 'admin', 'Authenticated user role is strictly "admin"');
    assert(verifyOtpBody.data.user.id === adminId, 'Authenticated user ID matches seeded admin');
    assert(verifyOtpBody.data.isNewUser === false, 'Existing admin flagged as isNewUser: false');
    assert(typeof verifyOtpBody.data.token === 'string' && verifyOtpBody.data.token.length > 20, 'Valid admin JWT returned');
    const adminToken = verifyOtpBody.data.token;

    // 1.3 Security: Arbitrary public phone cannot register as admin
    const strangerReqOtp = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { phone: testStrangerPhone },
    });
    assert(strangerReqOtp.statusCode === 200, 'Stranger can request OTP');
    const strangerVerify = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { phone: testStrangerPhone, otp: testOtp },
    });
    assert(strangerVerify.statusCode === 200, 'Stranger verifies OTP');
    const strangerBody = JSON.parse(strangerVerify.payload);
    assert(strangerBody.data.user.role === 'customer', 'New self-service registration is strictly customer (cannot self-register admin)');

    console.log('\n--- 2. Server-Side Admin RBAC Boundaries (GET /api/admin/me) ---');

    // 2.1 Unauthenticated request rejected with 401
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/api/admin/me',
    });
    assert(unauthRes.statusCode === 401, 'Unauthenticated GET /api/admin/me rejected with 401');
    const unauthBody = JSON.parse(unauthRes.payload);
    assert(unauthBody.error.code === 'UNAUTHORIZED', 'Unauthenticated error code is UNAUTHORIZED');

    // 2.2 Customer token rejected with 403 Forbidden
    const customerToken = app.jwt.sign({
      id: customerId,
      phone: testCustomerPhone,
      role: 'customer',
      tokenVersion: 1,
    });
    const customerRes = await app.inject({
      method: 'GET',
      url: '/api/admin/me',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(customerRes.statusCode === 403, 'Customer token on GET /api/admin/me rejected with 403 Forbidden');
    const customerBody = JSON.parse(customerRes.payload);
    assert(customerBody.error.code === 'FORBIDDEN', 'Customer access denied with code FORBIDDEN');

    // 2.3 Provider token rejected with 403 Forbidden
    const providerToken = app.jwt.sign({
      id: providerId,
      phone: testProviderPhone,
      role: 'provider',
      tokenVersion: 1,
    });
    const providerRes = await app.inject({
      method: 'GET',
      url: '/api/admin/me',
      headers: { Authorization: `Bearer ${providerToken}` },
    });
    assert(providerRes.statusCode === 403, 'Provider token on GET /api/admin/me rejected with 403 Forbidden');
    const providerBody = JSON.parse(providerRes.payload);
    assert(providerBody.error.code === 'FORBIDDEN', 'Provider access denied with code FORBIDDEN');

    // 2.4 Admin token allowed with 200 OK
    const adminRes = await app.inject({
      method: 'GET',
      url: '/api/admin/me',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminRes.statusCode === 200, 'Admin token on GET /api/admin/me allowed with 200 OK');
    const adminBody = JSON.parse(adminRes.payload);
    assert(adminBody.success === true, 'Admin /me response has success: true');
    assert(adminBody.data.user.role === 'admin', 'Returned user role is strictly admin');
    assert(adminBody.data.user.phone === testAdminPhone, 'Returned admin phone matches');

    console.log('\n--- 3. Invalid & Expired Token Rejection ---');

    // 3.1 Malformed token rejected
    const malformedRes = await app.inject({
      method: 'GET',
      url: '/api/admin/me',
      headers: { Authorization: 'Bearer this.is.invalid' },
    });
    assert(malformedRes.statusCode === 401, 'Malformed token rejected with 401');

    // 3.2 Non-existent user token rejected
    const ghostToken = app.jwt.sign({
      id: '00000000-0000-0000-0000-000000000000',
      phone: '9800066098',
      role: 'admin',
      tokenVersion: 1,
    });
    const ghostRes = await app.inject({
      method: 'GET',
      url: '/api/admin/me',
      headers: { Authorization: `Bearer ${ghostToken}` },
    });
    assert(ghostRes.statusCode === 401, 'Non-existent user token rejected with 401');

    console.log('\n--- 4. Admin Logout & Session Revocation ---');

    // 4.1 Logout using existing auth mechanism
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(logoutRes.statusCode === 200, 'POST /api/auth/logout succeeds for admin (200 OK)');

    // 4.2 Verify token_version incremented in database
    const { rows: updatedAdminRows } = await pool.query<{ token_version: number }>(
      'SELECT token_version FROM users WHERE id = $1',
      [adminId]
    );
    assert(updatedAdminRows[0].token_version > 1, 'Admin token_version successfully incremented in DB');

    // 4.3 Post-logout request with same token rejected with 401
    const postLogoutRes = await app.inject({
      method: 'GET',
      url: '/api/admin/me',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(postLogoutRes.statusCode === 401, 'Post-logout admin request rejected with 401 (session revoked)');

    console.log('\n--- 5. Bilingual i18n Symmetry & Module 12A Dictionary Verification ---');

    const enKeys = Object.keys(en);
    const hiKeys = Object.keys(hi);
    assert(enKeys.length === hiKeys.length, `Matching dictionary sizes: ${enKeys.length} English, ${hiKeys.length} Hindi`);

    const requiredAdminKeys = [
      'admin.dashboard',
      'admin.providers',
      'admin.bookings',
      'admin.logout',
      'admin.role_badge',
      'admin.system_status',
      'admin.system_operational',
      'admin.provider_management_title',
      'admin.provider_management_placeholder',
      'admin.booking_management_title',
      'admin.booking_management_placeholder',
      'admin.access_denied_title',
      'admin.access_denied_desc',
      'admin.loading',
      'admin.error_title',
      'admin.retry',
      'admin.quick_nav',
      'admin.manage_providers_desc',
      'admin.manage_bookings_desc',
      'admin.view_module',
    ] as const;

    for (const key of requiredAdminKeys) {
      const enVal = (en as any)[key];
      const hiVal = (hi as any)[key];
      assert(typeof enVal === 'string' && enVal.length > 0, `EN: "${key}" is defined`);
      assert(typeof hiVal === 'string' && hiVal.length > 0, `HI: "${key}" is defined`);
      assert(!/\(.*\)/.test(hiVal), `HI: "${key}" contains zero parenthetical English ("${hiVal}")`);
    }

    console.log('\n--- 6. Structural & No-Fake-Metrics Verification ---');

    // Verify placeholder text semantics
    const provPlaceholder = en['admin.provider_management_placeholder'];
    assert(provPlaceholder.includes('available here'), 'Provider placeholder states management will be available here');
    const bookPlaceholder = en['admin.booking_management_placeholder'];
    assert(bookPlaceholder.includes('available here'), 'Booking placeholder states management will be available here');

    // Verify system status semantic (honest operational status, no fake counts)
    const systemStatusEn = en['admin.system_operational'];
    assert(!/\d/.test(systemStatusEn), 'System operational status contains no fake numeric metrics');

    console.log('\n============================================================');
    console.log(`ADMIN FOUNDATION TESTS: ${passed} PASSED, ${failed} FAILED.`);
    console.log('============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    // Thorough fixture cleanup
    await cleanupFixtures();
    await app.close();
  }
}

runAdminFoundationTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
