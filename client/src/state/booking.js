import { signal } from '@preact/signals';
import { authToken, handleSessionExpired } from './auth';
import { currentLanguage } from './language';
export const bookingStep = signal('home');
export const activeCategory = signal(null);
// Form Inputs
export const problemText = signal('');
export const selectedLocality = signal('chandil-bazar');
export const landmarkText = signal('');
// Audio Recording State
export const audioBlob = signal(null);
export const audioBase64 = signal(null);
export const audioDurationSeconds = signal(0);
export const audioPlaybackUrl = signal(null);
export const isRecording = signal(false);
export const recordingSeconds = signal(0);
export const recordingError = signal(null);
export const isPlayingAudio = signal(false);
// Submission & Idempotency State
export const currentIdempotencyKey = signal('');
export const isSubmittingBooking = signal(false);
export const bookingSubmitError = signal(null);
export const createdBooking = signal(null);
let mediaRecorder = null;
let recordingStream = null;
let recordingTimer = null;
let audioElement = null;
function generateIdempotencyKey() {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `book-${timestamp}-${randomPart}`;
}
export function startNewBookingFlow(category) {
    activeCategory.value = category;
    problemText.value = '';
    selectedLocality.value = 'chandil-bazar';
    landmarkText.value = '';
    deleteRecording();
    currentIdempotencyKey.value = generateIdempotencyKey();
    bookingSubmitError.value = null;
    createdBooking.value = null;
    bookingStep.value = 'details';
}
export function cancelBookingFlow() {
    deleteRecording();
    activeCategory.value = null;
    bookingSubmitError.value = null;
    bookingStep.value = 'home';
}
export function returnToHome() {
    cancelBookingFlow();
}
/**
 * Starts voice recording with 16kHz mono audio constraints.
 * Auto-stops at 30 seconds max duration.
 */
export async function startVoiceRecording() {
    recordingError.value = null;
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            recordingError.value = 'recording_failed';
            return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1, // Mono
                sampleRate: 16000, // 16 kHz
                echoCancellation: true,
                noiseSuppression: true,
            },
        });
        recordingStream = stream;
        // Determine optimal mimeType
        let mimeType = 'audio/webm;codecs=opus';
        if (typeof MediaRecorder.isTypeSupported === 'function') {
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                if (MediaRecorder.isTypeSupported('audio/webm')) {
                    mimeType = 'audio/webm';
                }
                else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                    mimeType = 'audio/ogg;codecs=opus';
                }
                else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    mimeType = 'audio/mp4';
                }
            }
        }
        const options = {
            mimeType,
            audioBitsPerSecond: 16000, // Target ~16 kbps
        };
        let recorder;
        try {
            recorder = new MediaRecorder(stream, options);
        }
        catch {
            // Fallback without options if browser rejects audioBitsPerSecond
            recorder = new MediaRecorder(stream);
        }
        mediaRecorder = recorder;
        const recordedChunks = [];
        recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        recorder.onstop = async () => {
            const finalBlob = new Blob(recordedChunks, { type: recorder.mimeType || 'audio/webm' });
            audioBlob.value = finalBlob;
            audioDurationSeconds.value = recordingSeconds.value;
            // Create playback URL
            if (audioPlaybackUrl.value) {
                URL.revokeObjectURL(audioPlaybackUrl.value);
            }
            audioPlaybackUrl.value = URL.createObjectURL(finalBlob);
            // Convert to Base64 for submission
            const reader = new FileReader();
            reader.onloadend = () => {
                audioBase64.value = reader.result;
            };
            reader.readAsDataURL(finalBlob);
            // Release mic stream
            if (recordingStream) {
                recordingStream.getTracks().forEach((track) => track.stop());
                recordingStream = null;
            }
        };
        recorder.start(250); // Collect in 250ms chunks
        isRecording.value = true;
        recordingSeconds.value = 0;
        // Start 30s timer
        recordingTimer = window.setInterval(() => {
            recordingSeconds.value += 1;
            if (recordingSeconds.value >= 30) {
                stopVoiceRecording();
            }
        }, 1000);
    }
    catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            recordingError.value = 'mic_denied';
        }
        else {
            recordingError.value = 'recording_failed';
        }
        if (recordingStream) {
            recordingStream.getTracks().forEach((track) => track.stop());
            recordingStream = null;
        }
        isRecording.value = false;
    }
}
export function stopVoiceRecording() {
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
            mediaRecorder.stop();
        }
        catch {
            // Ignore recorder stop error
        }
    }
    isRecording.value = false;
}
export function deleteRecording() {
    stopVoiceRecording();
    if (audioElement) {
        audioElement.pause();
        audioElement = null;
    }
    isPlayingAudio.value = false;
    if (audioPlaybackUrl.value) {
        URL.revokeObjectURL(audioPlaybackUrl.value);
    }
    audioPlaybackUrl.value = null;
    audioBlob.value = null;
    audioBase64.value = null;
    audioDurationSeconds.value = 0;
    recordingSeconds.value = 0;
    recordingError.value = null;
}
export function toggleAudioPlayback() {
    if (!audioPlaybackUrl.value)
        return;
    if (isPlayingAudio.value && audioElement) {
        audioElement.pause();
        isPlayingAudio.value = false;
        return;
    }
    if (!audioElement) {
        audioElement = new Audio(audioPlaybackUrl.value);
        audioElement.onended = () => {
            isPlayingAudio.value = false;
        };
        audioElement.onerror = () => {
            isPlayingAudio.value = false;
        };
    }
    audioElement.play().then(() => {
        isPlayingAudio.value = true;
    }).catch(() => {
        isPlayingAudio.value = false;
    });
}
/**
 * Validates details step and transitions to review screen.
 */
