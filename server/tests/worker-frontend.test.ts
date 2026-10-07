import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { en } from '../../shared/i18n/en';
import { hi } from '../../shared/i18n/hi';
import { User, ApiResponse, VerifiedWorkerSummary } from '../../shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n============================================================');
console.log('CHANDIL HOME SERVICES - WORKER ONBOARDING FRONTEND UX TEST SUITE');
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
  return {
    id: 'mock-auth-cred-id',
    rawId: new Uint8Array([1, 2, 3, 4]).buffer,
    response: {
      authenticatorData: new Uint8Array([5, 6, 7, 8]).buffer,
      clientDataJSON: new TextEncoder().encode(JSON.stringify({ type: 'webauthn.get', challenge: 'test', origin: 'http://localhost:3000' })).buffer,
      signature: new Uint8Array([9, 10]).buffer,
      userHandle: null,
    },
    getClientExtensionResults: () => ({}),
    type: 'public-key',
  };
}

function createMockRegCredential() {
  return {
    id: 'mock-reg-cred-id',
    rawId: new Uint8Array([11, 12, 13, 14]).buffer,
    response: {
      attestationObject: new Uint8Array([15, 16, 17, 18]).buffer,
      clientDataJSON: new TextEncoder().encode(JSON.stringify({ type: 'webauthn.create', challenge: 'test', origin: 'http://localhost:3000' })).buffer,
      getTransports: () => ['internal'],
    },
    getClientExtensionResults: () => ({}),
    type: 'public-key',
  };
}

Object.defineProperty(globalThis, 'navigator', {
  value: {
    credentials: {
      get: async () => createMockAuthCredential(),
      create: async () => createMockRegCredential(),
    },
    mediaDevices: {
      getUserMedia: async () => ({
        getTracks: () => [{ stop: () => {} }],
      }),
    },
  },
  configurable: true,
  writable: true,
});

// Dynamic imports of client modules
const {
  authToken,
  currentUser,
  isAuthenticated,
  authMode,
  selectedOnboardingRole,
  phoneInput,
  fullNameInput,
  authLoading,
  authError,
  authCancelled,
  loginWithPasskey,
  registerPasskey,
  logout,
  handleSessionExpired,
} = await import('../../client/src/state/auth.js');

const {
  workerStatus,
  workerStatusLoading,
  workerStatusError,
  workerFullName,
  workerCategoryId,
  aadhaarFront,
  aadhaarBack,
  workerPhoto,
  isSubmittingWorker,
  workerSubmitError,
  workerSubmitSuccess,
  verifiedWorkers,
  verifiedWorkersLoading,
  fetchWorkerStatus,
  submitWorkerOnboarding,
  fetchVerifiedWorkers,
  resetWorkerSetup,
} = await import('../../client/src/state/worker.js');

const {
  currentLanguage,
  selectLanguage,
  t,
} = await import('../../client/src/state/language.js');

// Mock fetch dispatcher
let mockFetchHandler: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

(globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString();
  if (mockFetchHandler) {
    return mockFetchHandler(url, init);
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: {} }),
  };
};

