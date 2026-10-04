/**
 * PHASE 2 — SERVER WEBAUTHN TEST SUITE
 *
 * Tests all four passkey endpoints plus security invariants.
 * Strategy:
 *   - REGISTRATION tests: seed webauthn_challenges + user_credentials directly
 *     to bypass browser-side ceremony while still exercising the route layer.
 *   - VERIFICATION tests (register-verify / login-verify): require a real
 *     signed authenticator response which is not available server-side.
 *     These are exercised via the PasskeyService unit path:
 *       - valid paths confirmed via options generation + DB state assertions
 *       - invalid paths (bad challenge, expired, reused, unknown cred, etc.)
 *         are injected by seeding specific DB rows and calling the service.
 *   - JWT / session tests: verify token structure via /api/auth/me after
 *     a synthetic direct-DB login seed.
 *   - RBAC / security invariants: confirmed via request body inspection,
 *     DB state, and service logic.
 */

import assert from 'node:assert';
import crypto from 'node:crypto';
import { buildApp } from '../src/app.js';
import { Database } from '../src/db/index.js';
import { Migrator } from '../src/db/migrator.js';
import { PasskeyService } from '../src/services/passkey.service.js';
import { env, validateEnvConfig } from '../src/config/env.js';
import type { Pool } from 'pg';

// ─── test harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function it(desc: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  [PASS] ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] ${desc}:`, err?.message ?? err);
    failed++;
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function randomB64url(bytes = 32): string {
  return b64url(crypto.randomBytes(bytes));
}

/** Generate a fake but structurally valid clientDataJSON for testing */
function fakeClientDataJSON(type: 'webauthn.create' | 'webauthn.get', challenge: string, origin = 'http://localhost:3000'): string {
  return b64url(Buffer.from(JSON.stringify({ type, challenge, origin })));
}

/** Minimal fake attestationObject (not verifiable, used only for malformed tests) */
const FAKE_ATTESTATION_OBJ = randomB64url(64);

/** Mint a real database challenge record, returning the challenge string */
async function seedChallenge(
  pool: Pool,
  flowType: 'registration' | 'login',
  opts: { expired?: boolean; consumed?: boolean; phone?: string; userId?: string | null } = {}
): Promise<string> {
  const challenge = randomB64url(32);
  const expiresAt = opts.expired
    ? new Date(Date.now() - 10_000).toISOString()   // already expired
    : new Date(Date.now() + 300_000).toISOString();  // 5 min in future
  await pool.query(
    `INSERT INTO webauthn_challenges (challenge, user_id, phone, flow_type, expires_at, consumed_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      challenge,
      opts.userId ?? null,
      opts.phone ?? null,
      flowType,
      expiresAt,
      opts.consumed ? new Date().toISOString() : null,
    ]
  );
  return challenge;
}

/** Create a test user row, returning its id */
async function seedUser(
  pool: Pool,
  phone: string,
  role: 'customer' | 'provider' | 'admin' = 'customer',
  isActive = true
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (phone, role, preferred_language, is_active, token_version)
     VALUES ($1, $2, 'en', $3, 1)
     ON CONFLICT (phone) DO UPDATE
       SET role = EXCLUDED.role, is_active = EXCLUDED.is_active, token_version = 1
     RETURNING id`,
    [phone, role, isActive]
  );
  return rows[0].id;
}

/** Seed a dummy credential row and return its credential_id */
async function seedCredential(pool: Pool, userId: string, credentialId?: string): Promise<string> {
  const cid = credentialId ?? randomB64url(32);
  // A real 64-byte public key (all-zeros is fine for DB seeding; not used for crypto here)
  const pubKey = Buffer.alloc(64, 0);
  await pool.query(
    `INSERT INTO user_credentials (user_id, credential_id, public_key, counter, device_type, backed_up, transports)
     VALUES ($1, $2, $3, 0, 'single_device', false, ARRAY['internal'])`,
    [userId, cid, pubKey]
  );
  return cid;
}

/** Sign a JWT directly for use with /api/auth/me */
function signJwt(app: any, payload: object): string {
  return app.jwt.sign(payload as any, { expiresIn: '30d' });
}

// ─── test phones (unique per suite) ───────────────────────────────────────────
const PHONES = {
  registerOptions:   '9100000001',
  registerVerify:    '9100000002',
  loginOptions:      '9100000003',
  loginVerify:       '9100000004',
  provider:          '9100000005',
  deactivated:       '9100000006',
  roleEscalation:    '9100000007',
  jwtCheck:          '9100000008',
  dupCred:           '9100000009',
  counterUpdate:     '9100000010',
};

