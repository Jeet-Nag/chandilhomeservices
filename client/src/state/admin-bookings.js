import { signal, computed } from '@preact/signals';
import { authToken, handleSessionExpired } from './auth';
import { currentLanguage, t } from './language';
// Main booking list state
export const bookingsList = signal([]);
export const bookingsTotal = signal(0);
export const bookingsLimit = signal(25);
export const bookingsOffset = signal(0);
export const isBookingsLoading = signal(false);
export const bookingsError = signal(null);
// Clamps limit between 1 and 100 (default: 25)
export function getEffectiveLimit() {
    const lim = bookingsLimit.value;
    if (!lim || isNaN(lim))
        return 25;
    return Math.min(Math.max(1, lim), 100);
}
// Search and filters
export const bookingSearchQuery = signal('');
export const bookingStatusFilter = signal('all');
export const bookingCategoryFilter = signal('all');
export const bookingLocalityFilter = signal('all');
export const bookingProviderFilter = signal('all');
// Pagination computed properties
export const currentPage = computed(() => {
    const limit = getEffectiveLimit();
    return Math.floor(bookingsOffset.value / limit) + 1;
});
export const totalPages = computed(() => {
    const limit = getEffectiveLimit();
    return Math.max(1, Math.ceil(bookingsTotal.value / limit));
});
export const hasPrevPage = computed(() => bookingsOffset.value > 0);
export const hasNextPage = computed(() => {
    const limit = getEffectiveLimit();
    return bookingsOffset.value + limit < bookingsTotal.value;
});
export const showingRange = computed(() => {
    const total = bookingsTotal.value;
    if (total === 0)
        return { from: 0, to: 0, total: 0 };
    const limit = getEffectiveLimit();
    const from = bookingsOffset.value + 1;
    const to = Math.min(bookingsOffset.value + limit, total);
    return { from, to, total };
});
// Booking detail state
export const selectedBookingDetail = signal(null);
export const isDetailLoading = signal(false);
export const detailError = signal(null);
export const isDetailModalOpen = signal(false);
// Detail Audio playback
export const isPlayingDetailAudio = signal(false);
export const detailAudioError = signal(null);
let detailAudioElement = null;
// Cancellation modal state
export const isCancelModalOpen = signal(false);
export const cancelReason = signal('');
export const cancelReasonError = signal(null);
export const isCancelling = signal(false);
export const cancelError = signal(null);
export const cancelSuccessMessage = signal(null);
/**
 * Validates cancellation reason text (3–255 characters).
 */
export function validateCancelReason(reasonText) {
    const trimmed = reasonText.trim();
    if (trimmed.length < 3) {
        return t('admin.cancel_reason_required');
    }
    if (trimmed.length > 255) {
        return t('admin.cancel_reason_max');
    }
    return null;
}
/**
 * Stop any currently playing audio in booking detail.
 */
export function stopDetailAudio() {
    if (detailAudioElement) {
        detailAudioElement.pause();
        detailAudioElement.currentTime = 0;
        detailAudioElement = null;
    }
    isPlayingDetailAudio.value = false;
    detailAudioError.value = null;
}
/**
 * Toggle audio playback for active booking detail.
 */
export function toggleDetailAudio(audioUrl) {
    const url = audioUrl || selectedBookingDetail.value?.booking.audioUrl;
    if (!url)
        return;
    if (isPlayingDetailAudio.value && detailAudioElement) {
        detailAudioElement.pause();
        isPlayingDetailAudio.value = false;
        return;
    }
    stopDetailAudio();
    try {
        const audio = new Audio(url);
        detailAudioElement = audio;
        audio.onended = () => {
            isPlayingDetailAudio.value = false;
        };
        audio.onerror = () => {
            isPlayingDetailAudio.value = false;
            detailAudioError.value = t('admin.audio_playback_error');
        };
        audio.play().then(() => {
            isPlayingDetailAudio.value = true;
            detailAudioError.value = null;
        }).catch(() => {
            isPlayingDetailAudio.value = false;
            detailAudioError.value = t('admin.audio_playback_error');
        });
    }
    catch {
        isPlayingDetailAudio.value = false;
        detailAudioError.value = t('admin.audio_playback_error');
    }
}
/**
 * Fetches admin bookings with pagination and filters.
 */