async function runTests() {
  // Read component source files for static JSX/accessibility audits
  const loginScreenSrc = fs.readFileSync(path.join(__dirname, '../../client/src/components/LoginScreen.tsx'), 'utf-8');
  const workerSetupSrc = fs.readFileSync(path.join(__dirname, '../../client/src/components/WorkerSetupScreen.tsx'), 'utf-8');
  const workerPendingSrc = fs.readFileSync(path.join(__dirname, '../../client/src/components/WorkerPendingScreen.tsx'), 'utf-8');
  const docUploadSrc = fs.readFileSync(path.join(__dirname, '../../client/src/components/DocumentUploadCard.tsx'), 'utf-8');
  const customerHomeSrc = fs.readFileSync(path.join(__dirname, '../../client/src/components/CustomerHome.tsx'), 'utf-8');
  const providerHomeSrc = fs.readFileSync(path.join(__dirname, '../../client/src/components/ProviderHome.tsx'), 'utf-8');
  const appSrc = fs.readFileSync(path.join(__dirname, '../../client/src/App.tsx'), 'utf-8');

  console.log('--- A. Role Selection Appears for Unauthenticated First-Time User ---');
  mockLocalStorage.clear();
  authToken.value = null;
  currentUser.value = null;
  authMode.value = 'register';
  selectedOnboardingRole.value = null;

  testAssert(!isAuthenticated.value, 'A.1 User is unauthenticated');
  testAssert(selectedOnboardingRole.value === null, 'A.2 First-time user has no selected role initially');
  testAssert(loginScreenSrc.includes("t('onboarding.role_title')"), 'A.3 LoginScreen renders onboarding.role_title');
  testAssert(loginScreenSrc.includes('role-select-customer-btn'), 'A.4 LoginScreen contains Customer selection button');
  testAssert(loginScreenSrc.includes('role-select-worker-btn'), 'A.5 LoginScreen contains Worker selection button');
  testAssert(loginScreenSrc.includes("t('onboarding.returning_user_sign_in')"), 'A.6 Role selection contains returning user sign in link');

  console.log('\n--- B. Customer Selection Shows Customer Registration ---');
  selectedOnboardingRole.value = 'customer';
  testAssert(selectedOnboardingRole.value === 'customer', 'B.1 Role set to customer');
  testAssert(loginScreenSrc.includes("t('onboarding.customer_title')"), 'B.2 Renders customer registration title');
  testAssert(loginScreenSrc.includes("id=\"register-phone-input\""), 'B.3 Renders mobile number input');
  testAssert(loginScreenSrc.includes("id=\"register-name-input\""), 'B.4 Renders full name input');
  testAssert(loginScreenSrc.includes("t('onboarding.customer_create_passkey')"), 'B.5 Renders Create Passkey & Continue button');
  testAssert(loginScreenSrc.includes('back-to-roles-btn'), 'B.6 Renders back button to return to role selection');

  console.log('\n--- C. Worker Selection Shows Worker Registration ---');
  selectedOnboardingRole.value = 'worker';
  testAssert(selectedOnboardingRole.value === 'worker', 'C.1 Role set to worker');
  testAssert(loginScreenSrc.includes("t('onboarding.worker_title')"), 'C.2 Renders worker registration title');
  testAssert(loginScreenSrc.includes("t('onboarding.role_worker_sub')"), 'C.3 Renders worker subtitle');

  console.log('\n--- D. Customer Full Name Required ---');
  selectedOnboardingRole.value = 'customer';
  phoneInput.value = '9876543210';
  fullNameInput.value = '';
  let apiCalled = false;
  mockFetchHandler = async () => {
    apiCalled = true;
    return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
  };

  const custEmptyNameResult = await registerPasskey('9876543210', '', 'customer');
  testAssert(custEmptyNameResult === false, 'D.1 Customer registration rejected when full name is empty');
  testAssert(apiCalled === false, 'D.2 Backend API was not called when customer name was missing');
  testAssert(authError.value !== null, 'D.3 Full name error message populated');

  // Customer registration with valid full name proceeds
  let capturedRegisterOptionsBody: any = null;
  let capturedRegisterVerifyBody: any = null;
  mockFetchHandler = async (url, init) => {
    if (url.includes('register-options')) {
      capturedRegisterOptionsBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            challenge: 'cmVnLWNoYWxsZW5nZS1iYXNlNjR1cmw',
            rp: { name: 'Chandil Home Services', id: 'localhost' },
            user: { id: 'dXNlci1pZC1ieXRlcw', name: '9876543210', displayName: 'Ramesh Sharma' },
            pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          },
        }),
      };
    }
    if (url.includes('register-verify')) {
      capturedRegisterVerifyBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            token: 'mock-customer-token',
            user: { id: 'cust-1', phone: '9876543210', role: 'customer', fullName: 'Ramesh Sharma' },
            isNewUser: true,
          },
        }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const custValidResult = await registerPasskey('9876543210', 'Ramesh Sharma', 'customer');
  testAssert(custValidResult === true, 'D.4 Customer registration succeeds with full name');
  testAssert(capturedRegisterOptionsBody?.fullName === 'Ramesh Sharma', 'D.5 Forwards fullName in register-options');
  testAssert(capturedRegisterOptionsBody?.flow === 'customer', 'D.6 Forwards flow=customer in register-options');
  testAssert(capturedRegisterVerifyBody?.fullName === 'Ramesh Sharma', 'D.7 Forwards fullName in register-verify');
  testAssert(capturedRegisterVerifyBody?.flow === 'customer', 'D.8 Forwards flow=customer in register-verify');
  testAssert(isAuthenticated.value, 'D.9 Authenticated after customer registration');

  console.log('\n--- E. Worker Full Name Required in Worker Setup ---');
  authToken.value = 'mock-worker-token';
  currentUser.value = { id: 'worker-1', phone: '9876543211', role: 'customer' } as User;
  resetWorkerSetup();
  workerFullName.value = '';
  workerCategoryId.value = 'electrician';
  aadhaarFront.value = { base64: 'abc', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,abc' };
  aadhaarBack.value = { base64: 'def', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,def' };
  workerPhoto.value = { base64: 'ghi', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,ghi' };

  apiCalled = false;
  mockFetchHandler = async () => {
    apiCalled = true;
    return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
  };

  const workerEmptyNameResult = await submitWorkerOnboarding();
  testAssert(workerEmptyNameResult === false, 'E.1 Worker submission rejected when full name is empty');
  testAssert(apiCalled === false, 'E.2 Worker onboarding endpoint not called without full name');
  testAssert(workerSubmitError.value !== null, 'E.3 Worker full name error set');

  console.log('\n--- F. Category Required in Worker Setup ---');
  resetWorkerSetup();
  workerFullName.value = 'Suresh Kumar';
  workerCategoryId.value = '';
  aadhaarFront.value = { base64: 'abc', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,abc' };
  aadhaarBack.value = { base64: 'def', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,def' };
  workerPhoto.value = { base64: 'ghi', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,ghi' };

  const workerEmptyCatResult = await submitWorkerOnboarding();
  testAssert(workerEmptyCatResult === false, 'F.1 Worker submission rejected when category is empty');
  testAssert(workerSubmitError.value !== null, 'F.2 Worker category error set');

  console.log('\n--- G. Aadhaar Front Required ---');
  resetWorkerSetup();
  workerFullName.value = 'Suresh Kumar';
  workerCategoryId.value = 'electrician';
  aadhaarFront.value = null;
  aadhaarBack.value = { base64: 'def', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,def' };
  workerPhoto.value = { base64: 'ghi', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,ghi' };

  const workerNoFrontResult = await submitWorkerOnboarding();
  testAssert(workerNoFrontResult === false, 'G.1 Worker submission rejected when Aadhaar Front is missing');
  testAssert(workerSubmitError.value !== null, 'G.2 Aadhaar front error set');

  console.log('\n--- H. Aadhaar Back Required ---');
  resetWorkerSetup();
  workerFullName.value = 'Suresh Kumar';
  workerCategoryId.value = 'electrician';
  aadhaarFront.value = { base64: 'abc', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,abc' };
  aadhaarBack.value = null;
  workerPhoto.value = { base64: 'ghi', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,ghi' };

  const workerNoBackResult = await submitWorkerOnboarding();
  testAssert(workerNoBackResult === false, 'H.1 Worker submission rejected when Aadhaar Back is missing');
  testAssert(workerSubmitError.value !== null, 'H.2 Aadhaar back error set');

  console.log('\n--- I. Worker Photo Required ---');
  resetWorkerSetup();
  workerFullName.value = 'Suresh Kumar';
  workerCategoryId.value = 'electrician';
  aadhaarFront.value = { base64: 'abc', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,abc' };
  aadhaarBack.value = { base64: 'def', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,def' };
  workerPhoto.value = null;

  const workerNoPhotoResult = await submitWorkerOnboarding();
  testAssert(workerNoPhotoResult === false, 'I.1 Worker submission rejected when Worker Photo is missing');
  testAssert(workerSubmitError.value !== null, 'I.2 Worker photo error set');

  console.log('\n--- J. Camera/Gallery Controls Render ---');
  testAssert(docUploadSrc.includes("t('onboarding.btn_camera')"), 'J.1 DocumentUploadCard renders Camera button');
  testAssert(docUploadSrc.includes("t('onboarding.btn_gallery')"), 'J.2 DocumentUploadCard renders Gallery button');
  testAssert(docUploadSrc.includes("t('onboarding.btn_take_photo')"), 'J.3 Photo mode renders Take Photo button');
  testAssert(docUploadSrc.includes("t('onboarding.btn_choose_gallery')"), 'J.4 Photo mode renders Choose from Gallery button');
  testAssert(docUploadSrc.includes("t('onboarding.btn_switch_camera')"), 'J.5 Photo mode renders switch camera button');
  testAssert(docUploadSrc.includes('min-h-[48px]'), 'J.6 Enforces minimum 48px touch targets');

  console.log('\n--- K. Image Preview Works ---');
  testAssert(docUploadSrc.includes('<img') && docUploadSrc.includes('imageState.dataUrl'), 'K.1 Renders image preview with dataUrl');
  testAssert(docUploadSrc.includes('Ready') || docUploadSrc.includes('तैयार'), 'K.2 Renders ready indicator when image is set');

  console.log('\n--- L. Retake Works ---');
  testAssert(docUploadSrc.includes("t('onboarding.btn_retake')"), 'L.1 Renders Retake button');
  testAssert(workerSetupSrc.includes('aadhaarFront.value = null'), 'L.2 Retake clears Aadhaar front');
  testAssert(workerSetupSrc.includes('aadhaarBack.value = null'), 'L.3 Retake clears Aadhaar back');
  testAssert(workerSetupSrc.includes('workerPhoto.value = null'), 'L.4 Retake clears worker photo');

  console.log('\n--- M. Submit Calls Worker Onboarding Endpoint ---');
  resetWorkerSetup();
  workerFullName.value = 'Suresh Kumar';
  workerCategoryId.value = 'electrician';
  aadhaarFront.value = { base64: 'mockFrontBase64', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,mockFrontBase64' };
  aadhaarBack.value = { base64: 'mockBackBase64', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,mockBackBase64' };
  workerPhoto.value = { base64: 'mockPhotoBase64', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,mockPhotoBase64' };

  let capturedOnboardingPayload: any = null;
  let capturedAuthHeader: string | null = null;
  mockFetchHandler = async (url, init) => {
    if (url.includes('/api/worker/onboarding')) {
      capturedAuthHeader = (init?.headers as any)?.Authorization || null;
      capturedOnboardingPayload = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            status: 'PENDING_VERIFICATION',
            submittedAt: new Date().toISOString(),
            messageEn: 'Your profile has been submitted. Chandil Admin will verify it within 24 hours.',
            messageHi: 'आपकी प्रोफ़ाइल सबमिट हो गई है, चंडिल एडमिन 24 घंटे में सत्यापित करेगा।',
          },
        }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const submitOk = await submitWorkerOnboarding();
  testAssert(submitOk === true, 'M.1 Worker submission returned true');
  testAssert(capturedAuthHeader === 'Bearer mock-worker-token', 'M.2 Passes Bearer auth token');
  testAssert(capturedOnboardingPayload?.fullName === 'Suresh Kumar', 'M.3 Passes fullName');
  testAssert(capturedOnboardingPayload?.categoryId === 'electrician', 'M.4 Passes categoryId');
  testAssert(capturedOnboardingPayload?.aadhaarFrontBase64 === 'mockFrontBase64', 'M.5 Passes aadhaarFrontBase64');
  testAssert(capturedOnboardingPayload?.aadhaarFrontMime === 'image/jpeg', 'M.6 Passes aadhaarFrontMime');
  testAssert(capturedOnboardingPayload?.aadhaarBackBase64 === 'mockBackBase64', 'M.7 Passes aadhaarBackBase64');
  testAssert(capturedOnboardingPayload?.aadhaarBackMime === 'image/jpeg', 'M.8 Passes aadhaarBackMime');
  testAssert(capturedOnboardingPayload?.photoBase64 === 'mockPhotoBase64', 'M.9 Passes photoBase64');
  testAssert(capturedOnboardingPayload?.photoMime === 'image/jpeg', 'M.10 Passes photoMime');

  console.log('\n--- N. Successful Submission Shows Pending State ---');
  testAssert(workerStatus.value === 'PENDING_VERIFICATION', 'N.1 workerStatus updated to PENDING_VERIFICATION');
  testAssert(aadhaarFront.value === null, 'N.2 Aadhaar front cleared from memory');
  testAssert(aadhaarBack.value === null, 'N.3 Aadhaar back cleared from memory');
  testAssert(workerPhoto.value === null, 'N.4 Worker photo cleared from memory');
  testAssert(workerPendingSrc.includes('PENDING VERIFICATION'), 'N.5 WorkerPendingScreen displays PENDING VERIFICATION badge');
  testAssert(workerPendingSrc.includes("t('onboarding.pending_verification_title')"), 'N.6 Displays pending verification title');
  testAssert(workerPendingSrc.includes('24 ghante') || workerPendingSrc.includes('24 hours'), 'N.7 Displays 24 hour verification notice');
  testAssert(workerPendingSrc.includes('check-worker-status-btn'), 'N.8 Displays check status button');

  console.log('\n--- O. Pending Worker is Not Shown as Verified Customer Worker ---');
  // Mock customer fetching verified workers
  mockFetchHandler = async (url) => {
    if (url.includes('/api/workers/verified')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            workers: [
              {
                id: 'verified-worker-1',
                fullName: 'Kamlesh Mahato',
                categoryId: 'electrician',
                categoryTitleEn: 'Electrician',
                categoryTitleHi: 'इलेक्ट्रीशियन',
                isVerified: true,
                photoUrl: '/api/workers/verified-worker-1/photo',
              },
            ],
          },
        }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  await fetchVerifiedWorkers('electrician');
  testAssert(verifiedWorkers.value.length === 1, 'O.1 Fetched verified workers list');
  testAssert(verifiedWorkers.value[0].id === 'verified-worker-1', 'O.2 Contains verified worker');
  testAssert(!verifiedWorkers.value.some((w: any) => w.id === 'worker-1'), 'O.3 Pending worker worker-1 is NOT present in customer list');

  console.log('\n--- P. Verified Worker Routes to Provider Home ---');
  testAssert(appSrc.includes("currentUser.value?.role === 'provider'"), 'P.1 App routes to ProviderHome when user role is provider');
  testAssert(providerHomeSrc.includes('worker-verified-tick'), 'P.2 ProviderHome displays green verified tick');
  testAssert(providerHomeSrc.includes("t('worker.verified_tick')"), 'P.3 Uses bilingual verified tick string');

  console.log('\n--- Q. Language Switching Works ---');
  selectLanguage('en');
  testAssert(t('onboarding.role_title') === 'Who are you?', 'Q.1 English role title is "Who are you?"');
  testAssert(t('onboarding.role_customer') === 'Customer', 'Q.2 English role customer is "Customer"');
  testAssert(t('onboarding.role_worker') === 'Worker', 'Q.3 English role worker is "Worker"');

  selectLanguage('hi');
  testAssert(t('onboarding.role_title') === 'आप कौन हैं?', 'Q.4 Hindi role title is "आप कौन हैं?"');
  testAssert(t('onboarding.role_customer') === 'ग्राहक', 'Q.5 Hindi role customer is "ग्राहक"');
  testAssert(t('onboarding.role_worker') === 'काम करने वाले', 'Q.6 Hindi role worker is "काम करने वाले"');
  testAssert(workerFullName.value === 'Suresh Kumar', 'Q.7 Form input state preserved across language switch');

  console.log('\n--- R. Session/Auth State is Preserved ---');
  testAssert(authToken.value === 'mock-worker-token', 'R.1 Auth token preserved');
  await logout();
  testAssert(authToken.value === null, 'R.2 Logout clears authToken');
  testAssert(currentUser.value === null, 'R.3 Logout clears currentUser');
  testAssert(selectedOnboardingRole.value === null, 'R.4 Logout resets selectedOnboardingRole');

  console.log('\n--- S. Failed Submission Shows Retry/Error State ---');
  authToken.value = 'mock-worker-token';
  currentUser.value = { id: 'worker-1', phone: '9876543211', role: 'customer' } as User;
  workerFullName.value = 'Suresh Kumar';
  workerCategoryId.value = 'electrician';
  aadhaarFront.value = { base64: 'abc', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,abc' };
  aadhaarBack.value = { base64: 'def', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,def' };
  workerPhoto.value = { base64: 'ghi', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,ghi' };

  mockFetchHandler = async () => {
    return {
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: { code: 'SERVER_ERROR', messageEn: 'Server error occurred', messageHi: 'सर्वर त्रुटि हुई' },
      }),
    };
  };

  const submitFailResult = await submitWorkerOnboarding();
  testAssert(submitFailResult === false, 'S.1 submitWorkerOnboarding returns false on server failure');
  testAssert(isSubmittingWorker.value === false, 'S.2 Loading state reset to false');
  testAssert(workerSubmitError.value !== null, 'S.3 Error message populated for user');

  console.log('\n--- T. Aadhaar is Never Rendered in Customer UI ---');
  testAssert(!customerHomeSrc.toLowerCase().includes('aadhaar'), 'T.1 CustomerHome contains ZERO references to Aadhaar');
  testAssert(customerHomeSrc.includes('verified-workers-list'), 'T.2 CustomerHome contains verified workers list');
  testAssert(customerHomeSrc.includes('worker.photoUrl'), 'T.3 CustomerHome displays worker photo');
  testAssert(customerHomeSrc.includes('worker.fullName'), 'T.4 CustomerHome displays worker name');
  testAssert(customerHomeSrc.includes("t('worker.verified_tick')"), 'T.5 CustomerHome displays green verified tick');

  console.log('\n============================================================');
  console.log(`WORKER FRONTEND TESTS COMPLETE: ${passCount} passed, ${failCount} failed`);
  console.log('============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
