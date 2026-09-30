import {
  activeCategory,
  problemText,
  selectedLocality,
  landmarkText,
  audioDurationSeconds,
  audioPlaybackUrl,
  isPlayingAudio,
  isSubmittingBooking,
  bookingSubmitError,
  submitBooking,
  backToDetails,
  toggleAudioPlayback,
} from '../state/booking';
import { currentLanguage, t } from '../state/language';
import { CHANDIL_LOCALITIES } from '@shared';
import {
  CategoryIconRenderer,
  PlayIcon,
  PauseIcon,
  ArrowLeftIcon,
  AlertCircleIcon,
  SpinnerIcon,
  EditIcon,
} from './icons';

export function BookingReview() {
  const category = activeCategory.value;
  const lang = currentLanguage.value || 'en';

  if (!category) {
    return null;
  }

  const categoryTitle = lang === 'hi' ? category.titleHi : category.titleEn;
  const localityObj = CHANDIL_LOCALITIES.find((l) => l.id === selectedLocality.value);
  const localityName = localityObj ? (lang === 'hi' ? localityObj.nameHi : localityObj.nameEn) : selectedLocality.value;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    submitBooking();
  };

  return (
    <div class="min-h-screen flex flex-col bg-background">
      {/* Header Bar */}
      <header class="bg-brand text-white px-4 py-3 shadow-sm sticky top-0 z-10">
        <div class="max-w-md mx-auto flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <button
              onClick={() => backToDetails()}
              disabled={isSubmittingBooking.value}
              class="p-2 -ml-2 text-slate-200 hover:text-white rounded min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label={t('app.back')}
            >
              <ArrowLeftIcon size={20} />
            </button>
            <h1 class="text-base font-bold leading-tight">{t('booking.review_title')}</h1>
          </div>
        </div>
      </header>

      {/* Main Review Card */}
      <main class="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        {/* Error Alert Box (Preserves inputs & provides retry with same idempotency key) */}
        {bookingSubmitError.value && (
          <div class="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start space-x-2.5 text-danger text-sm shadow-sm">
            <AlertCircleIcon size={20} class="shrink-0 mt-0.5" />
            <div>
              <div class="font-bold">{t('booking.submit_failed')}</div>
              <div class="text-xs text-text-sub mt-0.5">{bookingSubmitError.value}</div>
            </div>
          </div>
        )}

        {/* Selected Service Card */}
        <section class="bg-surface border border-border rounded-lg p-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
                <CategoryIconRenderer iconName={category.iconName} size={26} />
              </div>
              <div>
                <h2 class="text-base font-bold text-text-main leading-tight">{categoryTitle}</h2>
                <div class="text-xs font-semibold text-action mt-0.5">
                  {t('home.visit_charge', { amount: category.baseVisitFee })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => backToDetails()}
              disabled={isSubmittingBooking.value}
              class="p-2 text-brand hover:text-brand-dark rounded min-h-[40px] min-w-[40px] flex items-center justify-center"
              title={t('booking.edit_details')}
              aria-label={t('booking.edit_details')}
            >
              <EditIcon size={18} />
            </button>
          </div>
        </section>

        {/* Problem Summary Card */}
        <section class="bg-surface border border-border rounded-lg p-4 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-text-sub uppercase tracking-wider">
              {t('booking.step1_title')}
            </h3>
            <button
              type="button"
              onClick={() => backToDetails()}
              disabled={isSubmittingBooking.value}
              class="text-xs text-brand font-semibold hover:underline"
            >
              {t('booking.edit_details')}
            </button>
          </div>

          {problemText.value.trim() && (
            <div class="bg-slate-50 border border-slate-200 rounded p-3 text-sm text-text-main leading-relaxed">
              {problemText.value.trim()}
            </div>
          )}

          {audioDurationSeconds.value > 0 && audioPlaybackUrl.value && (
            <div class="bg-slate-50 border border-slate-200 rounded p-3 flex items-center justify-between">
              <div class="text-xs">
                <span class="font-bold text-text-main">{t('booking.voice_note')}: </span>
                <span class="text-action-active font-semibold">{audioDurationSeconds.value}s</span>
              </div>
              <button
                type="button"
                onClick={() => toggleAudioPlayback()}
                class="px-3 py-1.5 bg-brand text-white rounded text-xs font-semibold flex items-center space-x-1 min-h-[36px]"
              >
                {isPlayingAudio.value ? (
                  <>
                    <PauseIcon size={14} />
                    <span>{t('booking.audio_stop')}</span>
                  </>
                ) : (
                  <>
                    <PlayIcon size={14} />
                    <span>{t('booking.audio_play')}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </section>

        {/* Location Summary Card */}
        <section class="bg-surface border border-border rounded-lg p-4 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-text-sub uppercase tracking-wider">
              {t('booking.step2_title')}
            </h3>
            <button
              type="button"
              onClick={() => backToDetails()}
              disabled={isSubmittingBooking.value}
              class="text-xs text-brand font-semibold hover:underline"
            >
              {t('booking.edit_details')}
            </button>
          </div>

          <div class="space-y-1.5 text-sm">
            <div class="flex items-start justify-between">
              <span class="text-text-sub text-xs">Locality / मोहल्ला:</span>
              <span class="font-bold text-text-main text-right">{localityName}</span>
            </div>

            {landmarkText.value.trim() && (
              <div class="flex items-start justify-between">
                <span class="text-text-sub text-xs">Landmark / पहचान:</span>
                <span class="font-medium text-text-main text-right">{landmarkText.value.trim()}</span>
              </div>
            )}
          </div>
        </section>

        {/* Payment Policy Notice Card */}
        <section class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs space-y-1 text-text-main leading-relaxed">
          <div class="font-bold text-amber-900">{t('booking.cash_on_completion')}</div>
          <p>{t('booking.cash_notice')}</p>
        </section>

        {/* Confirm / Submit CTA */}
        <div class="space-y-2 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmittingBooking.value}
            class={`w-full min-h-[50px] px-4 py-3 rounded-lg font-bold text-base transition-colors flex items-center justify-center space-x-2 shadow-sm ${
              isSubmittingBooking.value
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-action hover:bg-action-active text-white cursor-pointer'
            }`}
          >
            {isSubmittingBooking.value ? (
              <>
                <SpinnerIcon size={20} class="text-white" />
                <span>{t('booking.submitting')}</span>
              </>
            ) : (
              <span>{t('booking.confirm_cta')}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => backToDetails()}
            disabled={isSubmittingBooking.value}
            class="w-full min-h-[44px] text-xs font-semibold text-text-sub hover:text-text-main transition-colors"
          >
            {t('booking.edit_details')}
          </button>
        </div>
      </main>
    </div>
  );
}
