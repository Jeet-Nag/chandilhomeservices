import { buildApp } from '../src/app';
import { db } from '../src/db';
import { MockOtpProvider } from '../src/services/otp/mock-otp.provider';
import { env } from '../src/config/env';

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

async function runAuthTests() {
  console.log('\n============================================================');
  console.log('CHANDIL HOME SERVICES - AUTH & RBAC VERIFICATION SUITE');
  console.log('============================================================\n');

  const app = await buildApp();
  const pool = db.getPool();
  if (!pool) {
    console.error('Fatal: DB pool unavailable.');
    process.exit(1);
  }

  // Test phone numbers
  const customerPhone = '9876543211';
  const providerPhone = '9876543222';
  const adminPhone = '9876543233';
  const rateLimitPhone = '9876543244';
  const testOtp = env.DEV_MOCK_OTP || '1234';

  // Clean up any test fixtures from previous runs
  await pool.query('DELETE FROM otp_requests WHERE phone IN ($1, $2, $3, $4)', [
    customerPhone,
    providerPhone,
    adminPhone,
    rateLimitPhone,
  ]);
  await pool.query('DELETE FROM users WHERE phone IN ($1, $2, $3, $4)', [
    customerPhone,
    providerPhone,
    adminPhone,
    rateLimitPhone,
  ]);

  // Pre-seed an existing provider and an existing admin user
  await pool.query(
    `INSERT INTO users (phone, role, preferred_language, full_name)
     VALUES ($1, 'provider', 'hi', 'Ramesh Mistri'),
            ($2, 'admin', 'en', 'Chandil Operations Admin')`,
    [providerPhone, adminPhone]
  );

  console.log('--- 1. OTP Generation, Security & Plaintext Inspection ---');

  // Test 1: Request OTP for new customer
  const req1 = await app.inject({
    method: 'POST',
    url: '/api/auth/request-otp',
    payload: { phone: customerPhone },
  });
  assert(req1.statusCode === 200, 'Request OTP returns HTTP 200');
  const req1Body = JSON.parse(req1.payload);
  assert(req1Body.success === true, 'Request OTP success is true');
  assert(!('otp' in req1Body.data), 'CRITICAL: Secret OTP is NEVER returned in API response');

  // Test 2: Verify OTP is hashed in DB, never plaintext
  const { rows: dbOtps } = await pool.query<{ otp_hash: string; salt: string }>(
    'SELECT otp_hash, salt FROM otp_requests WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
    [customerPhone]
  );
  assert(dbOtps.length === 1, 'OTP request record created in database');
  assert(dbOtps[0].otp_hash.length === 64, 'Stored OTP is a 64-character SHA-256 hash');
  assert(dbOtps[0].otp_hash !== testOtp, 'Stored hash does NOT equal the plaintext OTP');

  // Test 3: Rate limiting / Cooldown enforcement
  const req2 = await app.inject({
    method: 'POST',
    url: '/api/auth/request-otp',
    payload: { phone: customerPhone },
  });
  assert(req2.statusCode === 400, 'Subsequent OTP request within 60s is rejected with 400');
  const req2Body = JSON.parse(req2.payload);
  assert(req2Body.error.code === 'RATE_LIMIT_EXCEEDED', 'Error code is RATE_LIMIT_EXCEEDED');

  // Test 4: Invalid phone format rejected
  const badPhoneReq = await app.inject({
    method: 'POST',
    url: '/api/auth/request-otp',
    payload: { phone: '12345' },
  });
  assert(badPhoneReq.statusCode === 400, 'Invalid phone number format rejected with 400');

  console.log('\n--- 2. OTP Verification & Account Creation ---');

  // Test 5: Incorrect OTP rejected
  const badOtpVerify = await app.inject({
    method: 'POST',
    url: '/api/auth/verify-otp',
    payload: { phone: customerPhone, otp: '0000' },
  });
  assert(badOtpVerify.statusCode === 400, 'Incorrect OTP is rejected with 400');
  const badOtpBody = JSON.parse(badOtpVerify.payload);
  assert(badOtpBody.error.code === 'INVALID_OTP', 'Error code is INVALID_OTP');

  // Test 6: Verify attempt count is tracked
  const { rows: attemptRows } = await pool.query<{ attempts: number }>(
    'SELECT attempts FROM otp_requests WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
    [customerPhone]
  );
  assert(attemptRows[0].attempts === 1, 'Failed attempt count incremented to 1 in database');

  // Test 7: Successful verification for new user
  const goodVerify = await app.inject({
    method: 'POST',
    url: '/api/auth/verify-otp',
    payload: { phone: customerPhone, otp: testOtp, preferredLanguage: 'hi' },
  });
  assert(goodVerify.statusCode === 200, 'Correct OTP returns HTTP 200');
  const goodVerifyBody = JSON.parse(goodVerify.payload);
  assert(goodVerifyBody.success === true, 'Verification response success is true');
  assert(goodVerifyBody.data.isNewUser === true, 'New user correctly flagged as isNewUser: true');
  assert(goodVerifyBody.data.user.role === 'customer', 'New user account is strictly role: customer');
  assert(goodVerifyBody.data.user.preferredLanguage === 'hi', 'Preferred language set to Hindi');
  const customerToken = goodVerifyBody.data.token;
  assert(typeof customerToken === 'string' && customerToken.length > 20, 'Valid JWT token returned');

  // Test 8: Consumed OTP cannot be reused
  const reuseVerify = await app.inject({
    method: 'POST',
    url: '/api/auth/verify-otp',
    payload: { phone: customerPhone, otp: testOtp },
  });
  assert(reuseVerify.statusCode === 400, 'Consumed OTP cannot be reused');

  console.log('\n--- 3. Existing User Login & Role Preservation ---');

  // Test 9: Existing Provider Login preserves 'provider' role
  await pool.query('DELETE FROM otp_requests WHERE phone = $1', [providerPhone]);
  await app.inject({
    method: 'POST',
    url: '/api/auth/request-otp',
    payload: { phone: providerPhone },
  });
  const providerVerify = await app.inject({
    method: 'POST',
    url: '/api/auth/verify-otp',
    payload: { phone: providerPhone, otp: testOtp },
  });
  assert(providerVerify.statusCode === 200, 'Existing provider logs in successfully');
  const providerVerifyBody = JSON.parse(providerVerify.payload);
  assert(providerVerifyBody.data.isNewUser === false, 'Existing provider has isNewUser: false');
  assert(providerVerifyBody.data.user.role === 'provider', 'Provider role is preserved');
  const providerToken = providerVerifyBody.data.token;

  // Test 10: Existing Admin Login preserves 'admin' role
  await pool.query('DELETE FROM otp_requests WHERE phone = $1', [adminPhone]);
  await app.inject({
    method: 'POST',
    url: '/api/auth/request-otp',
    payload: { phone: adminPhone },
  });
  const adminVerify = await app.inject({
    method: 'POST',
    url: '/api/auth/verify-otp',
    payload: { phone: adminPhone, otp: testOtp },
  });
  assert(adminVerify.statusCode === 200, 'Existing admin logs in successfully');
  const adminVerifyBody = JSON.parse(adminVerify.payload);
  assert(adminVerifyBody.data.user.role === 'admin', 'Admin role is preserved');
  const adminToken = adminVerifyBody.data.token;

  console.log('\n--- 4. Session Validation, /me & Logout ---');

  // Test 11: GET /api/auth/me returns authenticated user
  const meRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(meRes.statusCode === 200, 'GET /api/auth/me returns 200 for authenticated user');
  const meBody = JSON.parse(meRes.payload);
  assert(meBody.data.user.phone === customerPhone, 'User profile matches token owner');

  // Test 12: Missing token returns 401
  const noTokenRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
  });
  assert(noTokenRes.statusCode === 401, 'Request without token returns 401');

  // Test 13: Tampered token returns 401
  const badTokenRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { Authorization: 'Bearer invalid.fake.token' },
  });
  assert(badTokenRes.statusCode === 401, 'Tampered token returns 401');

  // Test 14: Logout invalidates session
  const logoutRes = await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(logoutRes.statusCode === 200, 'POST /api/auth/logout returns 200');

  // Test 15: Post-logout request with same token returns 401 (token_version revoked)
  const postLogoutRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(postLogoutRes.statusCode === 401, 'Post-logout request is rejected with 401 (session revoked)');

  console.log('\n--- 5. Server-Side RBAC Enforcement Matrix ---');

  // Re-login customer to get fresh active token
  await pool.query('DELETE FROM otp_requests WHERE phone = $1', [customerPhone]);
  await app.inject({ method: 'POST', url: '/api/auth/request-otp', payload: { phone: customerPhone } });
  const freshCustRes = await app.inject({ method: 'POST', url: '/api/auth/verify-otp', payload: { phone: customerPhone, otp: testOtp } });
  const freshCustomerToken = JSON.parse(freshCustRes.payload).data.token;

  // Test 16: Customer -> Customer Endpoint (ALLOWED: 200)
  const c2c = await app.inject({
    method: 'GET',
    url: '/api/customer/me',
    headers: { Authorization: `Bearer ${freshCustomerToken}` },
  });
  assert(c2c.statusCode === 200, 'CUSTOMER accessing customer endpoint -> 200 Allowed');

  // Test 17: Customer -> Provider Endpoint (FORBIDDEN: 403)
  const c2p = await app.inject({
    method: 'GET',
    url: '/api/provider/dashboard',
    headers: { Authorization: `Bearer ${freshCustomerToken}` },
  });
  assert(c2p.statusCode === 403, 'CUSTOMER accessing provider endpoint -> 403 Forbidden');

  // Test 18: Customer -> Admin Endpoint (FORBIDDEN: 403)
  const c2a = await app.inject({
    method: 'GET',
    url: '/api/admin/overview',
    headers: { Authorization: `Bearer ${freshCustomerToken}` },
  });
  assert(c2a.statusCode === 403, 'CUSTOMER accessing admin endpoint -> 403 Forbidden');

  // Test 19: Provider -> Provider Endpoint (ALLOWED: 200)
  const p2p = await app.inject({
    method: 'GET',
    url: '/api/provider/dashboard',
    headers: { Authorization: `Bearer ${providerToken}` },
  });
  assert(p2p.statusCode === 200, 'PROVIDER accessing provider endpoint -> 200 Allowed');

  // Test 20: Provider -> Customer-restricted Endpoint (FORBIDDEN: 403)
  const p2c = await app.inject({
    method: 'GET',
    url: '/api/customer/me',
    headers: { Authorization: `Bearer ${providerToken}` },
  });
  assert(p2c.statusCode === 403, 'PROVIDER accessing customer endpoint -> 403 Forbidden');

  // Test 21: Provider -> Admin Endpoint (FORBIDDEN: 403)
  const p2a = await app.inject({
    method: 'GET',
    url: '/api/admin/overview',
    headers: { Authorization: `Bearer ${providerToken}` },
  });
  assert(p2a.statusCode === 403, 'PROVIDER accessing admin endpoint -> 403 Forbidden');

  // Test 22: Admin -> Admin Endpoint (ALLOWED: 200)
  const a2a = await app.inject({
    method: 'GET',
    url: '/api/admin/overview',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(a2a.statusCode === 200, 'ADMIN accessing admin endpoint -> 200 Allowed');

  console.log('\n--- 6. Security Guards & Edge Cases ---');

  // Test 23: Expired OTP rejected
  await pool.query('DELETE FROM otp_requests WHERE phone = $1', [rateLimitPhone]);
  await pool.query(
    `INSERT INTO otp_requests (phone, otp_hash, salt, expires_at)
     VALUES ($1, 'hash', 'salt', NOW() - INTERVAL '10 seconds')`,
    [rateLimitPhone]
  );
  const expiredVerify = await app.inject({
    method: 'POST',
    url: '/api/auth/verify-otp',
    payload: { phone: rateLimitPhone, otp: testOtp },
  });
  assert(expiredVerify.statusCode === 400, 'Expired OTP rejected with 400');
  assert(JSON.parse(expiredVerify.payload).error.code === 'OTP_EXPIRED', 'Error code is OTP_EXPIRED');

  // Test 24: Max verification attempts lockout
  await pool.query('DELETE FROM otp_requests WHERE phone = $1', [rateLimitPhone]);
  await app.inject({ method: 'POST', url: '/api/auth/request-otp', payload: { phone: rateLimitPhone } });
  
  // Fail 3 times
  await app.inject({ method: 'POST', url: '/api/auth/verify-otp', payload: { phone: rateLimitPhone, otp: '1111' } });
  await app.inject({ method: 'POST', url: '/api/auth/verify-otp', payload: { phone: rateLimitPhone, otp: '2222' } });
  const thirdFail = await app.inject({ method: 'POST', url: '/api/auth/verify-otp', payload: { phone: rateLimitPhone, otp: '3333' } });
  assert(thirdFail.statusCode === 400, '3rd failed attempt is rejected');
  assert(JSON.parse(thirdFail.payload).error.code === 'MAX_ATTEMPTS_EXCEEDED', 'OTP locked after 3 failed attempts');

  // Test 25: MockOtpProvider safety check in production
  const mockProvider = new MockOtpProvider();
  let prodSafetyTriggered = false;
  const originalEnv = env.NODE_ENV;
  try {
    (env as any).NODE_ENV = 'production';
    await mockProvider.sendOtp('9999999999', '1234');
  } catch (err: any) {
    if (err.message.includes('[SECURITY FATAL]')) {
      prodSafetyTriggered = true;
    }
  } finally {
    (env as any).NODE_ENV = originalEnv;
  }
  assert(prodSafetyTriggered, 'MockOtpProvider strictly throws fatal error in production environment');

  // Cleanup test fixtures
  await pool.query('DELETE FROM otp_requests WHERE phone IN ($1, $2, $3, $4)', [
    customerPhone,
    providerPhone,
    adminPhone,
    rateLimitPhone,
  ]);
  await pool.query('DELETE FROM users WHERE phone IN ($1, $2, $3, $4)', [
    customerPhone,
    providerPhone,
    adminPhone,
    rateLimitPhone,
  ]);

  await app.close();

  console.log('\n============================================================');
  console.log(`AUTH & RBAC TESTS: ${passed} PASSED, ${failed} FAILED.`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthTests().catch((err) => {
  console.error('Fatal error running auth test suite:', err);
  process.exit(1);
});
