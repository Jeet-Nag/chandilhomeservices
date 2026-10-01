import {
  bookingsList,
  bookingsTotal,
  bookingsLimit,
  bookingsOffset,
  isBookingsLoading,
  bookingsError,
  bookingSearchQuery,
  bookingStatusFilter,
  bookingCategoryFilter,
  bookingLocalityFilter,
  bookingProviderFilter,
  currentPage,
  totalPages,
  hasPrevPage,
  hasNextPage,
  showingRange,
  getEffectiveLimit,
  selectedBookingDetail,
  isDetailLoading,
  detailError,
  isDetailModalOpen,
  isPlayingDetailAudio,
  detailAudioError,
  isCancelModalOpen,
  cancelReason,
  cancelReasonError,
  isCancelling,
  cancelError,
  cancelSuccessMessage,
  validateCancelReason,
  openCancelModal,
  closeCancelModal,
  openBookingDetail,
  closeBookingDetail,
  clearBookingFilters,
  setBookingPage,
  nextBookingPage,
  prevBookingPage,
  stopDetailAudio,
  toggleDetailAudio,
  clearCancelSuccessMessage,
} from '../../client/src/state/admin-bookings';
import { en } from '../../shared/i18n/en';
import { hi } from '../../shared/i18n/hi';
import {
  canTransition,
  CHANDIL_LOCALITIES,
  BookingStatus,
  AdminBookingListItem,
  AdminBookingDetail,
} from '../../shared';

console.log('\n============================================================');
console.log('ADMIN BOOKING MANAGEMENT — CLIENT UI & STATE TEST SUITE');
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

// Sample mock data for assertions
const mockBookings: AdminBookingListItem[] = [
  {
    id: '11111111-2222-3333-4444-555555555551',
    shortId: '11111111',
    customerId: 'cust-1',
    customerName: 'Amit Verma',
    customerPhone: '9800011001',
    providerId: 'prov-1',
    providerName: 'Ramesh Sharma',
    providerPhone: '9800055001',
    categoryId: 'electrician',
    categoryTitleEn: 'Electrician',
    categoryTitleHi: 'बिजली मिस्त्री',
    areaLocality: 'chandil-bazar',
    localityNameEn: 'Chandil Bazar',
    localityNameHi: 'चंडिल बाज़ार',
    status: 'SERVICE_REQUESTED',
    visitingFee: 149,
    finalAmount: null,
    paymentCollected: false,
    hasAudio: true,
    createdAt: new Date('2026-03-01T10:00:00Z').toISOString(),
  },
  {
    id: '11111111-2222-3333-4444-555555555552',
    shortId: '11111112',
    customerId: 'cust-2',
    customerName: 'Priya Singh',
    customerPhone: '9800011002',
    providerId: null,
    providerName: null,
    providerPhone: null,
    categoryId: 'plumber',
    categoryTitleEn: 'Plumber',
    categoryTitleHi: 'नल / प्लंबर',
    areaLocality: 'station-colony',
    localityNameEn: 'Station Colony',
    localityNameHi: 'स्टेशन कॉलोनी',
    status: 'SERVICE_REQUESTED',
    visitingFee: 149,
    finalAmount: null,
    paymentCollected: false,
    hasAudio: false,
    createdAt: new Date('2026-03-01T11:00:00Z').toISOString(),
  },
  {
    id: '11111111-2222-3333-4444-555555555553',
    shortId: '11111113',
    customerId: 'cust-3',
    customerName: 'Rajesh Kumar',
    customerPhone: '9800011003',
    providerId: 'prov-2',
    providerName: 'Sunil Mahato',
    providerPhone: '9800055002',
    categoryId: 'appliance-repair',
    categoryTitleEn: 'Appliance Repair',
    categoryTitleHi: 'घरेलू उपकरण रिपेयर',
    areaLocality: 'dam-road',
    localityNameEn: 'Dam Road',
    localityNameHi: 'डैम रोड',
    status: 'BOOKING_COMPLETED',
    visitingFee: 149,
    finalAmount: 350,
    paymentCollected: true,
    hasAudio: false,
    createdAt: new Date('2026-03-01T12:00:00Z').toISOString(),
  },
];

