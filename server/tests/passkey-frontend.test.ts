import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { en } from '../../shared/i18n/en';
import { hi } from '../../shared/i18n/hi';
import { User, ApiResponse } from '../../shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n============================================================');
console.log('PHASE 4 — FRONTEND PASSKEY & WEBAUTHN UI/STATE TEST SUITE');
console.log('============================================================\n');

let passCount = 0;
let failCount = 0;

function testAssert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${description}`);
    failCount++;
  }
}

// Setup Browser Environment Mocks
const mockLocalStorageStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => mockLocalStorageStore[key] ?? null,
  setItem: (key: string, val: string) => { mockLocalStorageStore[key] = val; },
  removeItem: (key: string) => { delete mockLocalStorageStore[key]; },
  clear: () => {
    for (const k of Object.keys(mockLocalStorageStore)) delete mockLocalStorageStore[k];
  },
};

(globalThis as any).window = globalThis;
(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).PublicKeyCredential = function() {};

function createMockAuthCredential() {
  const rawId = new Uint8Array([1, 2, 3, 4]).buffer;
  const authData = new Uint8Array([5, 6, 7, 8]).buffer;
  const clientData = new TextEncoder().encode(
    JSON.stringify({ type: 'webauthn.get', challenge: 'test', origin: 'http://localhost:3000' })
  ).buffer;
  const sig = new Uint8Array([9, 10]).buffer;

  return {
    id: 'mock-auth-cred-id',
    rawId,
    response: {
      authenticatorData: authData,
      clientDataJSON: clientData,
      signature: sig,
      userHandle: null,
    },
    getClientExtensionResults: () => ({}),
    type: 'public-key',
  };
}

function createMockRegCredential() {
  const rawId = new Uint8Array([11, 12, 13, 14]).buffer;
  const attObj = new Uint8Array([15, 16, 17, 18]).buffer;
  const clientData = new TextEncoder().encode(
    JSON.stringify({ type: 'webauthn.create', challenge: 'test', origin: 'http://localhost:3000' })
  ).buffer;

  return {
    id: 'mock-reg-cred-id',
    rawId,
    response: {
      attestationObject: attObj,
      clientDataJSON: clientData,
      getTransports: () => ['internal'],
    },
    getClientExtensionResults: () => ({}),
    type: 'public-key',
  };
}

function setMockNavigator(credentials: { get?: any; create?: any }) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { credentials },
    configurable: true,
    writable: true,
  });
}

setMockNavigator({
  get: async () => createMockAuthCredential(),
  create: async () => createMockRegCredential(),
});

// Dynamic import of client auth state after window/localStorage mocks
const {
  authToken,
  currentUser,
  isAuthenticated,
  authMode,
  phoneInput,
  fullNameInput,
  authLoading,
  authError,
  authCancelled,
  loginWithPasskey,
  registerPasskey,
  refreshSession,
  logout,
  handleSessionExpired,
  REGISTERED_HINT_KEY,
  getInitialAuthMode,
} = await import('../../client/src/state/auth');

const { currentLanguage, selectLanguage, t } = await import('../../client/src/state/language');

async function runPasskeyFrontendTests() {
  // Reset state
  function resetState() {
    mockLocalStorage.clear();
    authToken.value = null;
    currentUser.value = null;
    authMode.value = 'login';
    phoneInput.value = '';
    fullNameInput.value = '';
    authLoading.value = false;
    authError.value = null;
    authCancelled.value = false;
    selectLanguage('hi');

    setMockNavigator({
      get: async () => createMockAuthCredential(),
      create: async () => createMockRegCredential(),
    });
  }

  // --- 1. UI Component Source Inspection ---
  console.log('--- 1. LoginScreen UI Component Audit ---');
  const loginScreenPath = path.resolve(__dirname, '../../client/src/components/LoginScreen.tsx');
  testAssert(fs.existsSync(loginScreenPath), '1.1 LoginScreen.tsx exists on disk');
  const loginScreenSrc = fs.readFileSync(loginScreenPath, 'utf8');

  testAssert(!loginScreenSrc.includes('request-otp'), '1.2 LoginScreen contains NO request-otp references');
  testAssert(!loginScreenSrc.includes('verify-otp'), '1.3 LoginScreen contains NO verify-otp references');
  testAssert(!loginScreenSrc.includes('otpInput'), '1.4 LoginScreen contains NO otpInput references');
  testAssert(!loginScreenSrc.includes('resendCooldown'), '1.5 LoginScreen contains NO resendCooldown references');
  testAssert(!loginScreenSrc.includes('mockOtpHint'), '1.6 LoginScreen contains NO mockOtpHint references');
  testAssert(loginScreenSrc.includes('loginWithPasskey'), '1.7 LoginScreen wires loginWithPasskey action');
  testAssert(loginScreenSrc.includes('registerPasskey'), '1.8 LoginScreen wires registerPasskey action');
  testAssert(loginScreenSrc.includes('min-h-[48px]'), '1.9 Enforces 48px touch targets for mobile accessibility');
  testAssert(loginScreenSrc.includes("t('app.title')"), '1.10 Wires centralized translation strings');

  // --- 2. Zero Active Client OTP Dependencies ---
  console.log('\n--- 2. Zero Active Client OTP Dependencies Audit ---');
  const clientSrcDir = path.resolve(__dirname, '../../client/src');
  function scanDir(dir: string): string[] {
    let results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(scanDir(fullPath));
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        results.push(fullPath);
      }
    }
    return results;
  }
  const clientFiles = scanDir(clientSrcDir);
  let otpLeaked = false;
  const otpPatterns = ['request-otp', 'verify-otp', 'otpInput', 'authStep', 'resendCooldown', 'mockOtpHint', 'DEV_MOCK_OTP'];
  for (const file of clientFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pat of otpPatterns) {
      if (content.includes(pat)) {
        console.error(`  Leaked pattern ${pat} in ${file}`);
        otpLeaked = true;
      }
    }
  }
  testAssert(!otpLeaked, '2.1 Entire client/src contains ZERO active OTP dependencies');

  // --- 3. Passkey Login Ceremony (Discoverable & Phone Hint) ---
  console.log('\n--- 3. Passkey Login Ceremony ---');
  resetState();

  let lastFetchUrl = '';
  let lastFetchOptions: any = null;

  // Mock server responses for successful login
  globalThis.fetch = async (url: any, opts: any) => {
    lastFetchUrl = url.toString();
    lastFetchOptions = opts;

    if (lastFetchUrl.endsWith('/api/auth/passkey/login-options')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            challenge: 'test-challenge-base64url-32bytes',
            timeout: 60000,
            rpId: 'localhost',
            userVerification: 'required',
          },
        }),
      } as any;
    }

    if (lastFetchUrl.endsWith('/api/auth/passkey/login-verify')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            token: 'valid.jwt.token',
            user: {
              id: 'user-uuid-1',
              phone: '9800012345',
              role: 'customer',
              fullName: 'Sunil Kumar',
              preferredLanguage: 'hi',
              isActive: true,
            },
          },
        }),
      } as any;
    }

    return { ok: false, json: async () => ({ success: false }) } as any;
  };

  // 3.1 Discoverable passkey login (no phone entered)
  phoneInput.value = '';
  const discoverableSuccess = await loginWithPasskey();
  testAssert(discoverableSuccess, '3.1 Discoverable passkey login succeeds');
  testAssert(lastFetchUrl.endsWith('/api/auth/passkey/login-verify'), '3.2 Submits assertion to /api/auth/passkey/login-verify');
  testAssert(authToken.value === 'valid.jwt.token', '3.3 Sets authToken signal');
  testAssert(currentUser.value?.id === 'user-uuid-1', '3.4 Sets currentUser signal');
  testAssert(isAuthenticated.value === true, '3.5 isAuthenticated computed is true');
  testAssert(mockLocalStorageStore['chandil_token'] === 'valid.jwt.token', '3.6 Persists token to localStorage');
  testAssert(JSON.parse(mockLocalStorageStore['chandil_user']).phone === '9800012345', '3.7 Persists user to localStorage');

  // 3.2 Phone-hinted passkey login
  resetState();
  phoneInput.value = '9800012345';
  let recordedLoginOptionsBody: any = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any, opts: any) => {
    if (url.toString().endsWith('/api/auth/passkey/login-options')) {
      recordedLoginOptionsBody = JSON.parse(opts.body);
    }
    return originalFetch(url, opts);
  };

  const phoneLoginSuccess = await loginWithPasskey();
  testAssert(phoneLoginSuccess, '3.8 Phone-hinted login succeeds');
  testAssert(recordedLoginOptionsBody?.phone === '9800012345', '3.9 Forwards phone hint in login-options body');

  // --- 4. Passkey Registration Ceremony ---
  console.log('\n--- 4. Passkey Registration Ceremony ---');
  resetState();
  authMode.value = 'register';
  phoneInput.value = '9800099999';
  fullNameInput.value = 'Ravi Shankar';

  let recordedRegOptionsBody: any = null;
  let recordedRegVerifyBody: any = null;

  globalThis.fetch = async (url: any, opts: any) => {
    const urlStr = url.toString();
    if (urlStr.endsWith('/api/auth/passkey/register-options')) {
      recordedRegOptionsBody = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            challenge: 'cmVnLWNoYWxsZW5nZS1iYXNlNjR1cmw',
            rp: { name: 'Chandil Home Services', id: 'localhost' },
            user: { id: 'dXNlci1pZC1ieXRlcw', name: '9800099999', displayName: 'Ravi Shankar' },
            pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          },
        }),
      } as any;
    }
    if (urlStr.endsWith('/api/auth/passkey/register-verify')) {
      recordedRegVerifyBody = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            token: 'reg.jwt.token',
            isNewUser: true,
            user: {
              id: 'new-user-uuid',
              phone: '9800099999',
              role: 'customer',
              fullName: 'Ravi Shankar',
              preferredLanguage: 'hi',
              isActive: true,
            },
          },
        }),
      } as any;
    }
    return { ok: false, json: async () => ({ success: false }) } as any;
  };

  const regSuccess = await registerPasskey();
  testAssert(regSuccess, '4.1 registerPasskey succeeds');
  testAssert(recordedRegOptionsBody?.phone === '9800099999', '4.2 Forwards phone to register-options');
  testAssert(recordedRegOptionsBody?.fullName === 'Ravi Shankar', '4.3 Forwards fullName to register-options');
  testAssert(recordedRegVerifyBody?.phone === '9800099999', '4.4 Forwards phone to register-verify');
  testAssert(recordedRegVerifyBody?.response?.id === 'mock-reg-cred-id', '4.5 Forwards WebAuthn credential to register-verify');
  testAssert(authToken.value === 'reg.jwt.token', '4.6 Stores registered user token');
  testAssert(currentUser.value?.fullName === 'Ravi Shankar', '4.7 Stores registered user profile');
  testAssert(currentUser.value?.role === 'customer', '4.8 Registration role is customer');

  // 4.9 Validation: invalid phone rejected without calling API
  resetState();
  let apiCalled = false;
  globalThis.fetch = async () => { apiCalled = true; return {} as any; };
  phoneInput.value = '12345';
  const invalidPhoneRes = await registerPasskey();
  testAssert(!invalidPhoneRes, '4.9 Rejects short phone number');
  testAssert(!apiCalled, '4.10 Does not invoke API when phone is invalid');
  testAssert(authError.value !== null, '4.11 Displays phone validation error');

  // --- 5. Error Handling & Edge Cases ---
  console.log('\n--- 5. Error Handling & Edge Cases ---');

  // 5.1 User Cancellation (NotAllowedError)
  resetState();
  globalThis.fetch = async (url: any) => {
    if (url.toString().endsWith('login-options')) {
      return { ok: true, json: async () => ({ success: true, data: { challenge: 'abc' } }) } as any;
    }
    return { ok: false } as any;
  };
  setMockNavigator({
    get: async () => {
      const err = new Error('The operation either timed out or was not allowed by the user.');
      err.name = 'NotAllowedError';
      throw err;
    },
  });
  const cancelRes = await loginWithPasskey();
  testAssert(!cancelRes, '5.1 Login returns false on user prompt cancellation');
  testAssert(authCancelled.value === true, '5.2 authCancelled flag set to true');
  testAssert(authError.value?.includes('रद्द') || authError.value?.includes('cancelled'), '5.3 User cancellation notice displayed');
  testAssert(!isAuthenticated.value, '5.4 User remains unauthenticated');

  // 5.2 No Passkey Found / InvalidStateError
  resetState();
  setMockNavigator({
    get: async () => {
      const err = new Error('No matching credentials found');
      err.name = 'NotFoundError';
      throw err;
    },
  });
  const noCredRes = await loginWithPasskey();
  testAssert(!noCredRes, '5.5 Login returns false on NotFoundError');
  testAssert(authError.value !== null, '5.6 Displays error when no passkey exists on device');

  // 5.3 Backend Server Error (401/400)
  resetState();
  globalThis.fetch = async (url: any) => {
    if (url.toString().endsWith('login-options')) {
      return { ok: true, json: async () => ({ success: true, data: { challenge: 'abc' } }) } as any;
    }
    return {
      ok: false,
      json: async () => ({
        success: false,
        error: { code: 'AUTHENTICATION_FAILED', messageEn: 'Passkey signature invalid', messageHi: 'पासकी हस्ताक्षर अमान्य है।' },
      }),
    } as any;
  };
  const serverFailRes = await loginWithPasskey();
  testAssert(!serverFailRes, '5.7 Returns false on backend verification rejection');
  testAssert(authError.value?.includes('पासकी') || authError.value?.includes('Passkey'), '5.8 Surfaces server error message');

  // 5.4 Network Failure
  resetState();
  globalThis.fetch = async () => { throw new Error('Failed to fetch'); };
  const netFailRes = await loginWithPasskey();
  testAssert(!netFailRes, '5.9 Returns false on network fetch rejection');
  testAssert(authError.value?.includes('नेटवर्क') || authError.value?.includes('Network'), '5.10 Shows network error');

  // --- 6. Session Lifecycle (Restore, Expire, Logout) ---
  console.log('\n--- 6. Session Lifecycle ---');
  resetState();
  mockLocalStorageStore['chandil_token'] = 'active.valid.token';
  authToken.value = 'active.valid.token';

  // 6.1 Session validation via /api/auth/me
  globalThis.fetch = async (url: any, opts: any) => {
    testAssert(opts.headers?.Authorization === 'Bearer active.valid.token', '6.1 Passes Bearer token to /api/auth/me');
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            id: 'verified-id',
            phone: '9800011111',
            role: 'provider',
            fullName: 'Gopal Mistri',
            preferredLanguage: 'hi',
            isActive: true,
          },
        },
      }),
    } as any;
  };
  const sessionValid = await refreshSession();
  testAssert(sessionValid, '6.2 refreshSession returns true for active session');
  testAssert(currentUser.value?.role === 'provider', '6.3 Restores verified provider user');

  // 6.2 Session Expired (Stale tokenVersion / 401)
  handleSessionExpired();
  testAssert(authToken.value === null, '6.4 Clears authToken on session expiration');
  testAssert(currentUser.value === null, '6.5 Clears currentUser on session expiration');
  testAssert(mockLocalStorageStore['chandil_token'] === undefined, '6.6 Removes token from localStorage');
  testAssert(authError.value?.includes('सत्र') || authError.value?.includes('Session'), '6.7 Sets session expired notice');

  // 6.3 Logout
  mockLocalStorageStore['chandil_token'] = 'token.to.logout';
  authToken.value = 'token.to.logout';
  let logoutCalled = false;
  globalThis.fetch = async (url: any) => {
    if (url.toString().endsWith('/api/auth/logout')) logoutCalled = true;
    return { ok: true, json: async () => ({ success: true }) } as any;
  };
  await logout();
  testAssert(authToken.value === null, '6.8 Clears authToken on logout');
  testAssert(logoutCalled, '6.9 Calls /api/auth/logout on server');
  testAssert(mockLocalStorageStore['chandil_token'] === undefined, '6.10 Removes token from localStorage');

  // --- 7. Role Routing Invariants ---
  console.log('\n--- 7. Single Application Role Routing ---');
  // Check that App routing code inspects authoritative currentUser.value.role
  const appPath = path.resolve(__dirname, '../../client/src/app.tsx');
  const appSrc = fs.readFileSync(appPath, 'utf8');

  testAssert(appSrc.includes("currentUser.value?.role === 'admin'"), '7.1 Admin role routes to AdminShell');
  testAssert(appSrc.includes("currentUser.value?.role === 'provider'"), '7.2 Provider role routes to ProviderHome / detail');
  testAssert(appSrc.includes('<CustomerHome />'), '7.3 Customer role routes to CustomerHome / booking views');
  testAssert(!appSrc.includes('localStorage.getItem("role")'), '7.4 Role is NOT determined from insecure local storage override');

  // --- 8. i18n Symmetry & Purity Audit ---
  console.log('\n--- 8. i18n Symmetry & Quality Audit ---');
  const enKeys = Object.keys(en);
  const hiKeys = Object.keys(hi);
  testAssert(enKeys.length === hiKeys.length, `8.1 Matching dictionary sizes: ${enKeys.length} keys each`);

  let allKeysSymmetric = true;
  for (const k of enKeys) {
    if (!hi[k as keyof typeof hi]) {
      allKeysSymmetric = false;
      console.error(`  Missing Hindi key: ${k}`);
    }
  }
  testAssert(allKeysSymmetric, '8.2 All keys symmetric across English and Hindi');

  // Verify pure Hindi for all auth keys (zero parenthetical English)
  let pureHindiAuth = true;
  for (const [k, v] of Object.entries(hi)) {
    if (k.startsWith('auth.')) {
      if (/\([A-Za-z\s/]+\)/.test(v)) {
        pureHindiAuth = false;
        console.error(`  Leaked parenthetical English in ${k}: ${v}`);
      }
    }
  }
  testAssert(pureHindiAuth, '8.3 Zero parenthetical English in Hindi auth keys');

  // --- 9. First-Launch & Returning-User UX / Zero Auto-Auth on Mount ---
  console.log('\n--- 9. First-Launch & Returning-User UX / Zero Auto-Auth on Mount ---');
  resetState();

  // 9.1 First-time user in clean client context defaults to 'register' (Create Passkey)
  mockLocalStorage.clear();
  testAssert(getInitialAuthMode() === 'register', '9.1 First-time user defaults to register mode (Create Passkey)');

  // 9.2 LoginScreen component audit: zero automatic authentication calls on mount
  testAssert(!loginScreenSrc.includes('useEffect'), '9.2 LoginScreen does not contain useEffect');
  testAssert(!loginScreenSrc.includes('componentDidMount'), '9.3 LoginScreen does not contain componentDidMount');
  testAssert(!loginScreenSrc.includes('startAuthentication()'), '9.4 LoginScreen does not call startAuthentication directly');
  const bodyBeforeReturn = loginScreenSrc.match(/export function LoginScreen\(\)\s*\{([\s\S]*?)return\s*\(/)?.[1] || '';
  const bodyOutsideHandlers = bodyBeforeReturn
    .replace(/const\s+handleLoginSubmit[\s\S]*?\};/, '')
    .replace(/const\s+handleRegisterSubmit[\s\S]*?\};/, '');
  testAssert(!/\bloginWithPasskey\s*\(/.test(bodyOutsideHandlers), '9.5 LoginScreen does not invoke loginWithPasskey at top-level');

  // 9.3 Mount state: authLoading is false, no ceremony underway
  testAssert(authLoading.value === false, '9.6 authLoading is false when unauthenticated screen mounts');

  // 9.4 Explicit button click starts login ceremony
  let loginCeremonyStarted = false;
  setMockNavigator({
    get: async () => {
      loginCeremonyStarted = true;
      return createMockAuthCredential();
    },
  });
  globalThis.fetch = async (url: any) => {
    if (url.toString().endsWith('/api/auth/passkey/login-options')) {
      return { ok: true, json: async () => ({ success: true, data: { challenge: 'chal-123' } }) } as any;
    }
    if (url.toString().endsWith('/api/auth/passkey/login-verify')) {
      return { ok: true, json: async () => ({ success: true, data: { token: 't1', user: { id: 'u1', phone: '9811001100', role: 'customer' } } }) } as any;
    }
    return { ok: true, json: async () => ({ success: true }) } as any;
  };
  testAssert(!loginCeremonyStarted, '9.7 Login ceremony not started before user clicks Sign In');
  await loginWithPasskey('9811001100');
  testAssert(loginCeremonyStarted, '9.8 Clicking Sign In explicitly starts login ceremony');
  testAssert(mockLocalStorageStore[REGISTERED_HINT_KEY] === 'true', '9.9 Successful login persists REGISTERED_HINT_KEY');

  // 9.5 Returning user context defaults to 'login' (Sign in with Passkey)
  mockLocalStorage.removeItem('chandil_token');
  mockLocalStorage.removeItem('chandil_user');
  testAssert(getInitialAuthMode() === 'login', '9.10 Returning user with REGISTERED_HINT_KEY defaults to login mode');

  // 9.6 Logout does not automatically start authentication
  resetState();
  mockLocalStorageStore[REGISTERED_HINT_KEY] = 'true';
  mockLocalStorageStore['chandil_token'] = 'active.jwt';
  authToken.value = 'active.jwt';
  let autoAuthTriggeredOnLogout = false;
  setMockNavigator({
    get: async () => {
      autoAuthTriggeredOnLogout = true;
      return createMockAuthCredential();
    },
  });
  await logout();
  testAssert(authToken.value === null, '9.11 Logout clears authToken');
  testAssert(authMode.value === 'login', '9.12 Logout sets mode to login for returning user');
  testAssert(!autoAuthTriggeredOnLogout, '9.13 Logout does NOT automatically trigger Passkey authentication');
  testAssert(authLoading.value === false, '9.14 authLoading remains false after logout');

  // 9.7 Create Passkey registration flow transitions to authenticated CustomerHome
  resetState();
  mockLocalStorage.clear();
  authMode.value = 'register';
  let regCeremonyStarted = false;
  setMockNavigator({
    create: async () => {
      regCeremonyStarted = true;
      return createMockRegCredential();
    },
  });
  globalThis.fetch = async (url: any) => {
    if (url.toString().endsWith('/api/auth/passkey/register-options')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            challenge: 'reg-chal-456',
            rp: { name: 'Chandil Home Services', id: 'localhost' },
            user: { id: 'dXNlci0y', name: '9811002200', displayName: 'New User' },
            pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          },
        }),
      } as any;
    }
    if (url.toString().endsWith('/api/auth/passkey/register-verify')) {
      return { ok: true, json: async () => ({ success: true, data: { token: 'reg.jwt', user: { id: 'u2', phone: '9811002200', role: 'customer' } } }) } as any;
    }
    return { ok: true, json: async () => ({ success: true }) } as any;
  };
  testAssert(!regCeremonyStarted, '9.15 Registration ceremony not started before user clicks Create Passkey');
  await registerPasskey('9811002200', 'New User');
  testAssert(regCeremonyStarted, '9.16 Clicking Create Passkey explicitly starts registration');
  testAssert(isAuthenticated.value === true, '9.17 Registration transitions to authenticated (routes to CustomerHome)');
  testAssert(mockLocalStorageStore[REGISTERED_HINT_KEY] === 'true', '9.18 Registration sets REGISTERED_HINT_KEY in client context');

  // 9.8 Language behavior remains intact throughout ceremonies
  testAssert(currentLanguage.value === 'hi', '9.19 Selected language preserved across ceremonies');
  selectLanguage('en');
  testAssert(currentLanguage.value === 'en', '9.20 Language switches to en cleanly');

  // Summary
  console.log('\n============================================================');
  console.log(`FRONTEND PASSKEY TESTS COMPLETE: ${passCount} passed, ${failCount} failed`);
  console.log('============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runPasskeyFrontendTests().catch((err) => {
  console.error('Fatal test error in passkey-frontend.test.ts:', err);
  process.exit(1);
});