export function proceedToReview() {
    bookingSubmitError.value = null;
    const hasText = problemText.value.trim().length >= 3;
    const hasAudio = audioDurationSeconds.value > 0 && audioBase64.value !== null;
    if (!hasText && !hasAudio) {
        bookingSubmitError.value = currentLanguage.value === 'hi'
            ? 'कृपया समस्या लिखकर बताएं या आवाज़ में रिकॉर्ड करें।'
            : 'Please describe the problem or record a voice note.';
        return false;
    }
    if (!selectedLocality.value) {
        bookingSubmitError.value = currentLanguage.value === 'hi'
            ? 'कृपया अपना इलाका चुनें।'
            : 'Please select your locality.';
        return false;
    }
    if (selectedLocality.value === 'other' && landmarkText.value.trim().length < 3) {
        bookingSubmitError.value = currentLanguage.value === 'hi'
            ? 'अन्य क्षेत्र चुनने पर लैंडमार्क या घर का विवरण आवश्यक है।'
            : 'Landmark or house details are required when selecting Other Area.';
        return false;
    }
    bookingStep.value = 'review';
    return true;
}
export function backToDetails() {
    bookingSubmitError.value = null;
    bookingStep.value = 'details';
}
/**
 * Submits the booking request to the backend with idempotency enforcement.
 * Shows confirmation ONLY after backend returns HTTP 201 (or safe 200 replay).
 */
