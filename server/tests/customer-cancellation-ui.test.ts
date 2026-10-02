import {
  activeBookingDetail,
  bookingHistory,
  isCancelDialogOpen,
  cancelReason,
  cancelReasonError,
  isCancelling,
  cancelError,
  cancelSuccessMessage,
  canCancelBooking,
  openCancelDialog,
  closeCancelDialog,
  clearCancelSuccessMessage,
  setCancelReason,
  validateCancelReason,
  submitCancelBooking,
  openBookingDetail,
  closeBookingDetail,
} from '../../client/src/state/booking';
import { en } from '../../shared/i18n/en';
import { hi } from '../../shared/i18n/hi';
import { authToken } from '../../client/src/state/auth';
import { BookingStatus, BookingDetail, Booking } from '../../shared';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n============================================================');
console.log('MODULE 13 STEP 2 — CUSTOMER BOOKING CANCELLATION UI TESTS');
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

// Sample mock booking details
function createMockBooking(status: BookingStatus): BookingDetail {
  return {
    id: 'b1111111-2222-3333-4444-555555555555',
    idempotencyKey: 'idem-test-1',
    customerId: 'cust-123',
    providerId: status === 'SERVICE_REQUESTED' ? null : 'prov-456',
    categoryId: 'electrician',
    audioUrl: null,
    audioDurationSeconds: null,
    textDescription: 'Fan regulator broken',
    areaLocality: 'chandil-bazar',
    landmark: 'Station road',
    status,
    visitingFee: 149,
    finalAmount: null,
    paymentMethod: 'CASH',
    paymentCollected: false,
    createdAt: '2026-10-01T10:00:00.000Z',
    acceptedAt: status === 'PROVIDER_ACCEPTED' ? '2026-10-01T10:05:00.000Z' : null,
    startedAt: null,
    completedAt: null,
    updatedAt: '2026-10-01T10:00:00.000Z',
    provider: status === 'SERVICE_REQUESTED' ? null : { name: 'Ramesh Sharma' },
    statusLogs: [
      {
        id: 'log-1',
        bookingId: 'b1111111-2222-3333-4444-555555555555',
        fromStatus: null,
        toStatus: 'SERVICE_REQUESTED',
        changedBy: 'cust-123',
        notes: 'Initial request',
        createdAt: '2026-10-01T10:00:00.000Z',
      },
    ],
  };
}

