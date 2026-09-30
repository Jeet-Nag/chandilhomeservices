import { canTransition, VALID_STATUS_TRANSITIONS, BookingStatus } from '../../shared/constants/booking-states';
import { en } from '../../shared/i18n/en';
import { hi } from '../../shared/i18n/hi';
import { I18nService } from '../../shared/i18n';
import { buildApp } from '../src/app';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('CHANDIL HOME SERVICES - FOUNDATION VERIFICATION TEST SUITE');
  console.log('============================================================\n');

  // 1. STATE MACHINE INTEGRITY TESTS
  console.log('1. Testing Booking State Machine Transitions...');
  
  // Valid lifecycle path
  assert(canTransition('SERVICE_REQUESTED', 'PROVIDER_ACCEPTED', 'provider'), 'Provider can accept SERVICE_REQUESTED');
  assert(canTransition('PROVIDER_ACCEPTED', 'PROVIDER_ON_THE_WAY', 'provider'), 'Provider can transition to PROVIDER_ON_THE_WAY');
  assert(canTransition('PROVIDER_ON_THE_WAY', 'SERVICE_STARTED', 'provider'), 'Provider can transition to SERVICE_STARTED');
  assert(canTransition('SERVICE_STARTED', 'SERVICE_COMPLETED', 'provider'), 'Provider can transition to SERVICE_COMPLETED');
  assert(canTransition('SERVICE_COMPLETED', 'PAYMENT_PENDING', 'provider'), 'Provider can transition to PAYMENT_PENDING');
  assert(canTransition('PAYMENT_PENDING', 'PAYMENT_COLLECTED', 'provider'), 'Provider can transition to PAYMENT_COLLECTED');
  assert(canTransition('PAYMENT_COLLECTED', 'BOOKING_COMPLETED', 'provider'), 'Provider can transition to BOOKING_COMPLETED');

  // Invalid transition tests
  assert(!canTransition('SERVICE_REQUESTED', 'BOOKING_COMPLETED'), 'SERVICE_REQUESTED directly to BOOKING_COMPLETED is rejected');
  assert(!canTransition('SERVICE_REQUESTED', 'SERVICE_STARTED'), 'SERVICE_REQUESTED directly to SERVICE_STARTED is rejected');
  assert(!canTransition('BOOKING_COMPLETED', 'SERVICE_REQUESTED'), 'Terminal state BOOKING_COMPLETED cannot transition');

  // Role authorization checks
  assert(canTransition('SERVICE_REQUESTED', 'CANCELLED_BY_CUSTOMER', 'customer'), 'Customer can cancel before assignment');
  assert(!canTransition('PROVIDER_ON_THE_WAY', 'CANCELLED_BY_CUSTOMER', 'customer'), 'Customer cannot cancel once provider is on the way');
  assert(!canTransition('SERVICE_STARTED', 'PAYMENT_COLLECTED', 'customer'), 'Customer cannot mark payment collected');

  // 2. I18N DICTIONARY PARITY TESTS
  console.log('\n2. Testing i18n Dictionary Parity & Parameter Substitution...');
  const enKeys = Object.keys(en);
  const hiKeys = Object.keys(hi);

  assert(enKeys.length === hiKeys.length, `Key counts match (EN: ${enKeys.length}, HI: ${hiKeys.length})`);

  let missingInHi = 0;
  for (const key of enKeys) {
    if (!(key in hi)) {
      missingInHi++;
      console.error(`     Missing in Hindi: ${key}`);
    }
  }
  assert(missingInHi === 0, 'Zero missing keys in Hindi dictionary');

  let missingInEn = 0;
  for (const key of hiKeys) {
    if (!(key in en)) {
      missingInEn++;
      console.error(`     Missing in English: ${key}`);
    }
  }
  assert(missingInEn === 0, 'Zero missing keys in English dictionary');

  // Test I18nService initial state and parameter interpolation
  const testI18n = new I18nService(null);
  assert(!testI18n.isLanguageSelected(), 'New I18nService correctly starts with isLanguageSelected = false (Null state)');
  assert(testI18n.getLanguage() === null, 'getLanguage() returns null before explicit user choice');

  testI18n.setLanguage('hi');
  assert(testI18n.isLanguageSelected(), 'Language marked selected after setLanguage');
  assert(testI18n.getLanguage() === 'hi', 'getLanguage() returns hi after selection');

  const formattedHi = testI18n.t('auth.mock_hint', { otp: '1234' });
  assert(formattedHi.includes('1234'), `Parameter substitution in Hindi formatted correctly: "${formattedHi}"`);

  testI18n.setLanguage('en');
  const formattedEn = testI18n.t('auth.mock_hint', { otp: '1234' });
  assert(formattedEn.includes('1234'), `Parameter substitution in English formatted correctly: "${formattedEn}"`);

  // 3. FASTIFY SERVER INTEGRATION TESTS
  console.log('\n3. Testing Fastify Server Foundation & Health Endpoint...');
  const app = await buildApp();

  // Test /health
  const healthRes = await app.inject({
    method: 'GET',
    url: '/health',
  });
  assert(healthRes.statusCode === 200, `/health returns status 200 (Got: ${healthRes.statusCode})`);
  const healthData = JSON.parse(healthRes.payload);
  assert(healthData.status === 'ok', `Health status is 'ok' (Got: ${healthData.status})`);
  assert(healthData.service === 'chandil-home-services-api', 'Correct service name returned');

  // Test /api/ping
  const pingRes = await app.inject({
    method: 'GET',
    url: '/api/ping',
  });
  assert(pingRes.statusCode === 200, `/api/ping returns status 200 (Got: ${pingRes.statusCode})`);
  const pingData = JSON.parse(pingRes.payload);
  assert(pingData.success === true, 'Ping response adheres to standard ApiResponse envelope');

  await app.close();

  // 4. SUMMARY
  console.log('\n============================================================');
  console.log(`FOUNDATION TESTS COMPLETED: ${passedTests} passed, ${failedTests} failed.`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running foundation test suite:', err);
  process.exit(1);
});