export async function submitBooking() {
    const token = authToken.value;
    const category = activeCategory.value;
    if (!token || !category) {
        handleSessionExpired();
        return false;
    }
    // Double-tap prevention
    if (isSubmittingBooking.value) {
        return false;
    }
    isSubmittingBooking.value = true;
    bookingSubmitError.value = null;
    try {
        const payload = {
            idempotencyKey: currentIdempotencyKey.value,
            categoryId: category.id,
            areaLocality: selectedLocality.value,
            landmark: landmarkText.value.trim() || undefined,
            textDescription: problemText.value.trim() || undefined,
            audioBase64: audioBase64.value || undefined,
            audioDurationSeconds: audioDurationSeconds.value > 0 ? audioDurationSeconds.value : undefined,
        };
        const res = await fetch('/api/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        if (res.status === 401) {
            handleSessionExpired();
            return false;
        }
        const body = await res.json();
        if ((res.status !== 201 && res.status !== 200) || !body.success || !body.data) {
            bookingSubmitError.value = currentLanguage.value === 'hi'
                ? (body.error?.messageHi || 'बुकिंग पूरी नहीं हो सकी। कृपया दोबारा प्रयास करें।')
                : (body.error?.messageEn || 'Unable to confirm booking. Please retry.');
            return false;
        }
        // Backend confirmed booking creation
        createdBooking.value = body.data;
        bookingStep.value = 'confirmed';
        return true;
    }
    catch {
        bookingSubmitError.value = currentLanguage.value === 'hi'
            ? 'बुकिंग पूरी नहीं हो सकी। नेटवर्क कमजोर है।'
            : 'Unable to confirm booking. Network is weak.';
        return false;
    }
    finally {
        isSubmittingBooking.value = false;
    }
}
// ==========================================
// MODULE 6: BOOKING HISTORY & STATUS DETAIL
// ==========================================
export const bookingHistory = signal([]);
export const isHistoryLoading = signal(false);
export const historyError = signal(null);
export const selectedBookingId = signal(null);
export const activeBookingDetail = signal(null);
export const isDetailLoading = signal(false);
export const detailError = signal(null);
export const isPlayingDetailAudio = signal(false);
export const detailAudioError = signal(false);
let detailAudioElement = null;
export function stopDetailAudio() {
    if (detailAudioElement) {
        detailAudioElement.pause();
        detailAudioElement = null;
    }
    isPlayingDetailAudio.value = false;
}
export function toggleDetailAudio(audioUrl) {
    detailAudioError.value = false;
    if (isPlayingDetailAudio.value && detailAudioElement) {
        detailAudioElement.pause();
        isPlayingDetailAudio.value = false;
        return;
    }
    stopDetailAudio();
    try {
        const audio = new Audio(audioUrl);
        detailAudioElement = audio;
        audio.onended = () => {
            isPlayingDetailAudio.value = false;
        };
        audio.onerror = () => {
            isPlayingDetailAudio.value = false;
            detailAudioError.value = true;
        };
        audio.play().then(() => {
            isPlayingDetailAudio.value = true;
        }).catch(() => {
            isPlayingDetailAudio.value = false;
            detailAudioError.value = true;
        });
    }
    catch {
        isPlayingDetailAudio.value = false;
        detailAudioError.value = true;
    }
}
export async function fetchBookingHistory(force = false) {
    const token = authToken.value;
    if (!token) {
        handleSessionExpired();
        return;
    }
    isHistoryLoading.value = true;
    historyError.value = null;
    try {
        const res = await fetch('/api/bookings', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (res.status === 401) {
            handleSessionExpired();
            return;
        }
        if (!res.ok) {
            historyError.value = currentLanguage.value === 'hi'
                ? 'बुकिंग लोड करने में समस्या हुई। कृपया पुनः प्रयास करें।'
                : 'Unable to load bookings. Please retry.';
            return;
        }
        const body = await res.json();
        if (body.success && Array.isArray(body.data)) {
            bookingHistory.value = body.data;
        }
        else {
            historyError.value = currentLanguage.value === 'hi'
                ? (body.error?.messageHi || 'बुकिंग लोड करने में असमर्थ।')
                : (body.error?.messageEn || 'Unable to load bookings.');
        }
    }
    catch {
        historyError.value = currentLanguage.value === 'hi'
            ? 'नेटवर्क समस्या। कृपया कनेक्शन जांचें।'
            : 'Network error. Please check connection.';
    }
    finally {
        isHistoryLoading.value = false;
    }
}
export async function fetchBookingDetail(id) {
    const token = authToken.value;
    if (!token) {
        handleSessionExpired();
        return;
    }
    isDetailLoading.value = true;
    detailError.value = null;
    stopDetailAudio();
    try {
        const res = await fetch(`/api/bookings/${id}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (res.status === 401) {
            handleSessionExpired();
            return;
        }
        if (res.status === 404) {
            detailError.value = currentLanguage.value === 'hi'
                ? 'बुकिंग नहीं मिली।'
                : 'Booking not found.';
            return;
        }
        if (res.status === 403) {
            detailError.value = currentLanguage.value === 'hi'
                ? 'इस बुकिंग को देखने की अनुमति नहीं है।'
                : 'Access denied to this booking.';
            return;
        }
        if (!res.ok) {
            detailError.value = currentLanguage.value === 'hi'
                ? 'विवरण लोड करने में समस्या हुई।'
                : 'Unable to load booking details.';
            return;
        }
        const body = await res.json();
        if (body.success && body.data) {
            activeBookingDetail.value = body.data;
        }
        else {
            detailError.value = currentLanguage.value === 'hi'
                ? (body.error?.messageHi || 'विवरण लोड करने में असमर्थ।')
                : (body.error?.messageEn || 'Unable to load booking details.');
        }
    }
    catch {
        detailError.value = currentLanguage.value === 'hi'
            ? 'नेटवर्क समस्या। कृपया पुनः प्रयास करें।'
            : 'Network error. Please retry.';
    }
    finally {
        isDetailLoading.value = false;
    }
}
export function openBookingHistory() {
    stopDetailAudio();
    bookingStep.value = 'history';
    fetchBookingHistory();
}
export function openBookingDetail(id) {
    stopDetailAudio();
    closeCancelDialog();
    clearCancelSuccessMessage();
    selectedBookingId.value = id;
    activeBookingDetail.value = null;
    bookingStep.value = 'status';
    fetchBookingDetail(id);
}
export function refreshCurrentBooking() {
    if (selectedBookingId.value) {
        fetchBookingDetail(selectedBookingId.value);
    }
}
export function closeBookingDetail() {
    stopDetailAudio();
    closeCancelDialog();
    clearCancelSuccessMessage();
    bookingStep.value = 'history';
}
// ==========================================
// MODULE 13: CUSTOMER BOOKING CANCELLATION
// ==========================================
export const isCancelDialogOpen = signal(false);
export const cancelReason = signal('');
export const cancelReasonError = signal(null);
export const isCancelling = signal(false);
export const cancelError = signal(null);
export const cancelSuccessMessage = signal(null);
/**
 * Determines whether a booking can be cancelled by the customer.
 * Permitted ONLY for:
 *   - SERVICE_REQUESTED
 *   - PROVIDER_ASSIGNED
 *   - PROVIDER_ACCEPTED
 * strictly disallowing any in-progress, completed, or terminal statuses.
 */
export function canCancelBooking(status) {
    return (status === 'SERVICE_REQUESTED' ||
        status === 'PROVIDER_ASSIGNED' ||
        status === 'PROVIDER_ACCEPTED');
}
export function openCancelDialog() {
    cancelReason.value = '';
    cancelReasonError.value = null;
    cancelError.value = null;
    cancelSuccessMessage.value = null;
    isCancelDialogOpen.value = true;
}
export function closeCancelDialog() {
    if (isCancelling.value)
        return; // Prevent dismissing while request is in-flight
    isCancelDialogOpen.value = false;
    cancelReason.value = '';
    cancelReasonError.value = null;
    cancelError.value = null;
}
export function clearCancelSuccessMessage() {
    cancelSuccessMessage.value = null;
}
export function setCancelReason(val) {
    cancelReason.value = val;
    if (val.length > 255) {
        cancelReasonError.value = currentLanguage.value === 'hi'
            ? 'रद्दीकरण का कारण 255 अक्षरों से अधिक नहीं होना चाहिए।'
            : 'Reason must not exceed 255 characters.';
    }
    else {
        cancelReasonError.value = null;
    }
}
export function validateCancelReason(val) {
    if (val.length > 255) {
        cancelReasonError.value = currentLanguage.value === 'hi'
            ? 'रद्दीकरण का कारण 255 अक्षरों से अधिक नहीं होना चाहिए।'
            : 'Reason must not exceed 255 characters.';
        return false;
    }
    cancelReasonError.value = null;
    return true;
}
export async function submitCancelBooking() {
    const booking = activeBookingDetail.value;
    if (!booking)
        return false;
    // Double-submission protection
    if (isCancelling.value)
        return false;
    const token = authToken.value;
    if (!token) {
        handleSessionExpired();
        return false;
    }
    // Reason length validation
    if (!validateCancelReason(cancelReason.value)) {
        return false;
    }
    const trimmed = cancelReason.value.trim();
    const payload = trimmed.length > 0 ? { reason: trimmed } : {};
    isCancelling.value = true;
    cancelError.value = null;
    try {
        const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        if (res.status === 401) {
            handleSessionExpired();
            return false;
        }
        if (res.status === 409) {
            // Status race condition: booking progressed or was already cancelled
            // Re-fetch latest booking from server to update UI authoritative state
            await fetchBookingDetail(booking.id);
            cancelError.value = currentLanguage.value === 'hi'
                ? 'यह बुकिंग अब रद्द नहीं की जा सकती। स्थिति बदल गई है।'
                : 'This booking can no longer be cancelled. Status has changed.';
            return false;
        }
        if (res.status === 403) {
            cancelError.value = currentLanguage.value === 'hi'
                ? 'इस बुकिंग को रद्द करने की अनुमति नहीं है।'
                : 'Access denied to cancel this booking.';
            return false;
        }
        if (res.status === 404) {
            cancelError.value = currentLanguage.value === 'hi'
                ? 'बुकिंग नहीं मिली।'
                : 'Booking not found.';
            return false;
        }
        if (res.status === 400) {
            const errBody = await res.json().catch(() => ({ success: false }));
            cancelError.value = currentLanguage.value === 'hi'
                ? (errBody.error?.messageHi || 'रद्दीकरण का कारण अमान्य है।')
                : (errBody.error?.messageEn || 'Invalid cancellation request.');
            return false;
        }
        if (!res.ok) {
            cancelError.value = currentLanguage.value === 'hi'
                ? 'बुकिंग रद्द करने में समस्या हुई। कृपया पुनः प्रयास करें।'
                : 'Failed to cancel booking. Please retry.';
            return false;
        }
        const body = await res.json();
        if (!body.success || !body.data) {
            cancelError.value = currentLanguage.value === 'hi'
                ? (body.error?.messageHi || 'बुकिंग रद्द करने में असमर्थ।')
                : (body.error?.messageEn || 'Unable to cancel booking.');
            return false;
        }
        const updatedBooking = body.data;
        // Update active booking detail
        if (activeBookingDetail.value && activeBookingDetail.value.id === updatedBooking.id) {
            activeBookingDetail.value = {
                ...activeBookingDetail.value,
                ...updatedBooking,
            };
        }
        // Reconcile booking history list if loaded
        bookingHistory.value = bookingHistory.value.map((b) => b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b);
        // Close modal & set success message
        isCancelDialogOpen.value = false;
        cancelReason.value = '';
        cancelReasonError.value = null;
        cancelSuccessMessage.value = currentLanguage.value === 'hi'
            ? 'बुकिंग सफलतापूर्वक रद्द कर दी गई।'
            : 'Booking cancelled successfully.';
        // Fetch full detail in background to populate latest audit log in statusLogs
        fetchBookingDetail(booking.id).catch(() => { });
        return true;
    }
    catch {
        cancelError.value = currentLanguage.value === 'hi'
            ? 'नेटवर्क समस्या। कृपया पुनः प्रयास करें।'
            : 'Network error. Please retry.';
        return false;
    }
    finally {
        isCancelling.value = false;
    }
}