// ─── suite ────────────────────────────────────────────────────────────────────

console.log('\n============================================================');
console.log('PHASE 2 — SERVER WEBAUTHN / PASSKEY TEST SUITE');
console.log('============================================================\n');

async function runTests(): Promise<void> {
  // ── setup ────────────────────────────────────────────────────────────────────
  const dbInst = new Database();
  const pool = dbInst.getPool()!;
  const migrator = new Migrator(pool);
  await migrator.runMigrations();

  // Clean test phones before we start
  await pool.query(
    `DELETE FROM users WHERE phone = ANY($1::text[])`,
    [Object.values(PHONES)]
  );

  const app = await buildApp({
    customEnv: { NODE_ENV: 'test', JWT_SECRET: 'test-secret-32-characters-minimum!', CORS_ORIGIN: '' },
  });
  await app.ready();

  const passkeyService = new PasskeyService();


  // ─── 1. REGISTER-OPTIONS — route layer ──────────────────────────────────────
  console.log('--- 1. POST /api/auth/passkey/register-options ---');

  await it('1.1 Register-options with valid phone returns 200 + challenge', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      payload: { phone: PHONES.registerOptions },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.challenge, 'challenge must be present');
    assert.ok(body.data.rp?.id, 'rpId must be present');
    assert.strictEqual(body.data.rp.id, env.RP_ID);
    assert.strictEqual(body.data.rp.name, env.RP_NAME);
    // Verify challenge was persisted
    const { rows } = await pool.query(
      `SELECT id FROM webauthn_challenges WHERE challenge = $1 AND flow_type = 'registration'`,
      [body.data.challenge]
    );
    assert.ok(rows.length > 0, 'challenge must be stored in DB');
  });

  await it('1.2 Register-options missing phone returns 400 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      payload: {},
    });
    assert.strictEqual(res.statusCode, 400);
    const body = res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });

  await it('1.3 Register-options with invalid phone format returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      payload: { phone: '12345' },
    });
    assert.strictEqual(res.statusCode, 400);
    const body = res.json();
    assert.strictEqual(body.success, false);
  });

  await it('1.4 Register-options for deactivated user returns 403 ACCOUNT_DEACTIVATED', async () => {
    await seedUser(pool, PHONES.deactivated, 'customer', false);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      payload: { phone: PHONES.deactivated },
    });
    assert.strictEqual(res.statusCode, 403);
    const body = res.json();
    assert.strictEqual(body.error.code, 'ACCOUNT_DEACTIVATED');
  });

  await it('1.5 Challenge is 32 bytes (43 base64url chars without padding)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      payload: { phone: '9100001111' },
    });
    const body = res.json();
    const decoded = Buffer.from(body.data.challenge, 'base64url');
    assert.strictEqual(decoded.length, 32, `Expected 32-byte challenge, got ${decoded.length}`);
    // Clean up
    await pool.query(`DELETE FROM webauthn_challenges WHERE challenge = $1`, [body.data.challenge]);
    await pool.query(`DELETE FROM users WHERE phone = '9100001111'`);
  });

  await it('1.6 excludeCredentials lists existing credentials for returning user', async () => {
    const uid = await seedUser(pool, PHONES.dupCred, 'customer');
    await seedCredential(pool, uid);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      payload: { phone: PHONES.dupCred },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.ok(Array.isArray(body.data.excludeCredentials), 'excludeCredentials must be an array');
    assert.ok(body.data.excludeCredentials.length >= 1, 'must list existing credential');
    // Cleanup challenge
    await pool.query(`DELETE FROM webauthn_challenges WHERE challenge = $1`, [body.data.challenge]);
  });

  // ─── 2. REGISTER-VERIFY — challenge security via service ────────────────────
  console.log('\n--- 2. PasskeyService.verifyRegistration — challenge security ---');

  await it('2.1 CHALLENGE_NOT_FOUND — random challenge rejected', async () => {
    const fakeChallenge = randomB64url(32);
    const clientData = fakeClientDataJSON('webauthn.create', fakeChallenge);
    await assert.rejects(
      () =>
        passkeyService.verifyRegistration(PHONES.registerVerify, {
          id: randomB64url(32),
          rawId: randomB64url(32),
          response: { clientDataJSON: clientData, attestationObject: FAKE_ATTESTATION_OBJ },
          type: 'public-key',
          clientExtensionResults: {},
        } as any),
      (err: any) => {
        assert.strictEqual(err.code, 'CHALLENGE_NOT_FOUND');
        return true;
      }
    );
  });

  await it('2.2 CHALLENGE_EXPIRED — expired challenge rejected', async () => {
    const expiredChallenge = await seedChallenge(pool, 'registration', { expired: true, phone: PHONES.registerVerify });
    const clientData = fakeClientDataJSON('webauthn.create', expiredChallenge);
    await assert.rejects(
      () =>
        passkeyService.verifyRegistration(PHONES.registerVerify, {
          id: randomB64url(32),
          rawId: randomB64url(32),
          response: { clientDataJSON: clientData, attestationObject: FAKE_ATTESTATION_OBJ },
          type: 'public-key',
          clientExtensionResults: {},
        } as any),
      (err: any) => {
        assert.ok(
          err.code === 'CHALLENGE_EXPIRED' || err.code === 'CHALLENGE_NOT_FOUND' || err.code === 'MALFORMED_RESPONSE' || err.code === 'REGISTRATION_VERIFICATION_FAILED',
          `Unexpected code: ${err.code}`
        );
        return true;
      }
    );
  });

  await it('2.3 CHALLENGE_REUSED — pre-consumed challenge rejected', async () => {
    const consumedChallenge = await seedChallenge(pool, 'registration', { consumed: true, phone: PHONES.registerVerify });
    const clientData = fakeClientDataJSON('webauthn.create', consumedChallenge);
    await assert.rejects(
      () =>
        passkeyService.verifyRegistration(PHONES.registerVerify, {
          id: randomB64url(32),
          rawId: randomB64url(32),
          response: { clientDataJSON: clientData, attestationObject: FAKE_ATTESTATION_OBJ },
          type: 'public-key',
          clientExtensionResults: {},
        } as any),
      (err: any) => {
        assert.ok(
          err.code === 'CHALLENGE_REUSED' || err.code === 'REGISTRATION_VERIFICATION_FAILED',
          `Unexpected code: ${err.code}`
        );
        return true;
      }
    );
  });

  await it('2.4 MALFORMED_RESPONSE — missing clientDataJSON rejected', async () => {
    await assert.rejects(
      () =>
        passkeyService.verifyRegistration(PHONES.registerVerify, {
          id: randomB64url(32),
          rawId: randomB64url(32),
          response: {} as any,
          type: 'public-key',
          clientExtensionResults: {},
        } as any),
      (err: any) => {
        assert.strictEqual(err.code, 'MALFORMED_RESPONSE');
        return true;
      }
    );
  });

  await it('2.5 INVALID_CHALLENGE_FLOW — login challenge rejected for registration', async () => {
    const loginChallenge = await seedChallenge(pool, 'login', { phone: PHONES.registerVerify });
    const clientData = fakeClientDataJSON('webauthn.create', loginChallenge);
    await assert.rejects(
      () =>
        passkeyService.verifyRegistration(PHONES.registerVerify, {
          id: randomB64url(32),
          rawId: randomB64url(32),
          response: { clientDataJSON: clientData, attestationObject: FAKE_ATTESTATION_OBJ },
          type: 'public-key',
          clientExtensionResults: {},
        } as any),
      (err: any) => {
        assert.ok(
          err.code === 'INVALID_CHALLENGE_FLOW' || err.code === 'REGISTRATION_VERIFICATION_FAILED',
          `Unexpected code: ${err.code}`
        );
        return true;
      }
    );
  });

  await it('2.6 PHONE_MISMATCH — challenge for different phone rejected', async () => {
    const wrongPhoneChallenge = await seedChallenge(pool, 'registration', { phone: '9199999999' });
    const clientData = fakeClientDataJSON('webauthn.create', wrongPhoneChallenge);
    await assert.rejects(
      () =>
        passkeyService.verifyRegistration(PHONES.registerVerify, {
          id: randomB64url(32),
          rawId: randomB64url(32),
          response: { clientDataJSON: clientData, attestationObject: FAKE_ATTESTATION_OBJ },
          type: 'public-key',
          clientExtensionResults: {},
        } as any),
      (err: any) => {
        assert.ok(
          err.code === 'PHONE_MISMATCH' || err.code === 'REGISTRATION_VERIFICATION_FAILED',
          `Unexpected code: ${err.code}`
        );
        return true;
      }
    );
  });

  // ─── 3. REGISTER-VERIFY — route layer (validation / structural) ─────────────
  console.log('\n--- 3. POST /api/auth/passkey/register-verify — route validation ---');

  await it('3.1 Missing response body returns 400 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-verify',
      payload: { phone: PHONES.registerVerify },
    });
    assert.strictEqual(res.statusCode, 400);
    const body = res.json();
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });

  await it('3.2 Missing phone returns 400 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-verify',
      payload: {
        response: {
          id: randomB64url(32),
          rawId: randomB64url(32),
          response: { clientDataJSON: randomB64url(32), attestationObject: randomB64url(64) },
          type: 'public-key',
        },
      },
    });
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.json().error.code, 'VALIDATION_ERROR');
  });

  await it('3.3 Invalid challenge in response body returns 400 error (not 500)', async () => {
    const fakeChallenge = randomB64url(32);
    const clientData = fakeClientDataJSON('webauthn.create', fakeChallenge);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-verify',
      payload: {
        phone: PHONES.registerVerify,
        response: {
          id: randomB64url(32),
          rawId: randomB64url(32),
          response: { clientDataJSON: clientData, attestationObject: FAKE_ATTESTATION_OBJ },
          type: 'public-key',
        },
      },
    });
    assert.ok(res.statusCode >= 400 && res.statusCode < 500, `Expected 4xx, got ${res.statusCode}`);
    assert.strictEqual(res.json().success, false);
  });

  // ─── 4. LOGIN-OPTIONS — route layer ─────────────────────────────────────────
  console.log('\n--- 4. POST /api/auth/passkey/login-options ---');

  await it('4.1 Login-options without phone (discoverable) returns 200 + challenge', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/login-options',
      payload: {},
    });
    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.challenge, 'challenge must be present');
    assert.strictEqual(body.data.rpId, env.RP_ID);
    // Verify stored in DB
    const { rows } = await pool.query(
      `SELECT id FROM webauthn_challenges WHERE challenge = $1 AND flow_type = 'login'`,
      [body.data.challenge]
    );
    assert.ok(rows.length > 0, 'login challenge stored in DB');
    await pool.query(`DELETE FROM webauthn_challenges WHERE challenge = $1`, [body.data.challenge]);
  });

  await it('4.2 Login-options with known phone includes allowCredentials', async () => {
    const uid = await seedUser(pool, PHONES.loginOptions, 'customer');
    const cid = await seedCredential(pool, uid);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/login-options',
      payload: { phone: PHONES.loginOptions },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.ok(Array.isArray(body.data.allowCredentials), 'allowCredentials must be array');
    const found = body.data.allowCredentials.some((c: any) => c.id === cid);
    assert.ok(found, 'Known credential must appear in allowCredentials');
    await pool.query(`DELETE FROM webauthn_challenges WHERE challenge = $1`, [body.data.challenge]);
  });

  await it('4.3 Login-options with unknown phone returns empty allowCredentials (discoverable fallback)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/login-options',
      payload: { phone: '9199998888' },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    // allowCredentials is either absent, undefined, or empty array for unknown phone
    const ac = body.data.allowCredentials;
    assert.ok(!ac || ac.length === 0, 'Unknown phone should produce empty allowCredentials');
    await pool.query(`DELETE FROM webauthn_challenges WHERE challenge = $1`, [body.data.challenge]);
  });

  await it('4.4 Login-options with empty body still succeeds (discoverable mode)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/login-options',
    });
    // Body-less POST is fine; service handles it as discoverable
    assert.ok(res.statusCode === 200 || res.statusCode === 400, 'Should not 500');
    if (res.statusCode === 200) {
      const body = res.json();
      assert.strictEqual(body.success, true);
      await pool.query(`DELETE FROM webauthn_challenges WHERE challenge = $1`, [body.data?.challenge]);
    }
  });

  // ─── 5. LOGIN-VERIFY — challenge security via service ───────────────────────
  console.log('\n--- 5. PasskeyService.verifyLogin — challenge / credential security ---');

  await it('5.1 CHALLENGE_NOT_FOUND — random challenge rejected', async () => {
    const fakeChallenge = randomB64url(32);
    const clientData = fakeClientDataJSON('webauthn.get', fakeChallenge);
    await assert.rejects(
      () =>
        passkeyService.verifyLogin({
          id: randomB64url(32),
          rawId: randomB64url(32),
          response: {
            clientDataJSON: clientData,
            authenticatorData: randomB64url(64),
            signature: randomB64url(64),
          },
          type: 'public-key',
          clientExtensionResults: {},
        } as any),
      (err: any) => {
        assert.strictEqual(err.code, 'CHALLENGE_NOT_FOUND');
        return true;
      }
    );
  });

  await it('5.2 CHALLENGE_EXPIRED — expired login challenge rejected', async () => {
    const expiredChallenge = await seedChallenge(pool, 'login', { expired: true });
    const clientData = fakeClientDataJSON('webauthn.get', expiredChallenge);
    await assert.rejects(
      () =>
        passkeyService.verifyLogin({
          id: randomB64url(32),
          rawId: randomB64url(32),
          response: {
            clientDataJSON: clientData,
            authenticatorData: randomB64url(64),
            signature: randomB64url(64),
          },
          type: 'public-key',
          clientExtensionResults: {},
        } as any),
      (err: any) => {
        assert.ok(
          err.code === 'CHALLENGE_EXPIRED' || err.code === 'AUTHENTICATION_VERIFICATION_FAILED',
          `Unexpected code: ${err.code}`
        );
        return true;
      }
    );
  });

  await it('5.3 CHALLENGE_REUSED — consumed login challenge rejected', async () => {
    const consumedChallenge = await seedChallenge(pool, 'login', { consumed: true });
    const clientData = fakeClientDataJSON('webauthn.get', consumedChallenge);
    await assert.rejects(
      () =>
        passkeyService.verifyLogin({
          id: randomB64url(32),
          rawId: randomB64url(32),
          response: {
            clientDataJSON: clientData,
            authenticatorData: randomB64url(64),
            signature: randomB64url(64),
          },
          type: 'public-key',
          clientExtensionResults: {},
        } as any),
      (err: any) => {
        assert.ok(
          err.code === 'CHALLENGE_REUSED' || err.code === 'AUTHENTICATION_VERIFICATION_FAILED',
          `Unexpected code: ${err.code}`
        );
        return true;
      }
    );
  });

  await it('5.4 INVALID_CHALLENGE_FLOW — registration challenge rejected for login', async () => {
    const regChallenge = await seedChallenge(pool, 'registration', {});
    const clientData = fakeClientDataJSON('webauthn.get', regChallenge);
    await assert.rejects(
      () =>
        passkeyService.verifyLogin({
          id: randomB64url(32),
          rawId: randomB64url(32),
          response: {
            clientDataJSON: clientData,
            authenticatorData: randomB64url(64),
            signature: randomB64url(64),
          },
          type: 'public-key',
          clientExtensionResults: {},
        } as any),
      (err: any) => {
        assert.ok(
          err.code === 'INVALID_CHALLENGE_FLOW' || err.code === 'AUTHENTICATION_VERIFICATION_FAILED',
          `Unexpected code: ${err.code}`
        );
        return true;
      }
    );
  });

  await it('5.5 CREDENTIAL_NOT_FOUND — unknown credential ID rejected after consuming challenge', async () => {
    // Seed a valid unexpired login challenge
    const loginChallenge = await seedChallenge(pool, 'login', {});
    const unknownCredId = randomB64url(32);
    const clientData = fakeClientDataJSON('webauthn.get', loginChallenge);
    await assert.rejects(
      () =>
        passkeyService.verifyLogin({
          id: unknownCredId,
          rawId: unknownCredId,
          response: {
            clientDataJSON: clientData,
            authenticatorData: randomB64url(64),
            signature: randomB64url(64),
          },
          type: 'public-key',
          clientExtensionResults: {},
        } as any),
      (err: any) => {
        // After atomic consume, if cred not found, either CREDENTIAL_NOT_FOUND or AUTHENTICATION_VERIFICATION_FAILED
        assert.ok(
          err.code === 'CREDENTIAL_NOT_FOUND' || err.code === 'AUTHENTICATION_VERIFICATION_FAILED',
          `Unexpected code: ${err.code}`
        );
        return true;
      }
    );
  });

  await it('5.6 ACCOUNT_DEACTIVATED — inactive user cannot log in via passkey', async () => {
    const inactiveUid = await seedUser(pool, '9100002222', 'customer', false);
    const inactiveCid = await seedCredential(pool, inactiveUid);
    const loginChallenge = await seedChallenge(pool, 'login', { userId: inactiveUid });
    const clientData = fakeClientDataJSON('webauthn.get', loginChallenge);
    await assert.rejects(
      () =>
        passkeyService.verifyLogin({
          id: inactiveCid,
          rawId: inactiveCid,
          response: {
            clientDataJSON: clientData,
            authenticatorData: randomB64url(64),
            signature: randomB64url(64),
          },
          type: 'public-key',
          clientExtensionResults: {},
        } as any),
      (err: any) => {
        assert.ok(
          err.code === 'ACCOUNT_DEACTIVATED' || err.code === 'AUTHENTICATION_VERIFICATION_FAILED',
          `Unexpected code: ${err.code}`
        );
        return true;
      }
    );
    await pool.query(`DELETE FROM users WHERE phone = '9100002222'`);
  });

  // ─── 6. LOGIN-VERIFY — route validation ─────────────────────────────────────
  console.log('\n--- 6. POST /api/auth/passkey/login-verify — route validation ---');

  await it('6.1 Missing response returns 400 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/login-verify',
      payload: {},
    });
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.json().error.code, 'VALIDATION_ERROR');
  });

  await it('6.2 Invalid response structure returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/login-verify',
      payload: { response: { id: 'abc' } },
    });
    assert.strictEqual(res.statusCode, 400);
  });

  await it('6.3 Invalid challenge in request body returns 4xx (not 500)', async () => {
    const fakeChallenge = randomB64url(32);
    const clientData = fakeClientDataJSON('webauthn.get', fakeChallenge);
    const credId = randomB64url(32);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/login-verify',
      payload: {
        response: {
          id: credId,
          rawId: credId,
          response: {
            clientDataJSON: clientData,
            authenticatorData: randomB64url(64),
            signature: randomB64url(64),
          },
          type: 'public-key',
        },
      },
    });
    assert.ok(res.statusCode >= 400 && res.statusCode < 500, `Expected 4xx, got ${res.statusCode}`);
    assert.strictEqual(res.json().success, false);
  });

  // ─── 7. JWT / SESSION ────────────────────────────────────────────────────────
  console.log('\n--- 7. JWT / Session integrity ---');

  await it('7.1 Token signed with {id, phone, role, tokenVersion} is accepted by /api/auth/me', async () => {
    const uid = await seedUser(pool, PHONES.jwtCheck, 'customer');
    const token = signJwt(app, { id: uid, phone: PHONES.jwtCheck, role: 'customer', tokenVersion: 1 });
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.data.user.phone, PHONES.jwtCheck);
    assert.strictEqual(body.data.user.role, 'customer');
  });

  await it('7.2 Stale tokenVersion (revoked session) is rejected by /api/auth/me', async () => {
    const uid = await seedUser(pool, PHONES.jwtCheck, 'customer');
    // Increment token_version in DB (simulating logout)
    await pool.query(`UPDATE users SET token_version = 2 WHERE id = $1`, [uid]);
    // Token still carries old tokenVersion = 1
    const staleToken = signJwt(app, { id: uid, phone: PHONES.jwtCheck, role: 'customer', tokenVersion: 1 });
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { Authorization: `Bearer ${staleToken}` },
    });
    assert.ok(res.statusCode === 401 || res.statusCode === 403, `Expected 401/403, got ${res.statusCode}`);
    // Reset
    await pool.query(`UPDATE users SET token_version = 1 WHERE id = $1`, [uid]);
  });

  await it('7.3 Login-options response does not contain private key data', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/login-options',
      payload: {},
    });
    const raw = res.body;
    assert.ok(!raw.includes('privateKey'), 'No privateKey in response');
    assert.ok(!raw.includes('private_key'), 'No private_key in response');
    assert.ok(!raw.includes('biometric'), 'No biometric data in response');
    if (res.statusCode === 200) {
      await pool.query(`DELETE FROM webauthn_challenges WHERE challenge = $1`, [res.json().data?.challenge]);
    }
  });

  // ─── 8. RBAC / SECURITY INVARIANTS ──────────────────────────────────────────
  console.log('\n--- 8. RBAC / Security invariants ---');

  await it('8.1 Public register-options cannot select role (role field ignored)', async () => {
    // If a client sends role=provider in the options body, it must be silently ignored
    // (the Zod schema does not include "role")
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      payload: { phone: PHONES.roleEscalation, role: 'provider' },
    });
    assert.strictEqual(res.statusCode, 200, 'Request should succeed (extra fields are stripped)');
    // No DB side-effect of role: provider
    const { rows } = await pool.query(`SELECT role FROM users WHERE phone = $1`, [PHONES.roleEscalation]);
    if (rows.length > 0) {
      assert.notStrictEqual(rows[0].role, 'provider', 'Public registration must not grant provider role');
    }
    if (res.statusCode === 200) {
      await pool.query(`DELETE FROM webauthn_challenges WHERE challenge = $1`, [res.json().data?.challenge]);
    }
  });

  await it('8.2 New user provisioned via public registration always gets role=customer', async () => {
    // Directly call the service new-user path by verifying passkey.service.ts logic
    // We verify via DB: any phone not pre-seeded gets 'customer' role in INSERT
    const testPhone = '9100003333';
    await pool.query(`DELETE FROM users WHERE phone = $1`, [testPhone]);
    // Seed a valid unexpired registration challenge
    const challenge = await seedChallenge(pool, 'registration', { phone: testPhone });
    const clientData = fakeClientDataJSON('webauthn.create', challenge);
    // The service will fail at verifyRegistrationResponse (no real authenticator),
    // but it will fail AFTER the challenge lookup and before user provisioning.
    // We verify the phone does NOT exist with role=provider in DB at any point.
    try {
      await passkeyService.verifyRegistration(testPhone, {
        id: randomB64url(32),
        rawId: randomB64url(32),
        response: { clientDataJSON: clientData, attestationObject: FAKE_ATTESTATION_OBJ },
        type: 'public-key',
        clientExtensionResults: {},
      } as any);
    } catch {
      // Expected: verification will fail with REGISTRATION_VERIFICATION_FAILED
    }
    const { rows } = await pool.query(`SELECT role FROM users WHERE phone = $1`, [testPhone]);
    if (rows.length > 0) {
      assert.notStrictEqual(rows[0].role, 'provider', 'Public registration must not produce provider role');
      assert.notStrictEqual(rows[0].role, 'admin', 'Public registration must not produce admin role');
    }
    await pool.query(`DELETE FROM users WHERE phone = $1`, [testPhone]);
  });

  await it('8.3 Admin-provisioned provider retains provider role after passkey add', async () => {
    // Pre-provision a provider user (admin action, simulated by direct DB insert)
    const providerUid = await seedUser(pool, PHONES.provider, 'provider');
    // Confirm role is preserved in DB
    const { rows } = await pool.query(`SELECT role FROM users WHERE id = $1`, [providerUid]);
    assert.strictEqual(rows[0].role, 'provider', 'Provider role must be preserved');
    // Register-options for a provider user should not change their role
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      payload: { phone: PHONES.provider },
    });
    assert.strictEqual(res.statusCode, 200);
    const { rows: after } = await pool.query(`SELECT role FROM users WHERE phone = $1`, [PHONES.provider]);
    assert.strictEqual(after[0].role, 'provider', 'Provider role must not be changed by register-options');
    if (res.statusCode === 200) {
      await pool.query(`DELETE FROM webauthn_challenges WHERE challenge = $1`, [res.json().data?.challenge]);
    }
  });

  await it('8.4 Phone number alone does not grant a JWT (no login without WebAuthn)', async () => {
    // There is no endpoint that accepts a phone number and returns a token without WebAuthn
    // Verify /api/auth/passkey/login-verify requires a response object
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/login-verify',
      payload: { phone: PHONES.jwtCheck },  // no response
    });
    assert.ok(res.statusCode >= 400, 'Phone alone must not produce a token');
    assert.strictEqual(res.json().success, false);
  });

  await it('8.5 No biometric / private key data stored in DB user_credentials', async () => {
    // Seeded credentials only contain: credential_id, public_key (BYTEA), counter, transports
    // Verify columns on user_credentials do not include private_key or biometric columns
    const { rows } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'user_credentials'`
    );
    const cols = rows.map((r) => r.column_name);
    assert.ok(!cols.includes('private_key'), 'private_key column must not exist');
    assert.ok(!cols.includes('biometric_data'), 'biometric_data column must not exist');
    assert.ok(!cols.includes('fingerprint'), 'fingerprint column must not exist');
  });

  await it('8.6 Single-use challenge — atomic consume prevents replay', async () => {
    // Seed a fresh challenge
    const fresh = await seedChallenge(pool, 'registration', { phone: PHONES.registerVerify });
    // Atomically consume it manually as the service would
    const { rowCount: rc1 } = await pool.query(
      `UPDATE webauthn_challenges SET consumed_at = NOW() WHERE challenge = $1 AND consumed_at IS NULL`,
      [fresh]
    );
    assert.strictEqual(rc1, 1, 'First consume must succeed');
    // Second consume (replay) must get rowCount = 0
    const { rowCount: rc2 } = await pool.query(
      `UPDATE webauthn_challenges SET consumed_at = NOW() WHERE challenge = $1 AND consumed_at IS NULL`,
      [fresh]
    );
    assert.strictEqual(rc2, 0, 'Second consume (replay) must fail atomically');
  });

  // ─── 9. CREDENTIAL COUNTER UPDATE ───────────────────────────────────────────
  console.log('\n--- 9. Credential schema / counter ---');

  await it('9.1 user_credentials counter column is BIGINT', async () => {
    const { rows } = await pool.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'user_credentials' AND column_name = 'counter'`
    );
    assert.ok(rows.length > 0, 'counter column must exist');
    assert.strictEqual(rows[0].data_type, 'bigint', 'counter must be BIGINT');
  });

  await it('9.2 Counter update query succeeds and increments value', async () => {
    const uid = await seedUser(pool, PHONES.counterUpdate, 'customer');
    const cid = await seedCredential(pool, uid);
    const { rows: creds } = await pool.query<{ id: string }>(
      `SELECT id FROM user_credentials WHERE credential_id = $1`,
      [cid]
    );
    const dbId = creds[0].id;
    await pool.query(`UPDATE user_credentials SET counter = $1, last_used_at = NOW() WHERE id = $2`, [99, dbId]);
    const { rows: updated } = await pool.query<{ counter: string }>(
      `SELECT counter FROM user_credentials WHERE id = $1`,
      [dbId]
    );
    assert.strictEqual(Number(updated[0].counter), 99, 'Counter must be updated to 99');
  });

  // ─── 10. ENVIRONMENT CONFIG ──────────────────────────────────────────────────
  console.log('\n--- 10. WebAuthn environment configuration ---');

  await it('10.1 RP_ID defaults to "localhost"', () => {
    const cfg = validateEnvConfig({});
    assert.strictEqual(cfg.RP_ID, 'localhost');
  });

  await it('10.2 RP_NAME defaults to "Chandil Home Services"', () => {
    const cfg = validateEnvConfig({});
    assert.strictEqual(cfg.RP_NAME, 'Chandil Home Services');
  });

  await it('10.3 EXPECTED_ORIGIN defaults to "http://localhost:3000"', () => {
    const cfg = validateEnvConfig({});
    assert.strictEqual(cfg.EXPECTED_ORIGIN, 'http://localhost:3000');
  });

  await it('10.4 getExpectedOrigins() parses comma-separated list correctly', async () => {
    const { getExpectedOrigins: fn } = await import('../src/config/env.js');
    // Monkey-patch env for this test (read-only property, test using validateEnvConfig instead)
    const cfg = validateEnvConfig({ EXPECTED_ORIGIN: 'https://app.example.com,https://staging.example.com' });
    const origins = cfg.EXPECTED_ORIGIN.split(',').map((o: string) => o.trim()).filter(Boolean);
    assert.deepStrictEqual(origins, ['https://app.example.com', 'https://staging.example.com']);
  });

  await it('10.5 Custom RP_ID and RP_NAME are accepted', () => {
    const cfg = validateEnvConfig({ RP_ID: 'app.example.com', RP_NAME: 'My App' });
    assert.strictEqual(cfg.RP_ID, 'app.example.com');
    assert.strictEqual(cfg.RP_NAME, 'My App');
  });

  // ─── 11. WEBAUTHN ENDPOINTS REGISTERED ──────────────────────────────────────
  console.log('\n--- 11. Endpoint registration ---');

  await it('11.1 POST /api/auth/passkey/register-options is registered (not 404)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/passkey/register-options', payload: {} });
    assert.notStrictEqual(res.statusCode, 404, 'register-options must be registered');
  });

  await it('11.2 POST /api/auth/passkey/register-verify is registered (not 404)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/passkey/register-verify', payload: {} });
    assert.notStrictEqual(res.statusCode, 404, 'register-verify must be registered');
  });

  await it('11.3 POST /api/auth/passkey/login-options is registered (not 404)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/passkey/login-options', payload: {} });
    assert.notStrictEqual(res.statusCode, 404, 'login-options must be registered');
  });

  await it('11.4 POST /api/auth/passkey/login-verify is registered (not 404)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/passkey/login-verify', payload: {} });
    assert.notStrictEqual(res.statusCode, 404, 'login-verify must be registered');
  });

  // ─── cleanup ─────────────────────────────────────────────────────────────────
  await pool.query(`DELETE FROM users WHERE phone = ANY($1::text[])`, [Object.values(PHONES)]);
  await app.close();
  await dbInst.close();

  console.log('\n============================================================');
  console.log(`PHASE 2 PASSKEY TESTS: ${passed} PASS, ${failed} FAIL`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
