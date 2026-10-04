import { buildApp } from '../src/app';
import { db } from '../src/db';
import { env } from '../src/config/env';
import { createTestCustomer, createTestProvider, createTestAdmin } from './helpers/auth-helper';

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
  const deactivatedPhone = '9876543244';
  const allPhones = [customerPhone, providerPhone, adminPhone, deactivatedPhone];

  // Clean up any test fixtures from previous runs
  await pool.query('DELETE FROM webauthn_challenges WHERE phone = ANY($1)', [allPhones]);
  await pool.query('DELETE FROM user_credentials WHERE user_id IN (SELECT id FROM users WHERE phone = ANY($1))', [allPhones]);
  await pool.query('DELETE FROM users WHERE phone = ANY($1)', [allPhones]);

  console.log('--- 1. WebAuthn Registration Options & Challenge Security ---');

  // Test 1: Request passkey registration options for customer
  const regOptRes = await app.inject({
    method: 'POST',
    url: '/api/auth/passkey/register-options',
    payload: { phone: customerPhone, fullName: 'Test Customer', preferredLanguage: 'hi' },
  });
  assert(regOptRes.statusCode === 200, 'Request register-options returns HTTP 200');
  const regOptBody = JSON.parse(regOptRes.payload);
  assert(regOptBody.success === true, 'register-options response has success: true');
  assert(typeof regOptBody.data.challenge === 'string' && regOptBody.data.challenge.length > 20, 'Challenge is present in options');
  assert(regOptBody.data.rp.id === env.RP_ID, 'RP ID matches server configuration');

  // Test 2: Challenge is securely stored in database
  const { rows: dbChallenges } = await pool.query<{ challenge: string; flow_type: string; expires_at: Date }>(
    'SELECT challenge, flow_type, expires_at FROM webauthn_challenges WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
    [customerPhone]
  );
  assert(dbChallenges.length === 1, 'WebAuthn challenge record created in database');
  assert(dbChallenges[0].flow_type === 'registration', 'Challenge flow_type is "registration"');
  assert(dbChallenges[0].expires_at > new Date(), 'Challenge has future expiration timestamp');

  // Test 3: Invalid phone format rejected
  const badPhoneReq = await app.inject({
    method: 'POST',
    url: '/api/auth/passkey/register-options',
    payload: { phone: '12345' },
  });
  assert(badPhoneReq.statusCode === 400, 'Invalid phone number format rejected with 400');

  // Test 4: Missing phone in register-options rejected
  const missingPhoneReq = await app.inject({
    method: 'POST',
    url: '/api/auth/passkey/register-options',
    payload: {},
  });
  assert(missingPhoneReq.statusCode === 400, 'Missing phone rejected with 400 VALIDATION_ERROR');

  // Test 5: Deactivated account cannot request registration options
  await pool.query(
    `INSERT INTO users (phone, role, preferred_language, full_name, is_active)
     VALUES ($1, 'customer', 'en', 'Deactivated User', false)`,
    [deactivatedPhone]
  );
  const deactRes = await app.inject({
    method: 'POST',
    url: '/api/auth/passkey/register-options',
    payload: { phone: deactivatedPhone },
  });
  assert(deactRes.statusCode === 403, 'Deactivated account registration rejected with 403 Forbidden');
  assert(JSON.parse(deactRes.payload).error.code === 'ACCOUNT_DEACTIVATED', 'Error code is ACCOUNT_DEACTIVATED');

  console.log('\n--- 2. WebAuthn Verification Validation & Security Boundaries ---');

  // Test 6: register-verify rejects missing body/response
  const badVerifyReq = await app.inject({
    method: 'POST',
    url: '/api/auth/passkey/register-verify',
    payload: { phone: customerPhone },
  });
  assert(badVerifyReq.statusCode === 400, 'register-verify with missing response body rejected with 400');

  // Test 7: register-verify rejects invalid/non-existent challenge
  const fakeChallengeVerify = await app.inject({
    method: 'POST',
    url: '/api/auth/passkey/register-verify',
    payload: {
      phone: customerPhone,
      response: {
        id: 'fake-cred-id',
        rawId: 'fake-cred-id',
        type: 'public-key',
        response: {
          clientDataJSON: Buffer.from(JSON.stringify({
            type: 'webauthn.create',
            challenge: 'nonexistent-fake-challenge-xyz',
            origin: env.EXPECTED_ORIGIN,
          })).toString('base64url'),
          attestationObject: 'fake-attestation',
        },
      },
    },
  });
  assert(fakeChallengeVerify.statusCode === 400, 'register-verify with invalid challenge rejected with 400 (not 500)');

  // Test 8: Phone number alone cannot authenticate (no JWT without cryptographic ceremony)
  const phoneOnlyAttempt = await app.inject({
    method: 'POST',
    url: '/api/auth/passkey/login-verify',
    payload: { phone: customerPhone },
  });
  assert(phoneOnlyAttempt.statusCode === 400, 'Phone number alone cannot authenticate (WebAuthn assertion required)');

  console.log('\n--- 3. WebAuthn Login Options & Discoverable Credential Support ---');

  // Test 9: Login options without phone (discoverable credentials / autofill)
  const loginOptAnon = await app.inject({
    method: 'POST',
    url: '/api/auth/passkey/login-options',
    payload: {},
  });
  assert(loginOptAnon.statusCode === 200, 'Login-options without phone succeeds (discoverable credentials)');
  const loginOptAnonBody = JSON.parse(loginOptAnon.payload);
  assert(typeof loginOptAnonBody.data.challenge === 'string', 'Login challenge issued for discoverable flow');

  // Test 10: Login options with phone returns challenge
  const loginOptPhone = await app.inject({
    method: 'POST',
    url: '/api/auth/passkey/login-options',
    payload: { phone: customerPhone },
  });
  assert(loginOptPhone.statusCode === 200, 'Login-options with phone returns 200 OK');

  console.log('\n--- 4. Existing User Login & Role Preservation via Auth Helper ---');

  // Seed existing provider & admin, obtain authentic production-structure tokens
  const custAuth = await createTestCustomer(app, customerPhone, 'Ramesh Customer');
  const provAuth = await createTestProvider(app, providerPhone, 'Ramesh Mistri');
  const adminAuth = await createTestAdmin(app, adminPhone, 'Chandil Operations Admin');

  const customerToken = custAuth.token;
  const providerToken = provAuth.token;
  const adminToken = adminAuth.token;

  // Test 11: Customer role is strictly preserved
  assert(custAuth.user.role === 'customer', 'Customer role is strictly "customer"');

  // Test 12: Provider role is strictly preserved
  assert(provAuth.user.role === 'provider', 'Provider role is preserved as "provider"');

  // Test 13: Admin role is strictly preserved
  assert(adminAuth.user.role === 'admin', 'Admin role is preserved as "admin"');

  console.log('\n--- 5. Session Validation, /me & Logout ---');

  // Test 14: GET /api/auth/me returns authenticated user
  const meRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(meRes.statusCode === 200, 'GET /api/auth/me returns 200 for authenticated user');
  const meBody = JSON.parse(meRes.payload);
  assert(meBody.data.user.phone === customerPhone, 'User profile matches token owner');

  // Test 15: Missing token returns 401
  const noTokenRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
  });
  assert(noTokenRes.statusCode === 401, 'Request without token returns 401');

  // Test 16: Tampered token returns 401
  const badTokenRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { Authorization: 'Bearer invalid.fake.token' },
  });
  assert(badTokenRes.statusCode === 401, 'Tampered token returns 401');

  // Test 17: Logout invalidates session
  const logoutRes = await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(logoutRes.statusCode === 200, 'POST /api/auth/logout returns 200');

  // Test 18: Post-logout request with same token returns 401 (token_version revoked)
  const postLogoutRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(postLogoutRes.statusCode === 401, 'Post-logout request is rejected with 401 (session revoked)');

  console.log('\n--- 6. Server-Side RBAC Enforcement Matrix ---');

  // Obtain a fresh customer token after logout
  const freshCustAuth = await createTestCustomer(app, customerPhone, 'Ramesh Customer');
  const freshCustomerToken = freshCustAuth.token;

  // Test 19: Customer -> Customer Endpoint (ALLOWED: 200)
  const c2c = await app.inject({
    method: 'GET',
    url: '/api/customer/me',
    headers: { Authorization: `Bearer ${freshCustomerToken}` },
  });
  assert(c2c.statusCode === 200, 'CUSTOMER accessing customer endpoint -> 200 Allowed');

  // Test 20: Customer -> Provider Endpoint (FORBIDDEN: 403)
  const c2p = await app.inject({
    method: 'GET',
    url: '/api/provider/dashboard',
    headers: { Authorization: `Bearer ${freshCustomerToken}` },
  });
  assert(c2p.statusCode === 403, 'CUSTOMER accessing provider endpoint -> 403 Forbidden');

  // Test 21: Customer -> Admin Endpoint (FORBIDDEN: 403)
  const c2a = await app.inject({
    method: 'GET',
    url: '/api/admin/overview',
    headers: { Authorization: `Bearer ${freshCustomerToken}` },
  });
  assert(c2a.statusCode === 403, 'CUSTOMER accessing admin endpoint -> 403 Forbidden');

  // Test 22: Provider -> Provider Endpoint (ALLOWED: 200)
  const p2p = await app.inject({
    method: 'GET',
    url: '/api/provider/dashboard',
    headers: { Authorization: `Bearer ${providerToken}` },
  });
  assert(p2p.statusCode === 200, 'PROVIDER accessing provider endpoint -> 200 Allowed');

  // Test 23: Provider -> Customer-restricted Endpoint (FORBIDDEN: 403)
  const p2c = await app.inject({
    method: 'GET',
    url: '/api/customer/me',
    headers: { Authorization: `Bearer ${providerToken}` },
  });
  assert(p2c.statusCode === 403, 'PROVIDER accessing customer endpoint -> 403 Forbidden');

  // Test 24: Provider -> Admin Endpoint (FORBIDDEN: 403)
  const p2a = await app.inject({
    method: 'GET',
    url: '/api/admin/overview',
    headers: { Authorization: `Bearer ${providerToken}` },
  });
  assert(p2a.statusCode === 403, 'PROVIDER accessing admin endpoint -> 403 Forbidden');

  // Test 25: Admin -> Admin Endpoint (ALLOWED: 200)
  const a2a = await app.inject({
    method: 'GET',
    url: '/api/admin/overview',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(a2a.statusCode === 200, 'ADMIN accessing admin endpoint -> 200 Allowed');

  console.log('\n--- 7. Security Invariants & Production Safety ---');

  // Test 26: Stale token_version rejected by validateSession
  const staleToken = app.jwt.sign({
    id: custAuth.id,
    phone: customerPhone,
    role: 'customer',
    tokenVersion: 999,
  });
  const staleRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { Authorization: `Bearer ${staleToken}` },
  });
  assert(staleRes.statusCode === 401, 'Stale token_version rejected by session validation');

  // Test 27: Public self-registration cannot elevate role (remains customer)
  const { rows: publicRegCheck } = await pool.query<{ role: string }>('SELECT role FROM users WHERE phone = $1', [customerPhone]);
  assert(publicRegCheck[0].role === 'customer', 'Public self-service user role remains strictly "customer"');



  // Cleanup test fixtures
  await pool.query('DELETE FROM webauthn_challenges WHERE phone = ANY($1)', [allPhones]);
  await pool.query('DELETE FROM user_credentials WHERE user_id IN (SELECT id FROM users WHERE phone = ANY($1))', [allPhones]);
  await pool.query('DELETE FROM users WHERE phone = ANY($1)', [allPhones]);

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
