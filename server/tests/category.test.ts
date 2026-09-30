import { buildApp } from '../src/app';
import { db } from '../src/db';
import { ApiResponse, ServiceCategory } from '@shared';

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

async function runCategoryTests() {
  console.log('\n============================================================');
  console.log('CHANDIL HOME SERVICES - MODULE 4 CATEGORIES & HOME VERIFICATION');
  console.log('============================================================\n');

  const app = await buildApp();
  const pool = db.getPool();
  if (!pool) {
    console.error('Fatal: DB pool unavailable.');
    process.exit(1);
  }

  const customerPhone = '9876543291';
  const providerPhone = '9876543292';
  const testOtp = process.env.DEV_MOCK_OTP || '1234';

  // Clean up fixtures
  await pool.query('DELETE FROM otp_requests WHERE phone IN ($1, $2)', [customerPhone, providerPhone]);
  await pool.query('DELETE FROM users WHERE phone IN ($1, $2)', [customerPhone, providerPhone]);

  // Pre-seed provider
  await pool.query(
    `INSERT INTO users (phone, role, preferred_language, full_name)
     VALUES ($1, 'provider', 'hi', 'Provider Test')`,
    [providerPhone]
  );

  // Obtain customer token
  await app.inject({
    method: 'POST',
    url: '/api/auth/request-otp',
    payload: { phone: customerPhone },
  });
  const custVerifyRes = await app.inject({
    method: 'POST',
    url: '/api/auth/verify-otp',
    payload: { phone: customerPhone, otp: testOtp },
  });
  const custBody = JSON.parse(custVerifyRes.payload);
  const customerToken = custBody.data?.token;

  // Obtain provider token
  await app.inject({
    method: 'POST',
    url: '/api/auth/request-otp',
    payload: { phone: providerPhone },
  });
  const provVerifyRes = await app.inject({
    method: 'POST',
    url: '/api/auth/verify-otp',
    payload: { phone: providerPhone, otp: testOtp },
  });
  const provBody = JSON.parse(provVerifyRes.payload);
  const providerToken = provBody.data?.token;

  console.log('--- 1. Authentication & Authorization Guards ---');

  // 1.1 Unauthenticated request returns 401
  const unauthRes = await app.inject({
    method: 'GET',
    url: '/api/categories',
  });
  assert(unauthRes.statusCode === 401, 'Unauthenticated GET /api/categories returns 401 Unauthorized');
  const unauthBody: ApiResponse = JSON.parse(unauthRes.payload);
  assert(unauthBody.success === false, 'Unauthenticated response has success: false');
  assert(unauthBody.error?.code === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED');
  assert(Boolean(unauthBody.error?.messageEn && unauthBody.error?.messageHi), 'Bilingual error messages returned');

  // 1.2 Invalid Bearer token returns 401
  const invalidTokenRes = await app.inject({
    method: 'GET',
    url: '/api/categories',
    headers: { authorization: 'Bearer invalid.token.payload' },
  });
  assert(invalidTokenRes.statusCode === 401, 'Invalid Bearer token returns 401 Unauthorized');

  // 1.3 Provider role cannot access customer category endpoint (RBAC check)
  const provAccessRes = await app.inject({
    method: 'GET',
    url: '/api/categories',
    headers: { authorization: `Bearer ${providerToken}` },
  });
  assert(provAccessRes.statusCode === 403, 'Provider role is rejected with 403 Forbidden');
  const provAccessBody: ApiResponse = JSON.parse(provAccessRes.payload);
  assert(provAccessBody.error?.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

  console.log('\n--- 2. Authenticated Customer Category Retrieval ---');

  // 2.1 Customer role returns 200 OK
  const custAccessRes = await app.inject({
    method: 'GET',
    url: '/api/categories',
    headers: { authorization: `Bearer ${customerToken}` },
  });
  assert(custAccessRes.statusCode === 200, 'Customer role returns 200 OK');
  const catBody: ApiResponse<ServiceCategory[]> = JSON.parse(custAccessRes.payload);
  assert(catBody.success === true, 'Response indicates success: true');
  assert(Array.isArray(catBody.data), 'Data is an array');

  const categories = catBody.data!;
  assert(categories.length === 5, `Returns exactly 5 approved categories (received ${categories.length})`);

  console.log('\n--- 3. Category Ordering & Schema Integrity ---');

  const expectedIds = ['electrician', 'plumber', 'appliance-repair', 'ac-cooler', 'bike-mechanic'];
  const actualIds = categories.map((c) => c.id);
  assert(
    JSON.stringify(actualIds) === JSON.stringify(expectedIds),
    `Categories are strictly ordered by sort_order: ${actualIds.join(' -> ')}`
  );

  let allFieldsValid = true;
  let allFeesValid = true;
  let allActive = true;

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    if (
      !cat.id ||
      !cat.titleEn ||
      !cat.titleHi ||
      !cat.descEn ||
      !cat.descHi ||
      !cat.iconName ||
      cat.sortOrder !== i + 1
    ) {
      allFieldsValid = false;
    }
    if (typeof cat.baseVisitFee !== 'number' || cat.baseVisitFee <= 0) {
      allFeesValid = false;
    }
    if (cat.isActive !== true) {
      allActive = false;
    }
  }

  assert(allFieldsValid, 'All categories contain non-empty ID, dual titles, dual descriptions, and icons');
  assert(allFeesValid, 'All categories have valid numerical baseVisitFee (e.g. ₹99, ₹149)');
  assert(allActive, 'All seeded categories are currently active');

  console.log('\n--- 4. Multilingual Purity & Zero String Mixing ---');

  // Verify that Hindi strings contain Devanagari characters and NO mixed English parenthetical translations
  const parentheticalRegex = /\([A-Za-z\s/]+\)/;
  let hindiPurityValid = true;
  let englishPurityValid = true;

  for (const cat of categories) {
    if (parentheticalRegex.test(cat.titleHi) || parentheticalRegex.test(cat.descHi || '')) {
      console.error(`  Mixed translation detected in Hindi: ${cat.titleHi}`);
      hindiPurityValid = false;
    }
    // Check for Devanagari Unicode range \u0900-\u097F
    const hasDevanagari = /[\u0900-\u097F]/.test(cat.titleHi);
    if (!hasDevanagari) {
      console.error(`  No Devanagari detected in Hindi title: ${cat.titleHi}`);
      hindiPurityValid = false;
    }

    // Check English does not contain Devanagari
    if (/[\u0900-\u097F]/.test(cat.titleEn) || /[\u0900-\u097F]/.test(cat.descEn || '')) {
      englishPurityValid = false;
    }
  }

  assert(hindiPurityValid, 'Hindi fields are pure Hindi without mixed English parenthetical translations');
  assert(englishPurityValid, 'English fields are clean English without leaked Devanagari characters');

  console.log('\n--- 5. Query Filters & State Edge Cases ---');

  // 5.1 active_only filter
  const activeOnlyRes = await app.inject({
    method: 'GET',
    url: '/api/categories?active_only=true',
    headers: { authorization: `Bearer ${customerToken}` },
  });
  assert(activeOnlyRes.statusCode === 200, 'GET /api/categories?active_only=true succeeds');
  const activeBody: ApiResponse<ServiceCategory[]> = JSON.parse(activeOnlyRes.payload);
  assert(activeBody.data?.length === 5, 'active_only returns all 5 active categories');

  // 5.2 Dynamic Inactive Category & Filtering
  await pool.query("UPDATE service_categories SET is_active = false WHERE id = 'bike-mechanic'");
  const inactiveCheckRes = await app.inject({
    method: 'GET',
    url: '/api/categories?active_only=true',
    headers: { authorization: `Bearer ${customerToken}` },
  });
  const inactiveCheckBody: ApiResponse<ServiceCategory[]> = JSON.parse(inactiveCheckRes.payload);
  assert(inactiveCheckBody.data?.length === 4, 'active_only=true strictly excludes inactive category');
  assert(!inactiveCheckBody.data?.some((c) => c.id === 'bike-mechanic'), 'Inactive category is absent from active_only list');

  const fullListRes = await app.inject({
    method: 'GET',
    url: '/api/categories',
    headers: { authorization: `Bearer ${customerToken}` },
  });
  const fullListBody: ApiResponse<ServiceCategory[]> = JSON.parse(fullListRes.payload);
  const bikeCat = fullListBody.data?.find((c) => c.id === 'bike-mechanic');
  assert(bikeCat?.isActive === false, 'Full category list accurately reflects isActive = false for inactive category');

  // Restore category active state
  await pool.query("UPDATE service_categories SET is_active = true WHERE id = 'bike-mechanic'");

  console.log('\n--- 6. Comprehensive i18n Dictionary Audit ---');
  const { en, hi } = await import('@shared');
  const enKeys = Object.keys(en);
  const hiKeys = Object.keys(hi);

  assert(enKeys.length === hiKeys.length, `English (${enKeys.length}) and Hindi (${hiKeys.length}) dictionaries have matching key counts`);

  let allKeysPresent = true;
  let allNonEmpty = true;
  let noMixedHindi = true;

  for (const key of enKeys) {
    if (!hi[key as keyof typeof hi]) {
      allKeysPresent = false;
      console.error(`  Missing Hindi translation for key: ${key}`);
    }
    if (!en[key as keyof typeof en] || en[key as keyof typeof en].trim() === '') {
      allNonEmpty = false;
    }
    if (!hi[key as keyof typeof hi] || hi[key as keyof typeof hi].trim() === '') {
      allNonEmpty = false;
    }

    // Check Hindi for parenthetical English leaks, excluding lang.choose_title which is the intentional bilingual prompt
    if (key !== 'lang.choose_title') {
      const hiVal = hi[key as keyof typeof hi];
      if (/\([A-Za-z\s/]+\)/.test(hiVal)) {
        noMixedHindi = false;
        console.error(`  Leaked parenthetical English in Hindi key "${key}": ${hiVal}`);
      }
    }
  }

  assert(allKeysPresent, 'All translation keys exist in both English and Hindi');
  assert(allNonEmpty, 'No translation strings are blank or empty');
  assert(noMixedHindi, 'Zero parenthetical English translations in Hindi dictionary');

  // Clean up fixtures
  await pool.query('DELETE FROM otp_requests WHERE phone IN ($1, $2)', [customerPhone, providerPhone]);
  await pool.query('DELETE FROM users WHERE phone IN ($1, $2)', [customerPhone, providerPhone]);

  console.log('\n============================================================');
  console.log(`CATEGORIES & CUSTOMER HOME TESTS: ${passed} PASSED, ${failed} FAILED.`);
  console.log('============================================================\n');

  await app.close();
  if (failed > 0) {
    process.exit(1);
  }
}

runCategoryTests().catch((err) => {
  console.error('Test runner encountered unexpected error:', err);
  process.exit(1);
});
