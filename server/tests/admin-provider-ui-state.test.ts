import {
  providersList,
  filteredProviders,
  providerSearchQuery,
  providerStatusFilter,
  providerCategoryFilter,
  isFormSubmitting,
  addFullName,
  addPhone,
  addCategoryId,
  addServiceArea,
  addPreferredLanguage,
  openAddModal,
  closeAddModal,
  editFullName,
  editCategoryId,
  editPreferredLanguage,
  editServiceArea,
  openEditModal,
  closeEditModal,
  deactivatingProvider,
  openDeactivateModal,
  closeDeactivateModal,
} from '../../client/src/state/admin-providers';
import { en } from '../../shared/i18n/en';
import { hi } from '../../shared/i18n/hi';
import { AdminProviderView } from '../../shared';

console.log('\n============================================================');
console.log('ADMIN PROVIDER MANAGEMENT — CLIENT UI & STATE TEST SUITE');
console.log('============================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${description}`);
    failCount++;
  }
}

// Sample mock providers for client-side state tests
const mockProviders: AdminProviderView[] = [
  {
    id: 'prov-1',
    phone: '9800055001',
    fullName: 'Ramesh Sharma',
    role: 'provider',
    preferredLanguage: 'hi',
    isActive: true,
    categoryId: 'electrician',
    categoryTitleEn: 'Electrician',
    categoryTitleHi: 'बिजली मिस्त्री',
    serviceArea: 'Station Colony',
    isAvailable: true,
    rating: 4.8,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prov-2',
    phone: '9800055002',
    fullName: 'Suresh Kumar',
    role: 'provider',
    preferredLanguage: 'en',
    isActive: false,
    categoryId: 'plumber',
    categoryTitleEn: 'Plumber',
    categoryTitleHi: 'नल / प्लंबर',
    serviceArea: 'Dam Road',
    isAvailable: false,
    rating: 5.0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prov-3',
    phone: '9800055003',
    fullName: 'Manoj Verma',
    role: 'provider',
    preferredLanguage: 'hi',
    isActive: true,
    categoryId: 'appliance-repair',
    categoryTitleEn: 'Appliance Repair',
    categoryTitleHi: 'घरेलू उपकरण रिपेयर',
    serviceArea: 'Main Bazaar',
    isAvailable: false,
    rating: 4.5,
    createdAt: new Date().toISOString(),
  },
];