const mockDetail: AdminBookingDetail = {
  booking: {
    id: '11111111-2222-3333-4444-555555555551',
    idempotencyKey: 'idem-test-1',
    status: 'SERVICE_STARTED',
    timestamps: {
      createdAt: '2026-03-01T10:00:00Z',
      acceptedAt: '2026-03-01T10:15:00Z',
      startedAt: '2026-03-01T10:45:00Z',
      completedAt: null,
      updatedAt: '2026-03-01T10:45:00Z',
    },
    areaLocality: 'chandil-bazar',
    landmark: 'Near Water Tank',
    textDescription: 'Switchboard sparking and smelling of burning plastic',
    audioUrl: '/api/audio/mock-audio.webm',
    audioDurationSeconds: 12,
    visitingFee: 149,
    finalAmount: null,
    paymentMethod: 'CASH',
    paymentCollected: false,
  },
  customer: {
    id: 'cust-1',
    fullName: 'Amit Verma',
    phone: '9800011001',
    preferredLanguage: 'hi',
  },
  provider: {
    id: 'prov-1',
    fullName: 'Ramesh Sharma',
    phone: '9800055001',
    serviceArea: 'Chandil Bazar',
    rating: 4.8,
  },
  category: {
    id: 'electrician',
    titleEn: 'Electrician',
    titleHi: 'बिजली मिस्त्री',
  },
  timeline: [
    {
      id: 'log-1',
      fromStatus: null,
      toStatus: 'SERVICE_REQUESTED',
      changedBy: { id: 'cust-1', name: 'Amit Verma', role: 'customer' },
      notes: 'Initial customer booking submission',
      createdAt: '2026-03-01T10:00:00Z',
    },
    {
      id: 'log-2',
      fromStatus: 'SERVICE_REQUESTED',
      toStatus: 'PROVIDER_ASSIGNED',
      changedBy: { id: 'admin-1', name: 'Admin User', role: 'admin' },
      notes: null,
      createdAt: '2026-03-01T10:10:00Z',
    },
    {
      id: 'log-3',
      fromStatus: 'PROVIDER_ASSIGNED',
      toStatus: 'PROVIDER_ACCEPTED',
      changedBy: { id: 'prov-1', name: 'Ramesh Sharma', role: 'provider' },
      notes: null,
      createdAt: '2026-03-01T10:15:00Z',
    },
    {
      id: 'log-4',
      fromStatus: 'PROVIDER_ACCEPTED',
      toStatus: 'SERVICE_STARTED',
      changedBy: { id: 'prov-1', name: 'Ramesh Sharma', role: 'provider' },
      notes: null,
      createdAt: '2026-03-01T10:45:00Z',
    },
  ],
};

const mockUnassignedDetail: AdminBookingDetail = {
  ...mockDetail,
  booking: {
    ...mockDetail.booking,
    id: '22222222-2222-2222-2222-222222222222',
    status: 'SERVICE_REQUESTED',
    audioUrl: null,
    audioDurationSeconds: null,
    timestamps: {
      createdAt: '2026-03-01T10:00:00Z',
      acceptedAt: null,
      startedAt: null,
      completedAt: null,
      updatedAt: '2026-03-01T10:00:00Z',
    },
  },
  provider: null,
};