export async function fetchAdminBookings(pageOffset) {
    const token = authToken.value;
    if (!token)
        return;
    isBookingsLoading.value = true;
    bookingsError.value = null;
    const targetOffset = pageOffset !== undefined ? pageOffset : bookingsOffset.value;
    try {
        const params = new URLSearchParams();
        if (bookingStatusFilter.value && bookingStatusFilter.value !== 'all') {
            params.append('status', bookingStatusFilter.value);
        }
        if (bookingCategoryFilter.value && bookingCategoryFilter.value !== 'all') {
            params.append('category_id', bookingCategoryFilter.value);
        }
        if (bookingLocalityFilter.value && bookingLocalityFilter.value !== 'all') {
            params.append('area_locality', bookingLocalityFilter.value);
        }
        if (bookingProviderFilter.value && bookingProviderFilter.value !== 'all') {
            params.append('provider_id', bookingProviderFilter.value);
        }
        if (bookingSearchQuery.value.trim().length > 0) {
            params.append('search', bookingSearchQuery.value.trim());
        }
        const effectiveLimit = getEffectiveLimit();
        params.append('limit', String(effectiveLimit));
        params.append('offset', String(targetOffset));
        const res = await fetch(`/api/admin/bookings?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (res.status === 401) {
            handleSessionExpired();
            return;
        }
        if (!res.ok) {
            bookingsError.value = t('admin.load_bookings_error');
            return;
        }
        const body = await res.json();
        if (body.success && body.data) {
            bookingsList.value = body.data.bookings;
            bookingsTotal.value = body.data.total;
            bookingsLimit.value = body.data.limit;
            bookingsOffset.value = body.data.offset;
        }
        else {
            bookingsError.value = body.error?.messageEn || t('admin.load_bookings_error');
        }
    }
    catch {
        bookingsError.value = t('admin.load_bookings_error');
    }
    finally {
        isBookingsLoading.value = false;
    }
}
/**
 * Sets current pagination page.
 */
export function setBookingPage(page) {
    const total = totalPages.value;
    const safePage = Math.max(1, Math.min(page, total));
    const offset = (safePage - 1) * getEffectiveLimit();
    fetchAdminBookings(offset);
}
export function nextBookingPage() {
    if (hasNextPage.value) {
        setBookingPage(currentPage.value + 1);
    }
}
export function prevBookingPage() {
    if (hasPrevPage.value) {
        setBookingPage(currentPage.value - 1);
    }
}
/**
 * Resets all search and filter fields and fetches page 1.
 */
export function clearBookingFilters() {
    bookingSearchQuery.value = '';
    bookingStatusFilter.value = 'all';
    bookingCategoryFilter.value = 'all';
    bookingLocalityFilter.value = 'all';
    bookingProviderFilter.value = 'all';
    fetchAdminBookings(0);
}
/**
 * Opens detailed modal for a specific booking.
 */
export async function openBookingDetail(bookingId) {
    const token = authToken.value;
    if (!token)
        return;
    stopDetailAudio();
    isDetailModalOpen.value = true;
    selectedBookingDetail.value = null;
    detailError.value = null;
    isDetailLoading.value = true;
    try {
        const res = await fetch(`/api/admin/bookings/${bookingId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (res.status === 401) {
            handleSessionExpired();
            return;
        }
        if (!res.ok) {
            detailError.value = t('admin.load_detail_error');
            return;
        }
        const body = await res.json();
        if (body.success && body.data) {
            selectedBookingDetail.value = body.data;
        }
        else {
            detailError.value = body.error?.messageEn || t('admin.load_detail_error');
        }
    }
    catch {
        detailError.value = t('admin.load_detail_error');
    }
    finally {
        isDetailLoading.value = false;
    }
}
/**
 * Closes detailed modal.
 */
export function closeBookingDetail() {
    stopDetailAudio();
    isDetailModalOpen.value = false;
    selectedBookingDetail.value = null;
    detailError.value = null;
}
/**
 * Refreshes current booking detail silently without closing modal.
 */
export async function refreshSelectedBookingDetail() {
    const detail = selectedBookingDetail.value;
    if (!detail)
        return;
    const token = authToken.value;
    if (!token)
        return;
    try {
        const res = await fetch(`/api/admin/bookings/${detail.booking.id}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (res.ok) {
            const body = await res.json();
            if (body.success && body.data) {
                selectedBookingDetail.value = body.data;
            }
        }
    }
    catch {
        // Non-blocking background refresh
    }
}
/**
 * Opens cancellation modal for currently viewed booking.
 */
export function openCancelModal() {
    cancelReason.value = '';
    cancelReasonError.value = null;
    cancelError.value = null;
    isCancelModalOpen.value = true;
}
/**
 * Closes cancellation modal.
 */
export function closeCancelModal() {
    isCancelModalOpen.value = false;
    cancelReason.value = '';
    cancelReasonError.value = null;
    cancelError.value = null;
}
/**
 * Submits administrative booking cancellation.
 */
export async function submitCancelBooking() {
    const detail = selectedBookingDetail.value;
    if (!detail)
        return false;
    const validation = validateCancelReason(cancelReason.value);
    if (validation) {
        cancelReasonError.value = validation;
        return false;
    }
    const token = authToken.value;
    if (!token) {
        handleSessionExpired();
        return false;
    }
    isCancelling.value = true;
    cancelError.value = null;
    cancelReasonError.value = null;
    try {
        const res = await fetch(`/api/admin/bookings/${detail.booking.id}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                reason: cancelReason.value.trim(),
            }),
        });
        if (res.status === 401) {
            handleSessionExpired();
            return false;
        }
        const body = await res.json();
        if (!res.ok || !body.success) {
            if (res.status === 409) {
                cancelError.value = currentLanguage.value === 'hi'
                    ? (body.error?.messageHi || t('admin.cancel_conflict_error'))
                    : (body.error?.messageEn || t('admin.cancel_conflict_error'));
            }
            else {
                cancelError.value = currentLanguage.value === 'hi'
                    ? (body.error?.messageHi || t('admin.cancel_conflict_error'))
                    : (body.error?.messageEn || t('admin.cancel_conflict_error'));
            }
            return false;
        }
        // Success: update active booking detail status and refresh timeline
        if (selectedBookingDetail.value) {
            selectedBookingDetail.value = {
                ...selectedBookingDetail.value,
                booking: {
                    ...selectedBookingDetail.value.booking,
                    status: 'CANCELLED_BY_ADMIN',
                },
            };
        }
        const shortId = detail.booking.id.slice(0, 8);
        cancelSuccessMessage.value = t('admin.cancel_success', { id: `#${shortId}` });
        closeCancelModal();
        // Refresh detail and list
        await refreshSelectedBookingDetail();
        await fetchAdminBookings();
        return true;
    }
    catch {
        cancelError.value = t('admin.cancel_conflict_error');
        return false;
    }
    finally {
        isCancelling.value = false;
    }
}
export function clearCancelSuccessMessage() {
    cancelSuccessMessage.value = null;
}
