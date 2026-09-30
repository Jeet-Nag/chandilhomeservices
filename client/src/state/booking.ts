import { signal, computed } from '@preact/signals';
import { Booking, BookingDetail, ServiceCategory, ApiResponse } from '@shared';
import { authToken, handleSessionExpired } from './auth';
import { currentLanguage } from './language';

export type BookingStep = 'home' | 'details' | 'review' | 'confirmed' | 'history' | 'status';

export const bookingStep = signal<BookingStep>('home');
export const activeCategory = signal<ServiceCategory | null>(null);

// Form Inputs
export const problemText = signal<string>('');
export const selectedLocality = signal<string>('chandil-bazar');
export const landmarkText = signal<string>('');

// Audio Recording State
export const audioBlob = signal<Blob | null>(null);
export const audioBase64 = signal<string | null>(null);
export const audioDurationSeconds = signal<number>(0);
export const audioPlaybackUrl = signal<string | null>(null);
export const isRecording = signal<boolean>(false);
export const recordingSeconds = signal<number>(0);
export const recordingError = signal<'mic_denied' | 'recording_failed' | null>(null);
export const isPlayingAudio = signal<boolean>(false);

// Submission & Idempotency State
export const currentIdempotencyKey = signal<string>('');
export const isSubmittingBooking = signal<boolean>(false);
export const bookingSubmitError = signal<string | null>(null);
export const createdBooking = signal<Booking | null>(null);

let mediaRecorder: MediaRecorder | null = null;
let recordingStream: MediaStream | null = null;
let recordingTimer: number | null = null;
let audioElement: HTMLAudioElement | null = null;

function generateIdempotencyKey(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `book-${timestamp}-${randomPart}`;
}

export function startNewBookingFlow(category: ServiceCategory): void {
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

export function cancelBookingFlow(): void {
  deleteRecording();
  activeCategory.value = null;
  bookingSubmitError.value = null;
  bookingStep.value = 'home';
}

export function returnToHome(): void {
  cancelBookingFlow();
}

/**
 * Starts voice recording with 16kHz mono audio constraints.
 * Auto-stops at 30 seconds max duration.
 */
export async function startVoiceRecording(): Promise<void> {
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
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }
    }

    const options: MediaRecorderOptions = {
      mimeType,
      audioBitsPerSecond: 16000, // Target ~16 kbps
    };

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch {
      // Fallback without options if browser rejects audioBitsPerSecond
      recorder = new MediaRecorder(stream);
    }

    mediaRecorder = recorder;
    const recordedChunks: Blob[] = [];

    recorder.ondataavailable = (event: BlobEvent) => {
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
        audioBase64.value = reader.result as string;
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
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      recordingError.value = 'mic_denied';
    } else {
      recordingError.value = 'recording_failed';
    }
    if (recordingStream) {
      recordingStream.getTracks().forEach((track) => track.stop());
      recordingStream = null;
    }
    isRecording.value = false;
  }
}

export function stopVoiceRecording(): void {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch {
      // Ignore recorder stop error
    }
  }

  isRecording.value = false;
}

export function deleteRecording(): void {
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

export function toggleAudioPlayback(): void {
  if (!audioPlaybackUrl.value) return;

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
export function proceedToReview(): boolean {
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

export function backToDetails(): void {
  bookingSubmitError.value = null;
  bookingStep.value = 'details';
}

/**
 * Submits the booking request to the backend with idempotency enforcement.
 * Shows confirmation ONLY after backend returns HTTP 201 (or safe 200 replay).
 */
export async function submitBooking(): Promise<boolean> {
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

    const body: ApiResponse<Booking> = await res.json();

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
  } catch {
    bookingSubmitError.value = currentLanguage.value === 'hi'
      ? 'बुकिंग पूरी नहीं हो सकी। नेटवर्क कमजोर है।'
      : 'Unable to confirm booking. Network is weak.';
    return false;
  } finally {
    isSubmittingBooking.value = false;
  }
}

// ==========================================
// MODULE 6: BOOKING HISTORY & STATUS DETAIL
// ==========================================

export const bookingHistory = signal<Booking[]>([]);
export const isHistoryLoading = signal<boolean>(false);
export const historyError = signal<string | null>(null);

export const selectedBookingId = signal<string | null>(null);
export const activeBookingDetail = signal<BookingDetail | null>(null);
export const isDetailLoading = signal<boolean>(false);
export const detailError = signal<string | null>(null);
export const isPlayingDetailAudio = signal<boolean>(false);
export const detailAudioError = signal<boolean>(false);

let detailAudioElement: HTMLAudioElement | null = null;

export function stopDetailAudio(): void {
  if (detailAudioElement) {
    detailAudioElement.pause();
    detailAudioElement = null;
  }
  isPlayingDetailAudio.value = false;
}

export function toggleDetailAudio(audioUrl: string): void {
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
  } catch {
    isPlayingDetailAudio.value = false;
    detailAudioError.value = true;
  }
}

export async function fetchBookingHistory(force = false): Promise<void> {
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

    const body: ApiResponse<Booking[]> = await res.json();
    if (body.success && Array.isArray(body.data)) {
      bookingHistory.value = body.data;
    } else {
      historyError.value = currentLanguage.value === 'hi'
        ? (body.error?.messageHi || 'बुकिंग लोड करने में असमर्थ।')
        : (body.error?.messageEn || 'Unable to load bookings.');
    }
  } catch {
    historyError.value = currentLanguage.value === 'hi'
      ? 'नेटवर्क समस्या। कृपया कनेक्शन जांचें।'
      : 'Network error. Please check connection.';
  } finally {
    isHistoryLoading.value = false;
  }
}

export async function fetchBookingDetail(id: string): Promise<void> {
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

    const body: ApiResponse<BookingDetail> = await res.json();
    if (body.success && body.data) {
      activeBookingDetail.value = body.data;
    } else {
      detailError.value = currentLanguage.value === 'hi'
        ? (body.error?.messageHi || 'विवरण लोड करने में असमर्थ।')
        : (body.error?.messageEn || 'Unable to load booking details.');
    }
  } catch {
    detailError.value = currentLanguage.value === 'hi'
      ? 'नेटवर्क समस्या। कृपया पुनः प्रयास करें।'
      : 'Network error. Please retry.';
  } finally {
    isDetailLoading.value = false;
  }
}

export function openBookingHistory(): void {
  stopDetailAudio();
  bookingStep.value = 'history';
  fetchBookingHistory();
}

export function openBookingDetail(id: string): void {
  stopDetailAudio();
  selectedBookingId.value = id;
  activeBookingDetail.value = null;
  bookingStep.value = 'status';
  fetchBookingDetail(id);
}

export function refreshCurrentBooking(): void {
  if (selectedBookingId.value) {
    fetchBookingDetail(selectedBookingId.value);
  }
}

export function closeBookingDetail(): void {
  stopDetailAudio();
  bookingStep.value = 'history';
}