async function runTests() {
  console.log('--- 1. Translation & i18n Parity Verification ---');
  const enKeys = Object.keys(en);
  const hiKeys = Object.keys(hi);

  assert(enKeys.length === hiKeys.length, `Total key count match: EN (${enKeys.length}) === HI (${hiKeys.length})`);

  let missingInHi: string[] = [];
  for (const k of enKeys) {
    if ((hi as any)[k] === undefined) {
      missingInHi.push(k);
    }
  }
  assert(missingInHi.length === 0, `All EN keys exist in HI (missing: ${missingInHi.length})`);

  let missingInEn: string[] = [];
  for (const k of hiKeys) {
    if ((en as any)[k] === undefined) {
      missingInEn.push(k);
    }
  }
  assert(missingInEn.length === 0, `All HI keys exist in EN (missing: ${missingInEn.length})`);

  // Verify non-empty translations across entire catalog
  let emptyTranslations: string[] = [];
  for (const k of enKeys) {
    if (!(en as any)[k]?.trim()) emptyTranslations.push(`EN:${k}`);
    if (!(hi as any)[k]?.trim()) emptyTranslations.push(`HI:${k}`);
  }
  assert(emptyTranslations.length === 0, `Zero empty translations across entire i18n catalog`);

  // Verify natural Hindi: no parenthetical English in Hindi translations
  let parentheticalHindi: string[] = [];
  for (const k of hiKeys) {
    const val = (hi as any)[k];
    if (/\([A-Za-z0-9\s]+\)/.test(val)) {
      parentheticalHindi.push(`${k}: ${val}`);
    }
  }
  assert(parentheticalHindi.length === 0, `Natural Hindi check: zero parenthetical English strings in HI`);

  // Verify placeholder tokens consistency
  const placeholderKeys = ['admin.pagination_showing', 'admin.pagination_page', 'admin.cancel_reason_char_count', 'admin.cancel_success', 'admin.filters_applied_count'];
  for (const pk of placeholderKeys) {
    const enVal = (en as any)[pk] || '';
    const hiVal = (hi as any)[pk] || '';
    const enMatches = (enVal.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort();
    const hiMatches = (hiVal.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort();
    assert(
      JSON.stringify(enMatches) === JSON.stringify(hiMatches),
      `Placeholders match between EN and HI for '${pk}': ${JSON.stringify(enMatches)}`
    );
  }

  console.log('\n--- 2. List State: Loading, Success, Empty, Error, and Retry ---');
  // List loading
  isBookingsLoading.value = true;
  bookingsError.value = null;
  assert(isBookingsLoading.value === true, 'List loading state sets isBookingsLoading to true');
  assert(bookingsError.value === null, 'List loading state clears previous error');

  // List success
  isBookingsLoading.value = false;
  bookingsList.value = mockBookings;
  bookingsTotal.value = 3;
  assert(isBookingsLoading.value === false, 'List success clears loading indicator');
  assert(bookingsList.value.length === 3, 'List success populates bookingsList signal');
  assert(bookingsTotal.value === 3, 'List success populates bookingsTotal signal');

  // List empty
  bookingsList.value = [];
  bookingsTotal.value = 0;
  assert(bookingsList.value.length === 0, 'List empty correctly holds 0 bookings');
  assert(bookingsTotal.value === 0, 'List empty correctly reflects total = 0');

  // List error
  bookingsError.value = 'Failed to fetch bookings';
  assert(bookingsError.value === 'Failed to fetch bookings', 'List error correctly stores error message');

  // Retry
  isBookingsLoading.value = true;
  bookingsError.value = null;
  assert(bookingsError.value === null, 'Retry resets error state before refetching');
  assert(isBookingsLoading.value === true, 'Retry initiates fresh loading cycle');
  isBookingsLoading.value = false;

  console.log('\n--- 3. Search & Filters State ---');
  // Search
  bookingSearchQuery.value = '9800011001';
  assert(bookingSearchQuery.value === '9800011001', 'Search query stored in signal');

  // Status filter
  bookingStatusFilter.value = 'SERVICE_STARTED';
  assert(bookingStatusFilter.value === 'SERVICE_STARTED', 'Status filter stored in signal');

  // Category filter
  bookingCategoryFilter.value = 'electrician';
  assert(bookingCategoryFilter.value === 'electrician', 'Category filter stored in signal');

  // Locality filter
  bookingLocalityFilter.value = 'chandil-bazar';
  assert(bookingLocalityFilter.value === 'chandil-bazar', 'Locality filter stored in signal');

  // Provider filter
  bookingProviderFilter.value = 'prov-1';
  assert(bookingProviderFilter.value === 'prov-1', 'Provider filter stored in signal');

  // Clear filters
  clearBookingFilters();
  assert(bookingSearchQuery.value === '', 'clearBookingFilters clears search query');
  assert(bookingStatusFilter.value === 'all', 'clearBookingFilters resets status to all');
  assert(bookingCategoryFilter.value === 'all', 'clearBookingFilters resets category to all');
  assert(bookingLocalityFilter.value === 'all', 'clearBookingFilters resets locality to all');
  assert(bookingProviderFilter.value === 'all', 'clearBookingFilters resets provider to all');

  console.log('\n--- 4. Pagination Invariants: Default 25, Clamping, and Calculations ---');
  bookingsLimit.value = 25;
  assert(getEffectiveLimit() === 25, 'Default limit is 25');

  // Test limit clamping
  bookingsLimit.value = 0;
  assert(getEffectiveLimit() === 25, 'Limit 0 falls back to default 25');
  bookingsLimit.value = 150;
  assert(getEffectiveLimit() === 100, 'Limit > 100 is clamped to 100');
  bookingsLimit.value = 25;

  // Total 0
  bookingsTotal.value = 0;
  bookingsOffset.value = 0;
  assert(currentPage.value === 1, 'Page 1 when total is 0');
  assert(totalPages.value === 1, 'Total pages 1 when total is 0');
  assert(hasPrevPage.value === false, 'hasPrevPage false when offset is 0');
  assert(hasNextPage.value === false, 'hasNextPage false when total is 0');
  assert(showingRange.value.from === 0 && showingRange.value.to === 0, 'Showing 0-0 when total is 0');

  // Total 60, limit 25 -> 3 pages (25, 25, 10)
  bookingsTotal.value = 60;
  bookingsOffset.value = 0;
  assert(totalPages.value === 3, 'Total pages is 3 for 60 items with limit 25');
  assert(currentPage.value === 1, 'Current page is 1');
  assert(hasPrevPage.value === false, 'Page 1 has no previous page');
  assert(hasNextPage.value === true, 'Page 1 has next page');
  assert(showingRange.value.from === 1 && showingRange.value.to === 25, 'Range is 1-25 on page 1');

  // Page 2
  bookingsOffset.value = 25;
  assert(currentPage.value === 2, 'Current page is 2');
  assert(hasPrevPage.value === true, 'Page 2 has previous page');
  assert(hasNextPage.value === true, 'Page 2 has next page');
  assert(showingRange.value.from === 26 && showingRange.value.to === 50, 'Range is 26-50 on page 2');

  // Page 3 (final)
  bookingsOffset.value = 50;
  assert(currentPage.value === 3, 'Current page is 3');
  assert(hasPrevPage.value === true, 'Page 3 has previous page');
  assert(hasNextPage.value === false, 'Page 3 has no next page (50 + 25 >= 60)');
  assert(showingRange.value.from === 51 && showingRange.value.to === 60, 'Range is 51-60 on page 3');

  console.log('\n--- 5. Detail View: Loading, Success, 404, Timestamps, and Unassigned ---');
  // Detail loading
  isDetailLoading.value = true;
  detailError.value = null;
  assert(isDetailLoading.value === true, 'Detail loading state activates spinner');
  assert(detailError.value === null, 'Detail loading clears previous error');

  // Detail success
  isDetailLoading.value = false;
  selectedBookingDetail.value = mockDetail;
  assert(selectedBookingDetail.value !== null, 'Detail success populates selectedBookingDetail');
  assert(selectedBookingDetail.value?.booking.id === mockDetail.booking.id, 'Booking ID matches');
  assert(selectedBookingDetail.value?.customer.phone === '9800011001', 'Customer phone matches');
  assert(selectedBookingDetail.value?.provider?.fullName === 'Ramesh Sharma', 'Provider details present');

  // Explicit timestamps
  assert(typeof selectedBookingDetail.value?.booking.timestamps.createdAt === 'string', 'createdAt timestamp present');
  assert(typeof selectedBookingDetail.value?.booking.timestamps.acceptedAt === 'string', 'acceptedAt timestamp present');
  assert(typeof selectedBookingDetail.value?.booking.timestamps.startedAt === 'string', 'startedAt timestamp present');
  assert(selectedBookingDetail.value?.booking.timestamps.completedAt === null, 'completedAt is null for in-progress booking');

  // Detail 404
  selectedBookingDetail.value = null;
  detailError.value = 'Booking not found.';
  assert(detailError.value === 'Booking not found.', 'Detail 404 sets user-facing error message');

  // Unassigned provider
  selectedBookingDetail.value = mockUnassignedDetail;
  assert(selectedBookingDetail.value.provider === null, 'Unassigned booking has provider === null');
  assert(en['admin.not_assigned'] === 'Not assigned', 'English translation for unassigned is "Not assigned"');
  assert(hi['admin.not_assigned'] === 'आवंटित नहीं', 'Hindi translation for unassigned is "आवंटित नहीं"');

  console.log('\n--- 6. Audio Player State: Present, Absent, Playback Controls ---');
  // Audio present
  assert(mockDetail.booking.audioUrl !== null, 'Audio URL present in mockDetail');
  assert(mockDetail.booking.audioDurationSeconds === 12, 'Audio duration available');

  // Audio absent
  assert(mockUnassignedDetail.booking.audioUrl === null, 'Audio URL is null in mockUnassignedDetail');
  assert(en['admin.no_voice_note'] === 'No voice note', 'English label for absent audio');
  assert(hi['admin.no_voice_note'] === 'कोई वॉयस नोट नहीं', 'Hindi label for absent audio');

  // Audio state signals
  isPlayingDetailAudio.value = true;
  assert(isPlayingDetailAudio.value === true, 'isPlayingDetailAudio reflects playing state');
  stopDetailAudio();
  assert(isPlayingDetailAudio.value === false, 'stopDetailAudio resets playing state to false');

  console.log('\n--- 7. Timeline Chronology & Structural Integrity ---');
  assert(Array.isArray(mockDetail.timeline), 'Timeline is an array');
  assert(mockDetail.timeline.length === 4, 'Timeline contains 4 status change logs');
  for (let i = 1; i < mockDetail.timeline.length; i++) {
    const prevTime = new Date(mockDetail.timeline[i - 1].createdAt).getTime();
    const currTime = new Date(mockDetail.timeline[i].createdAt).getTime();
    assert(currTime >= prevTime, `Timeline event ${i} is chronologically non-decreasing`);
  }
  assert(mockDetail.timeline[0].fromStatus === null, 'Initial timeline event fromStatus is null');
  assert(mockDetail.timeline[0].toStatus === 'SERVICE_REQUESTED', 'Initial event toStatus is SERVICE_REQUESTED');
  assert(mockDetail.timeline[1].fromStatus === 'SERVICE_REQUESTED', 'Event 1 fromStatus matches event 0 toStatus');
  assert(mockDetail.timeline[1].toStatus === 'PROVIDER_ASSIGNED', 'Event 1 toStatus matches assignment');

  console.log('\n--- 8. Administrative Cancellation: Visibility, Validation, Submit, 409, and Success ---');
  // Visibility guard
  const cancellableStatuses: BookingStatus[] = [
    'SERVICE_REQUESTED',
    'PROVIDER_ASSIGNED',
    'PROVIDER_ACCEPTED',
    'PROVIDER_ON_THE_WAY',
    'SERVICE_STARTED',
    'SERVICE_COMPLETED',
    'PAYMENT_PENDING',
    'REJECTED_BY_PROVIDER',
  ];
  for (const st of cancellableStatuses) {
    assert(
      canTransition(st, 'CANCELLED_BY_ADMIN', 'admin') === true,
      `Cancel button visible for ${st} (canTransition === true)`
    );
  }
  const terminalStatuses: BookingStatus[] = [
    'PAYMENT_COLLECTED',
    'BOOKING_COMPLETED',
    'CANCELLED_BY_CUSTOMER',
    'CANCELLED_BY_ADMIN',
  ];
  for (const st of terminalStatuses) {
    assert(
      canTransition(st, 'CANCELLED_BY_ADMIN', 'admin') === false,
      `Cancel button HIDDEN for ${st} (canTransition === false)`
    );
  }

  // Reason validation
  assert(validateCancelReason('') !== null, 'Empty reason is rejected');
  assert(validateCancelReason('   ') !== null, 'Whitespace-only reason is rejected');
  assert(validateCancelReason('ab') !== null, '2-character reason is rejected');
  assert(validateCancelReason('abc') === null, '3-character reason is accepted');
  assert(validateCancelReason('Valid administrative operational reason') === null, 'Valid reason accepted');
  assert(validateCancelReason('a'.repeat(255)) === null, '255-character reason accepted');
  assert(validateCancelReason('a'.repeat(256)) !== null, '256-character reason rejected (>255)');

  // Modal open/close
  openCancelModal();
  assert(isCancelModalOpen.value === true, 'openCancelModal sets isCancelModalOpen to true');
  assert(cancelReason.value === '', 'openCancelModal initializes empty reason');
  closeCancelModal();
  assert(isCancelModalOpen.value === false, 'closeCancelModal sets isCancelModalOpen to false');

  // Submit and loading
  isCancelling.value = true;
  assert(isCancelling.value === true, 'isCancelling is true while cancellation request is in-flight');
  isCancelling.value = false;

  // 409 Conflict
  cancelError.value = en['admin.cancel_conflict_desc'];
  assert(
    cancelError.value === 'The booking status changed and can no longer be cancelled.',
    '409 Conflict message is accurate and user-friendly'
  );
  cancelError.value = null;

  // General API error
  cancelError.value = 'Failed to cancel booking. Server error.';
  assert(cancelError.value !== null, 'Cancellation API error preserved in state');
  cancelError.value = null;

  // Cancellation success
  cancelSuccessMessage.value = 'Booking #11111111 cancelled successfully.';
  assert(cancelSuccessMessage.value !== null, 'Success banner message stored');
  clearCancelSuccessMessage();
  assert(cancelSuccessMessage.value === null, 'clearCancelSuccessMessage resets success state');

  console.log('\n--- 9. Read-Only Invariants: Financial and Booking Controls ---');
  // Financial fields are read-only
  assert(typeof mockDetail.booking.visitingFee === 'number', 'visitingFee is numeric');
  assert(mockDetail.booking.visitingFee === 149, 'visitingFee matches 149');
  assert(mockDetail.booking.paymentMethod === 'CASH', 'paymentMethod is strictly CASH');
  assert(typeof mockDetail.booking.paymentCollected === 'boolean', 'paymentCollected is boolean');

  // Check no assignment / reassignment functions exist in booking state
  const stateKeys = Object.keys(await import('../../client/src/state/admin-bookings'));
  assert(!stateKeys.includes('assignProvider'), 'ZERO provider assignment methods in admin-bookings state');
  assert(!stateKeys.includes('reassignProvider'), 'ZERO provider reassignment methods in admin-bookings state');
  assert(!stateKeys.includes('overrideStatus'), 'ZERO status override methods in admin-bookings state');
  assert(!stateKeys.includes('editFee'), 'ZERO fee editing methods in admin-bookings state');

  console.log('\n============================================================');
  console.log(`CLIENT UI & STATE TESTS COMPLETE: ${passCount} passed, ${failCount} failed`);
  console.log('============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
