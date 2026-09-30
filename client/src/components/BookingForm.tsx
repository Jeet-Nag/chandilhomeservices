import {
  activeCategory,
  problemText,
  selectedLocality,
  landmarkText,
  audioDurationSeconds,
  audioPlaybackUrl,
  isRecording,
  recordingSeconds,
  recordingError,
  isPlayingAudio,
  bookingSubmitError,
  startVoiceRecording,
  stopVoiceRecording,
  deleteRecording,
  toggleAudioPlayback,
  proceedToReview,
  cancelBookingFlow,
} from '../state/booking';
import { currentLanguage, t } from '../state/language';
import { CHANDIL_LOCALITIES } from '@shared';
import {
  CategoryIconRenderer,
  MicIcon,
  StopIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  ArrowLeftIcon,
  AlertCircleIcon,
} from './icons';

export function BookingForm() {
  const category = activeCategory.value;
  const lang = currentLanguage.value || 'en';

  if (!category) {
    return null;
  }

  const categoryTitle = lang === 'hi' ? category.titleHi : category.titleEn;

  const handleReviewClick = (e: Event) => {
    e.preventDefault();
    proceedToReview();
  };

  return (
    <div class="min-h-screen flex flex-col bg-background">
      {/* Top Navigation Bar */}
      <header class="bg-brand text-white px-4 py-3 shadow-sm sticky top-0 z-10">
        <div class="max-w-md mx-auto flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <button
              onClick={() => cancelBookingFlow()}
              class="p-2 -ml-2 text-slate-200 hover:text-white rounded min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label={t('app.back')}
            >
              <ArrowLeftIcon size={20} />
            </button>
            <div>
              <h1 class="text-base font-bold leading-tight truncate">{categoryTitle}</h1>
              <p class="text-xs text-slate-300 leading-tight">
                {t('home.visit_charge', { amount: category.baseVisitFee })}
              </p>
            </div>
          </div>

          <div class="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
            <CategoryIconRenderer iconName={category.iconName} size={22} />
          </div>
        </div>
      </header>

      {/* Main Booking Form */}
      <main class="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        {/* Error Alert Banner */}
        {bookingSubmitError.value && (
          <div class="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start space-x-2.5 text-danger text-sm">
            <AlertCircleIcon size={20} class="shrink-0 mt-0.5" />
            <span class="leading-snug">{bookingSubmitError.value}</span>
          </div>
        )}

        {/* STEP 1: Problem Description & Audio */}
        <section class="bg-surface border border-border rounded-lg p-4 shadow-sm space-y-3.5">
          <h2 class="text-sm font-bold text-text-main uppercase tracking-wide">
            {t('booking.step1_title')}
          </h2>

          {/* Voice Note Module */}
          <div class="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-text-main">
                {t('booking.voice_note')}
              </span>
              <span class="text-[11px] text-text-sub">
                {lang === 'hi' ? 'वैकल्पिक (30 सेकंड)' : 'Optional (30s max)'}
              </span>
            </div>

            {/* Permission Denied Notice */}
            {recordingError.value === 'mic_denied' && (
              <div class="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-warning leading-snug">
                {t('booking.mic_denied')}
              </div>
            )}

            {/* State A: Before Recording */}
            {!isRecording.value && audioDurationSeconds.value === 0 && (
              <button
                type="button"
                onClick={() => startVoiceRecording()}
                class="w-full min-h-[48px] px-4 py-2.5 bg-white border-2 border-slate-300 hover:border-brand rounded-lg flex items-center justify-center space-x-2 text-brand font-semibold text-sm transition-colors"
              >
                <MicIcon size={20} class="text-brand" />
                <span>{t('booking.mic_tap_to_record')}</span>
              </button>
            )}

            {/* State B: During Active Recording */}
            {isRecording.value && (
              <div class="space-y-2">
                <div class="flex items-center justify-between px-2 text-xs font-semibold text-danger">
                  <div class="flex items-center space-x-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-danger animate-pulse"></span>
                    <span>{t('booking.mic_recording', { seconds: recordingSeconds.value })}</span>
                  </div>
                  <span>{30 - recordingSeconds.value}s remaining</span>
                </div>

                <button
                  type="button"
                  onClick={() => stopVoiceRecording()}
                  class="w-full min-h-[48px] px-4 py-2.5 bg-danger hover:bg-red-700 text-white font-bold rounded-lg flex items-center justify-center space-x-2 text-sm transition-colors"
                >
                  <StopIcon size={18} />
                  <span>{t('booking.audio_stop')}</span>
                </button>
              </div>
            )}

            {/* State C: Recording Completed */}
            {!isRecording.value && audioDurationSeconds.value > 0 && audioPlaybackUrl.value && (
              <div class="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold text-action-active">
                    {t('booking.mic_recorded', { seconds: audioDurationSeconds.value })}
                  </span>
                  <span class="text-text-sub font-mono">{audioDurationSeconds.value}s</span>
                </div>

                <div class="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => toggleAudioPlayback()}
                    class="flex-1 min-h-[44px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-text-main font-semibold text-xs rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    {isPlayingAudio.value ? (
                      <>
                        <PauseIcon size={16} />
                        <span>{t('booking.audio_stop')}</span>
                      </>
                    ) : (
                      <>
                        <PlayIcon size={16} />
                        <span>{t('booking.audio_play')}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteRecording()}
                    class="min-h-[44px] px-3 py-2 border border-slate-300 hover:border-danger hover:text-danger text-text-sub rounded-lg flex items-center justify-center transition-colors"
                    title={t('booking.audio_delete')}
                    aria-label={t('booking.audio_delete')}
                  >
                    <TrashIcon size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Written Description */}
          <div>
            <label for="problem-text" class="block text-xs font-semibold text-text-main mb-1.5">
              {t('booking.text_desc_label')}
            </label>
            <textarea
              id="problem-text"
              rows={3}
              maxLength={500}
              placeholder={t('booking.text_desc_placeholder')}
              value={problemText.value}
              onInput={(e) => {
                problemText.value = (e.target as HTMLTextAreaElement).value;
                bookingSubmitError.value = null;
              }}
              class="w-full p-3 border-2 border-border rounded-lg text-sm text-text-main bg-white focus:outline-none focus:border-brand min-h-[80px]"
            />
            <div class="text-right text-[11px] text-text-sub mt-1">
              {problemText.value.length}/500
            </div>
          </div>
        </section>

        {/* STEP 2: Location Details */}
        <section class="bg-surface border border-border rounded-lg p-4 shadow-sm space-y-3.5">
          <h2 class="text-sm font-bold text-text-main uppercase tracking-wide">
            {t('booking.step2_title')}
          </h2>

          {/* Locality Selector */}
          <div>
            <label for="locality-select" class="block text-xs font-semibold text-text-main mb-1.5">
              {t('booking.select_locality')}
            </label>
            <select
              id="locality-select"
              value={selectedLocality.value}
              onChange={(e) => {
                selectedLocality.value = (e.target as HTMLSelectElement).value;
                bookingSubmitError.value = null;
              }}
              class="w-full px-3 py-3 border-2 border-border rounded-lg text-sm font-semibold text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]"
            >
              {CHANDIL_LOCALITIES.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {lang === 'hi' ? loc.nameHi : loc.nameEn} ({loc.pincode})
                </option>
              ))}
            </select>
          </div>

          {/* Landmark Text Field */}
          <div>
            <label for="landmark-input" class="block text-xs font-semibold text-text-main mb-1.5">
              {t('booking.landmark_label')}
              {selectedLocality.value === 'other' && (
                <span class="text-danger ml-1">*</span>
              )}
            </label>
            <input
              id="landmark-input"
              type="text"
              maxLength={255}
              placeholder={t('booking.landmark_placeholder')}
              value={landmarkText.value}
              onInput={(e) => {
                landmarkText.value = (e.target as HTMLInputElement).value;
                bookingSubmitError.value = null;
              }}
              class="w-full px-3 py-3 border-2 border-border rounded-lg text-sm text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]"
            />
          </div>
        </section>

        {/* Review & Continue Button */}
        <div class="pt-2">
          <button
            type="button"
            onClick={handleReviewClick}
            class="w-full min-h-[48px] px-4 py-3 bg-action hover:bg-action-active text-white font-bold rounded-lg text-base shadow-sm transition-colors flex items-center justify-center"
          >
            <span>{t('booking.review_title')} →</span>
          </button>
        </div>
      </main>
    </div>
  );
}