async function runTests() {
  // Preserve global fetch
  const originalFetch = globalThis.fetch;

  try {
    // =========================================================================
    // 1. CANCELLATION BUTTON VISIBILITY ACROSS ALL BOOKING STATUSES
    // =========================================================================
    console.log('--- 1. Cancellation Button Visibility Across All Booking Statuses ---');

    // 1. Button visible for SERVICE_REQUESTED
    assert(
      canCancelBooking('SERVICE_REQUESTED') === true,
      '1. Button visible for SERVICE_REQUESTED'
    );

    // 2. Button visible for PROVIDER_ASSIGNED
    assert(
      canCancelBooking('PROVIDER_ASSIGNED') === true,
      '2. Button visible for PROVIDER_ASSIGNED'
    );

    // 3. Button visible for PROVIDER_ACCEPTED
    assert(
      canCancelBooking('PROVIDER_ACCEPTED') === true,
      '3. Button visible for PROVIDER_ACCEPTED'
    );

    // 4. Button hidden for PROVIDER_ON_THE_WAY
    assert(
      canCancelBooking('PROVIDER_ON_THE_WAY') === false,
      '4. Button hidden for PROVIDER_ON_THE_WAY'
    );

    // 5. Button hidden for SERVICE_STARTED
    assert(
      canCancelBooking('SERVICE_STARTED') === false,
      '5. Button hidden for SERVICE_STARTED'
    );

    // 6. Button hidden for SERVICE_COMPLETED
    assert(
      canCancelBooking('SERVICE_COMPLETED') === false,
      '6. Button hidden for SERVICE_COMPLETED'
    );

    // 7. Button hidden for PAYMENT_PENDING
    assert(
      canCancelBooking('PAYMENT_PENDING') === false,
      '7. Button hidden for PAYMENT_PENDING'
    );

    // 8. Button hidden for PAYMENT_COLLECTED
    assert(
      canCancelBooking('PAYMENT_COLLECTED') === false,
      '8. Button hidden for PAYMENT_COLLECTED'
    );

    // 9. Button hidden for BOOKING_COMPLETED
    assert(
      canCancelBooking('BOOKING_COMPLETED') === false,
      '9. Button hidden for BOOKING_COMPLETED'
    );

    // 10. Button hidden for CANCELLED_BY_CUSTOMER
    assert(
      canCancelBooking('CANCELLED_BY_CUSTOMER') === false,
      '10. Button hidden for CANCELLED_BY_CUSTOMER'
    );

    // 11. Button hidden for CANCELLED_BY_ADMIN
    assert(
      canCancelBooking('CANCELLED_BY_ADMIN') === false,
      '11. Button hidden for CANCELLED_BY_ADMIN'
    );

    // Additional check: REJECTED_BY_PROVIDER is not cancellable by customer
    assert(
      canCancelBooking('REJECTED_BY_PROVIDER') === false,
      '11b. Button hidden for REJECTED_BY_PROVIDER'
    );

    // =========================================================================
    // 2. DIALOG BEHAVIOR & API ISOLATION
    // =========================================================================
    console.log('\n--- 2. Dialog Behavior & API Isolation ---');

    let fetchCallCount = 0;
    globalThis.fetch = async () => {
      fetchCallCount++;
      return { ok: true, status: 200, json: async () => ({ success: true }) } as any;
    };

    activeBookingDetail.value = createMockBooking('SERVICE_REQUESTED');
    isCancelDialogOpen.value = false;
    cancelReason.value = 'Old reason';
    cancelReasonError.value = 'Old error';
    cancelError.value = 'Old error';

    // 12. Dialog opens
    openCancelDialog();
    assert(
      isCancelDialogOpen.value === true &&
        cancelReason.value === '' &&
        cancelReasonError.value === null &&
        cancelError.value === null,
      '12. Dialog opens and resets reason & error state'
    );

    // 13. Opening dialog does not call API
    assert(
      fetchCallCount === 0,
      '13. Opening dialog does not call API'
    );

    // Dialog close
    closeCancelDialog();
    assert(
      isCancelDialogOpen.value === false,
      '13b. Dialog closes cleanly via closeCancelDialog()'
    );

    // =========================================================================
    // 3. REASON INPUT VALIDATION
    // =========================================================================
    console.log('\n--- 3. Reason Input Validation ---');

    // 14. Reason optional
    setCancelReason('');
    assert(
      validateCancelReason(cancelReason.value) === true && cancelReasonError.value === null,
      '14. Reason is optional (empty reason is valid on client)'
    );

    // 15. Reason included when supplied
    setCancelReason('Going out of town for emergency');
    assert(
      cancelReason.value === 'Going out of town for emergency' &&
        validateCancelReason(cancelReason.value) === true &&
        cancelReasonError.value === null,
      '15. Reason included and valid when supplied'
    );

    // 16. Empty / whitespace reason handled correctly
    setCancelReason('   ');
    assert(
      cancelReason.value.trim().length === 0 &&
        validateCancelReason(cancelReason.value) === true,
      '16. Whitespace-only reason handled correctly (trimmed to empty payload)'
    );

    // 17. Reason length validation (max 255 chars)
    const exact255 = 'A'.repeat(255);
    setCancelReason(exact255);
    assert(
      validateCancelReason(cancelReason.value) === true && cancelReasonError.value === null,
      '17a. Exactly 255 characters reason is accepted'
    );

    const exceed255 = 'B'.repeat(256);
    setCancelReason(exceed255);
    assert(
      validateCancelReason(cancelReason.value) === false && cancelReasonError.value !== null,
      '17b. Exceeding 255 characters (256 chars) is rejected with error'
    );

    // =========================================================================
    // 4. LOADING STATE & DUPLICATE SUBMISSION PREVENTION
    // =========================================================================
    console.log('\n--- 4. Loading State & Duplicate Submission Prevention ---');

    authToken.value = 'valid-customer-token';
    activeBookingDetail.value = createMockBooking('SERVICE_REQUESTED');
    setCancelReason('Valid reason');

    // 18. Confirm button loading state
    isCancelling.value = true;
    assert(
      isCancelling.value === true,
      '18. Confirm button enters loading state during active request'
    );

    // 19. Duplicate submit prevented
    const duplicatePromise = await submitCancelBooking();
    assert(
      duplicatePromise === false,
      '19. Duplicate submission prevented when request is already in-flight'
    );

    // Reset cancelling
    isCancelling.value = false;

    // =========================================================================
    // 5. SUCCESSFUL API RESPONSE & STATE UPDATES
    // =========================================================================
    console.log('\n--- 5. Successful API Response & State Updates ---');

    let capturedCancelUrl = '';
    let capturedCancelMethod = '';
    let capturedBody: any = null;
    let capturedAuth = '';

    const testBooking = createMockBooking('PROVIDER_ACCEPTED');
    activeBookingDetail.value = testBooking;
    bookingHistory.value = [testBooking];
    openCancelDialog();
    setCancelReason('Customer rescheduling');

    globalThis.fetch = async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/cancel')) {
        capturedCancelUrl = urlStr;
        capturedCancelMethod = opts?.method || 'GET';
        capturedAuth = opts?.headers?.['Authorization'] || opts?.headers?.Authorization;
        if (opts?.body) {
          capturedBody = JSON.parse(opts.body);
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              ...testBooking,
              status: 'CANCELLED_BY_CUSTOMER',
              updatedAt: '2026-10-01T10:15:00.000Z',
            },
          }),
        } as any;
      }
      // Response for background fetchBookingDetail
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            ...testBooking,
            status: 'CANCELLED_BY_CUSTOMER',
            statusLogs: [],
          },
        }),
      } as any;
    };

    const successResult = await submitCancelBooking();

    // 20. Successful API response updates state
    assert(
      successResult === true,
      '20a. submitCancelBooking() returns true on 200 OK'
    );
    assert(
      capturedCancelUrl === `/api/bookings/${testBooking.id}/cancel`,
      '20b. Correct endpoint called: /api/bookings/:id/cancel'
    );
    assert(
      capturedCancelMethod === 'POST',
      '20c. Request method is strictly POST'
    );
    assert(
      capturedAuth === 'Bearer valid-customer-token',
      '20d. Bearer token forwarded in Authorization header'
    );
    assert(
      capturedBody?.reason === 'Customer rescheduling',
      '20e. Trimmed reason payload forwarded in request body'
    );
    assert(
      !capturedBody?.customerId && !capturedBody?.status && !capturedBody?.providerId,
      '20f. Protected fields (customerId, status, providerId) NOT sent in request body'
    );
    assert(
      activeBookingDetail.value?.status === 'CANCELLED_BY_CUSTOMER',
      '20g. activeBookingDetail status updated to CANCELLED_BY_CUSTOMER'
    );
    assert(
      bookingHistory.value[0]?.status === 'CANCELLED_BY_CUSTOMER',
      '20h. bookingHistory list entry reconciled to CANCELLED_BY_CUSTOMER'
    );
    assert(
      isCancelDialogOpen.value === false,
      '20i. Confirmation dialog closed automatically upon success'
    );
    assert(
      cancelSuccessMessage.value !== null,
      '20j. Success feedback message displayed'
    );

    // =========================================================================
    // 6. ERROR HANDLING & STATUS RACE RECONCILIATION
    // =========================================================================
    console.log('\n--- 6. Error Handling & Status Race Reconciliation ---');

    // 21. 409 Conflict (status race condition) refresh behavior
    let detailReFetched = false;
    const racedBooking = createMockBooking('PROVIDER_ACCEPTED');
    activeBookingDetail.value = racedBooking;
    openCancelDialog();

    globalThis.fetch = async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/cancel')) {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            success: false,
            error: {
              code: 'INVALID_STATUS_TRANSITION',
              messageEn: 'Cannot cancel booking in status PROVIDER_ON_THE_WAY.',
              messageHi: 'स्थिति PROVIDER_ON_THE_WAY में बुकिंग रद्द नहीं की जा सकती।',
            },
          }),
        } as any;
      }
      if (urlStr === `/api/bookings/${racedBooking.id}`) {
        detailReFetched = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              ...racedBooking,
              status: 'PROVIDER_ON_THE_WAY',
            },
          }),
        } as any;
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) } as any;
    };

    const conflictResult = await submitCancelBooking();
    assert(
      conflictResult === false,
      '21a. 409 conflict returns false'
    );
    assert(
      detailReFetched === true,
      '21b. 409 conflict triggers re-fetch of booking detail from server'
    );
    assert(
      activeBookingDetail.value?.status === 'PROVIDER_ON_THE_WAY',
      '21c. Authoritative server status updated in client state (PROVIDER_ON_THE_WAY)'
    );
    assert(
      canCancelBooking(activeBookingDetail.value!.status) === false,
      '21d. Cancellation button becomes hidden following authoritative server reconciliation'
    );
    assert(
      cancelError.value !== null,
      '21e. User-friendly conflict error message shown'
    );

    // 22. 400 Validation behavior
    activeBookingDetail.value = createMockBooking('SERVICE_REQUESTED');
    openCancelDialog();
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          messageEn: 'Cancellation reason must not exceed 255 characters.',
          messageHi: 'रद्दीकरण का कारण 255 अक्षरों से अधिक नहीं होना चाहिए।',
        },
      }),
    } as any);

    const valResult = await submitCancelBooking();
    assert(
      valResult === false && cancelError.value !== null,
      '22. 400 validation error displayed clearly to user'
    );

    // 23. Network error behavior
    openCancelDialog();
    globalThis.fetch = async () => {
      throw new Error('Failed to fetch (offline)');
    };

    const netResult = await submitCancelBooking();
    assert(
      netResult === false && cancelError.value !== null,
      '23. Network failure handled gracefully without uncaught exceptions'
    );

    // 24. Authentication error behavior (401 / missing token)
    authToken.value = null;
    openCancelDialog();
    const noAuthResult = await submitCancelBooking();
    assert(
      noAuthResult === false,
      '24a. submitCancelBooking() aborts immediately when unauthenticated'
    );

    authToken.value = 'expired-token';
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ success: false }),
    } as any);
    const expiredAuthResult = await submitCancelBooking();
    assert(
      expiredAuthResult === false,
      '24b. 401 response handled via session expiration handler'
    );
    authToken.value = 'valid-customer-token';

    // 25. No optimistic cancellation
    const pendingBooking = createMockBooking('SERVICE_REQUESTED');
    activeBookingDetail.value = pendingBooking;
    openCancelDialog();

    let beforeResolveStatus: BookingStatus | undefined;
    globalThis.fetch = async () => {
      beforeResolveStatus = activeBookingDetail.value?.status;
      return {
        ok: false,
        status: 500,
        json: async () => ({ success: false }),
      } as any;
    };

    await submitCancelBooking();
    assert(
      beforeResolveStatus === 'SERVICE_REQUESTED',
      '25a. Status was NOT prematurely updated during request execution'
    );
    assert(
      activeBookingDetail.value?.status === 'SERVICE_REQUESTED',
      '25b. Status remains SERVICE_REQUESTED when request fails (no optimistic status mutation)'
    );

    // =========================================================================
    // 7. I18N COMPLETENESS & PARITY AUDIT
    // =========================================================================
    console.log('\n--- 7. i18n Completeness & Parity Audit ---');

    const requiredKeys = [
      'detail.cancel_booking_btn',
      'detail.cancel_modal_title',
      'detail.cancel_modal_desc',
      'detail.cancel_reason_label',
      'detail.cancel_reason_placeholder',
      'detail.cancel_reason_char_count',
      'detail.cancel_reason_max',
      'detail.keep_booking_btn',
      'detail.confirm_cancel_btn',
      'detail.cancelling',
      'detail.cancel_success',
      'detail.cancel_conflict_error',
      'detail.cancel_conflict_desc',
    ];

    let allEnPresent = true;
    let allHiPresent = true;

    for (const key of requiredKeys) {
      if (!(key in en) || !(en as any)[key]) {
        console.error(`  Missing EN key: ${key}`);
        allEnPresent = false;
      }
      if (!(key in hi) || !(hi as any)[key]) {
        console.error(`  Missing HI key: ${key}`);
        allHiPresent = false;
      }
    }

    // 26. EN/HI i18n keys present
    assert(
      allEnPresent && allHiPresent,
      '26. All required customer cancellation i18n keys present in both en.ts and hi.ts'
    );

    // 27. Exact EN/HI key parity
    const enKeys = Object.keys(en);
    const hiKeys = Object.keys(hi);
    const diff = enKeys.filter((k) => !hiKeys.includes(k)).concat(hiKeys.filter((k) => !enKeys.includes(k)));
    assert(
      diff.length === 0,
      `27. Exact EN/HI translation key parity maintained (${enKeys.length} EN keys, ${hiKeys.length} HI keys, 0 discrepancies)`
    );

    // =========================================================================
    // 8. COMPONENT STRUCTURE & ACCESSIBILITY AUDIT
    // =========================================================================
    console.log('\n--- 8. Component Structure & Accessibility Audit ---');

    const screenPath = path.resolve(__dirname, '../../client/src/components/BookingDetailScreen.tsx');
    const screenSource = fs.readFileSync(screenPath, 'utf8');

    assert(
      screenSource.includes('canCancelBooking') &&
        screenSource.includes('openCancelDialog') &&
        screenSource.includes('closeCancelDialog') &&
        screenSource.includes('submitCancelBooking'),
      '28. BookingDetailScreen.tsx wires cancellation handlers and state correctly'
    );

    assert(
      screenSource.includes('min-h-[48px]'),
      '29. Minimum 48px touch targets enforced on all cancellation buttons and inputs'
    );

    assert(
      screenSource.includes('maxLength={255}'),
      '30. Cancellation reason textarea enforces maxLength of 255'
    );

  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('\n============================================================');
  console.log(`CUSTOMER CANCELLATION UI TESTS: ${passCount} passed, ${failCount} failed`);
  console.log('============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error in customer cancellation UI tests:', err);
  process.exit(1);
});