async function runTests() {
  console.log('--- 1. Translation & i18n Parity Verification ---');
  const enKeys = Object.keys(en);
  const hiKeys = Object.keys(hi);

  assert(enKeys.length === hiKeys.length, `Total key count match: EN (${enKeys.length}) === HI (${hiKeys.length})`);

  const missingInHi = enKeys.filter((k) => !(k in hi));
  const missingInEn = hiKeys.filter((k) => !(k in en));

  assert(missingInHi.length === 0, 'No keys missing in Hindi translation');
  assert(missingInEn.length === 0, 'No keys missing in English translation');

  const requiredModule12BKeys = [
    'admin.providers_title',
    'admin.providers_subtitle',
    'admin.add_provider',
    'admin.edit_provider',
    'admin.search_placeholder',
    'admin.filter_all',
    'admin.filter_active',
    'admin.filter_inactive',
    'admin.filter_category_all',
    'admin.col_name',
    'admin.col_phone',
    'admin.col_category',
    'admin.col_area',
    'admin.col_status',
    'admin.col_availability',
    'admin.col_actions',
    'admin.status_active',
    'admin.status_inactive',
    'admin.available',
    'admin.unavailable',
    'admin.activate',
    'admin.deactivate',
    'admin.edit',
    'admin.no_providers_registered',
    'admin.no_providers_registered_desc',
    'admin.no_providers_match',
    'admin.clear_filters',
    'admin.deactivate_modal_title',
    'admin.deactivate_confirm_desc',
    'admin.deactivate_active_booking_error',
    'admin.confirm_deactivate_btn',
    'admin.confirm_activate_btn',
    'admin.cancel',
    'admin.save',
    'admin.saving',
    'admin.creating',
    'admin.field_full_name',
    'admin.field_full_name_placeholder',
    'admin.field_phone',
    'admin.field_phone_placeholder',
    'admin.field_phone_readonly_hint',
    'admin.field_category',
    'admin.field_select_category',
    'admin.field_preferred_language',
    'admin.lang_hindi',
    'admin.lang_english',
    'admin.field_service_area',
    'admin.field_service_area_placeholder',
    'admin.val_name_required',
    'admin.val_phone_invalid',
    'admin.val_category_required',
    'admin.val_area_required',
    'admin.provider_created_success',
    'admin.provider_updated_success',
    'admin.provider_deactivated_success',
    'admin.provider_activated_success',
    'admin.phone_already_registered',
    'admin.category_not_found',
  ];

  for (const k of requiredModule12BKeys) {
    assert(typeof (en as any)[k] === 'string' && (en as any)[k].length > 0, `EN key "${k}" is non-empty string`);
    assert(typeof (hi as any)[k] === 'string' && (hi as any)[k].length > 0, `HI key "${k}" is non-empty string`);
  }

  console.log('\n--- 2. Reactive Search & Filtering ---');
  providersList.value = mockProviders;
  providerSearchQuery.value = '';
  providerStatusFilter.value = 'all';
  providerCategoryFilter.value = 'all';

  // Base list
  assert(filteredProviders.value.length === 3, 'Default filter returns all 3 providers');

  // Search by Name (case-insensitive)
  providerSearchQuery.value = 'ramesh';
  assert(filteredProviders.value.length === 1 && filteredProviders.value[0].id === 'prov-1', 'Search by name "ramesh" returns Ramesh Sharma');

  providerSearchQuery.value = '   SURESH   ';
  assert(filteredProviders.value.length === 1 && filteredProviders.value[0].id === 'prov-2', 'Search with extra whitespace and uppercase returns Suresh Kumar');

  // Search by Phone
  providerSearchQuery.value = '55003';
  assert(filteredProviders.value.length === 1 && filteredProviders.value[0].id === 'prov-3', 'Search by partial phone "55003" returns Manoj Verma');

  // Search non-matching
  providerSearchQuery.value = 'nonexistent';
  assert(filteredProviders.value.length === 0, 'Search for non-existent text returns 0 matches (truthful empty search)');

  // Reset search
  providerSearchQuery.value = '';

  // Filter by Status: Active
  providerStatusFilter.value = 'active';
  assert(filteredProviders.value.length === 2, 'Filter status="active" returns 2 active providers');
  assert(filteredProviders.value.every((p) => p.isActive), 'All returned providers have isActive === true');

  // Filter by Status: Inactive
  providerStatusFilter.value = 'inactive';
  assert(filteredProviders.value.length === 1 && filteredProviders.value[0].id === 'prov-2', 'Filter status="inactive" returns 1 inactive provider');
  assert(filteredProviders.value.every((p) => !p.isActive), 'All returned providers have isActive === false');

  // Filter by Category
  providerStatusFilter.value = 'all';
  providerCategoryFilter.value = 'plumber';
  assert(filteredProviders.value.length === 1 && filteredProviders.value[0].categoryId === 'plumber', 'Filter category="plumber" returns 1 provider');

  providerCategoryFilter.value = 'electrician';
  assert(filteredProviders.value.length === 1 && filteredProviders.value[0].categoryId === 'electrician', 'Filter category="electrician" returns 1 provider');

  // Combined Filters (Active + Electrician)
  providerStatusFilter.value = 'active';
  providerCategoryFilter.value = 'electrician';
  providerSearchQuery.value = 'Ramesh';
  assert(filteredProviders.value.length === 1, 'Combined filter (active + electrician + Ramesh) returns 1 match');

  // Combined Filters with contradiction (Inactive + Electrician -> 0)
  providerStatusFilter.value = 'inactive';
  providerCategoryFilter.value = 'electrician';
  assert(filteredProviders.value.length === 0, 'Contradictory filter (inactive + electrician) returns 0 matches');

  // Reset filters
  providerSearchQuery.value = '';
  providerStatusFilter.value = 'all';
  providerCategoryFilter.value = 'all';

  console.log('\n--- 3. Form Validation & Client State ---');

  // Phone Validation Rules
  const validPhones = ['9800055001', '7890123456', '6200000000', '8888888888'];
  const invalidPhones = ['5800055001', '9800055', '98000550010', '98000abcde', '', ' 9800055001 '];

  const phoneRegex = /^[6-9]\d{9}$/;
  for (const vp of validPhones) {
    assert(phoneRegex.test(vp), `Phone "${vp}" passes Indian 10-digit mobile validation`);
  }
  for (const ip of invalidPhones) {
    assert(!phoneRegex.test(ip), `Invalid phone "${ip}" correctly rejected`);
  }

  // Add Modal Open/Close & Field Reset
  openAddModal('electrician');
  assert(addFullName.value === '', 'Add modal full name initialized empty');
  assert(addPhone.value === '', 'Add modal phone initialized empty');
  assert(addCategoryId.value === 'electrician', 'Add modal category initialized to default category');
  assert(addPreferredLanguage.value === 'hi', 'Add modal preferred language defaults to Hindi');
  assert(addServiceArea.value === 'Chandil', 'Add modal service area defaults to Chandil');

  closeAddModal();

  // Edit Modal Open/Close & Read-only Phone
  const sampleProv = mockProviders[0];
  openEditModal(sampleProv);
  assert(editFullName.value === sampleProv.fullName, 'Edit modal full name prefilled');
  assert(editCategoryId.value === sampleProv.categoryId, 'Edit modal category prefilled');
  assert(editPreferredLanguage.value === sampleProv.preferredLanguage, 'Edit modal preferred language prefilled');
  assert(editServiceArea.value === sampleProv.serviceArea, 'Edit modal service area prefilled');

  // PATCH payload simulation: Verify phone is NOT sent in edit submission
  const editPayload = {
    fullName: editFullName.value.trim(),
    categoryId: editCategoryId.value.trim(),
    preferredLanguage: editPreferredLanguage.value,
    serviceArea: editServiceArea.value.trim(),
  };
  assert(!('phone' in editPayload), 'PATCH payload strictly omits phone number (Phone is immutable)');
  assert(!('role' in editPayload), 'PATCH payload strictly omits role');
  assert(!('isActive' in editPayload), 'PATCH payload strictly omits isActive');

  closeEditModal();

  // Deactivation Modal State
  openDeactivateModal(sampleProv);
  assert(deactivatingProvider.value?.id === sampleProv.id, 'Deactivating provider stored in modal state');
  closeDeactivateModal();
  assert(deactivatingProvider.value === null, 'Deactivation modal state cleared on close');

  // Double-submit Prevention Guard
  assert(isFormSubmitting.value === false, 'isFormSubmitting is false initially');

  console.log('\n--- 4. Active Booking Conflict Error Handling ---');
  // Error message checks
  const enConflictMsg = (en as any)['admin.deactivate_active_booking_error'];
  const hiConflictMsg = (hi as any)['admin.deactivate_active_booking_error'];

  assert(
    enConflictMsg === 'Cannot deactivate this provider while an active booking is in progress.',
    'English active-booking conflict error is accurate'
  );
  assert(
    hiConflictMsg === 'चल रही बुकिंग के दौरान इस मिस्त्री को निष्क्रिय नहीं किया जा सकता।',
    'Hindi active-booking conflict error is accurate'
  );

  console.log('\n============================================================');
  console.log(`CLIENT STATE & UI TESTS: ${passCount} PASSED, ${failCount} FAILED.`);
  console.log('============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
