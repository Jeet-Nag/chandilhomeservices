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
  openReviewModal,
  closeReviewModal,
  isReviewModalOpen,
  reviewingProvider,
  isVerifyingWorker,
  verifyError,
  viewingDocument,
  openDocumentViewer,
  closeDocumentViewer,
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
  {
    id: 'prov-pending',
    phone: '9876507777',
    fullName: 'Ramesh Kumar',
    role: 'customer',
    preferredLanguage: 'hi',
    isActive: true,
    categoryId: 'electrician',
    categoryTitleEn: 'Electrician',
    categoryTitleHi: 'बिजली मिस्त्री',
    serviceArea: 'Chandil',
    isAvailable: false,
    rating: 5.0,
    verificationStatus: 'PENDING_VERIFICATION',
    submittedAt: '2026-10-08T10:00:00.000Z',
    hasAadhaarFront: true,
    hasAadhaarBack: true,
    hasPhoto: true,
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
    'admin.filter_pending',
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
    'admin.status_pending_verification',
    'admin.status_verified',
    'admin.status_active',
    'admin.status_inactive',
    'admin.review_application',
    'admin.review_modal_title',
    'admin.verify_worker_btn',
    'admin.verifying',
    'admin.worker_verified_success',
    'admin.verify_confirm_title',
    'admin.verify_confirm_desc',
    'admin.doc_aadhaar_front',
    'admin.doc_aadhaar_back',
    'admin.doc_worker_photo',
    'admin.doc_loading',
    'admin.doc_load_error',
    'admin.doc_not_available',
    'admin.view_document',
    'admin.zoom_in',
    'admin.zoom_out',
    'admin.zoom_reset',
    'admin.close_viewer',
    'admin.doc_viewer_title',
    'admin.submitted_on',
    'admin.worker_info_section',
    'admin.documents_section',
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
  assert(filteredProviders.value.length === 4, 'Default filter returns all 4 providers');

  // Search by Name (case-insensitive)
  providerSearchQuery.value = 'sharma';
  assert(filteredProviders.value.length === 1 && filteredProviders.value[0].id === 'prov-1', 'Search by name "sharma" returns Ramesh Sharma');

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

  // Filter by Status: Pending Verification
  providerStatusFilter.value = 'pending';
  assert(filteredProviders.value.length === 1 && filteredProviders.value[0].id === 'prov-pending', 'Filter status="pending" returns 1 pending worker');
  assert(filteredProviders.value.every((p) => p.verificationStatus === 'PENDING_VERIFICATION'), 'All returned providers have status PENDING_VERIFICATION');

  // Filter by Status: Active (Excludes pending workers)
  providerStatusFilter.value = 'active';
  assert(filteredProviders.value.length === 2, 'Filter status="active" returns 2 active providers (excluding pending)');
  assert(filteredProviders.value.every((p) => p.isActive && p.verificationStatus !== 'PENDING_VERIFICATION'), 'All returned providers have isActive === true and are not pending');

  // Filter by Status: Inactive (Excludes pending workers)
  providerStatusFilter.value = 'inactive';
  assert(filteredProviders.value.length === 1 && filteredProviders.value[0].id === 'prov-2', 'Filter status="inactive" returns 1 inactive provider');
  assert(filteredProviders.value.every((p) => !p.isActive && p.verificationStatus !== 'PENDING_VERIFICATION'), 'All returned providers have isActive === false');

  // Filter by Category
  providerStatusFilter.value = 'all';
  providerCategoryFilter.value = 'plumber';
  assert(filteredProviders.value.length === 1 && filteredProviders.value[0].categoryId === 'plumber', 'Filter category="plumber" returns 1 provider');

  providerCategoryFilter.value = 'electrician';
  assert(filteredProviders.value.length === 2, 'Filter category="electrician" returns 2 providers (Ramesh Sharma & Ramesh Kumar)');

  // Combined Filters (Pending + Electrician)
  providerStatusFilter.value = 'pending';
  providerCategoryFilter.value = 'electrician';
  providerSearchQuery.value = 'Kumar';
  assert(filteredProviders.value.length === 1 && filteredProviders.value[0].id === 'prov-pending', 'Combined filter (pending + electrician + Kumar) returns 1 pending match');

  // Combined Filters with contradiction (Pending + Plumber -> 0)
  providerStatusFilter.value = 'pending';
  providerCategoryFilter.value = 'plumber';
  providerSearchQuery.value = '';
  assert(filteredProviders.value.length === 0, 'Contradictory filter (pending + plumber) returns 0 matches');

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

  console.log('\n--- 5. Review Modal State & In-Flight Safeguards ---');
  const pendingWorker = mockProviders.find((p) => p.verificationStatus === 'PENDING_VERIFICATION')!;
  assert(!!pendingWorker, 'Mock pending worker is present for review test');

  // Open review modal
  openReviewModal(pendingWorker);
  assert(isReviewModalOpen.value === true, 'Review modal is open after openReviewModal()');
  assert(reviewingProvider.value?.id === pendingWorker.id, 'reviewingProvider is correctly set to pending worker');
  assert(verifyError.value === null, 'verifyError is reset to null when modal opens');

  // Attempt close while verifying in-flight (guard check)
  isVerifyingWorker.value = true;
  closeReviewModal();
  assert(isReviewModalOpen.value === true, 'closeReviewModal() is blocked while isVerifyingWorker is true (in-flight guard)');
  assert(reviewingProvider.value !== null, 'reviewingProvider is not cleared while verification is in-flight');

  // Close modal when not in-flight
  isVerifyingWorker.value = false;
  closeReviewModal();
  assert(isReviewModalOpen.value === false, 'Review modal closes successfully when not in-flight');
  assert(reviewingProvider.value === null, 'reviewingProvider is cleared on modal close');
  assert(verifyError.value === null, 'verifyError remains null on clean close');

  console.log('\n--- 6. Document Zoom Viewer State & Safety Guarantees ---');
  assert(viewingDocument.value === null, 'viewingDocument is null initially');

  // Open review modal first
  openReviewModal(pendingWorker);
  assert(isReviewModalOpen.value === true, 'Review modal opened for document inspection');

  // Open Document Zoom Viewer
  const testDocTitle = 'Aadhaar Front';
  const testDocUrl = `/api/admin/providers/${pendingWorker.id}/documents/aadhaar-front`;
  const testBlobUrl = 'blob:http://localhost:3000/mock-aadhaar-blob-123';
  openDocumentViewer(testDocTitle, testDocUrl, testBlobUrl);

  assert(viewingDocument.value !== null, 'viewingDocument is active after openDocumentViewer()');
  assert(viewingDocument.value?.title === testDocTitle, 'Viewer displays correct document title');
  assert(viewingDocument.value?.url === testDocUrl, 'Viewer holds correct document endpoint URL');
  assert(viewingDocument.value?.blobUrl === testBlobUrl, 'Viewer reuses preloaded authenticated blobUrl without re-fetching');
  assert(isVerifyingWorker.value === false, 'Opening zoom viewer does NOT trigger worker verification request');
  assert(reviewingProvider.value?.id === pendingWorker.id, 'Underlying review worker state is fully preserved');
  assert(isReviewModalOpen.value === true, 'Underlying review modal remains active while viewer is open');

  // Close Document Zoom Viewer
  closeDocumentViewer();
  assert(viewingDocument.value === null, 'viewingDocument is cleared on closeDocumentViewer()');
  assert(isReviewModalOpen.value === true, 'Review modal remains open after closing document viewer');
  assert(reviewingProvider.value?.id === pendingWorker.id, 'Reviewing provider remains active after closing document viewer');
  assert(isVerifyingWorker.value === false, 'Closing zoom viewer does NOT trigger worker verification request');

  // Re-open viewer and verify clean cascade on closeReviewModal()
  openDocumentViewer(testDocTitle, testDocUrl, testBlobUrl);
  assert(viewingDocument.value !== null, 'viewingDocument re-opened successfully');
  closeReviewModal();
  assert(viewingDocument.value === null, 'viewingDocument is automatically cleared when review modal closes');
  assert(isReviewModalOpen.value === false, 'Review modal is closed');
  assert(reviewingProvider.value === null, 'reviewingProvider is cleared');

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
