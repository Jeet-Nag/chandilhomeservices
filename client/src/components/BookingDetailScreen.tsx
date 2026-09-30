import { useEffect } from 'preact/hooks';
import {
  activeBookingDetail,
  isDetailLoading,
  detailError,
  refreshCurrentBooking,
  closeBookingDetail,
  toggleDetailAudio,
  stopDetailAudio,
  isPlayingDetailAudio,
  detailAudioError,
} from '../state/booking';
import { categories, fetchCategories } from '../state/categories';
import { currentLanguage, t } from '../state/language';
import { CHANDIL_LOCALITIES, BookingStatus, BookingStatusLog } from '@shared';
import {
  ArrowLeftIcon,
  RefreshIcon,
  SpinnerIcon,
  AlertCircleIcon,
  CheckIcon,
  PlayIcon,
  PauseIcon,
  MicIcon,
  CategoryIconRenderer,
  FileTextIcon,
  ClockIcon,
} from './icons';

function getStatusBadgeStyle(status: BookingStatus): { bg: string; text: string; dot: string } {
  switch (status) {
    case 'BOOKING_COMPLETED':
    case 'PAYMENT_COLLECTED':
    case 'SERVICE_COMPLETED':
      return { bg: 'bg-green-50 border-green-200', text: 'text-action-active', dot: 'bg-action' };
    case 'CANCELLED_BY_CUSTOMER':
    case 'CANCELLED_BY_ADMIN':
    case 'REJECTED_BY_PROVIDER':
      return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-600' };
    case 'PROVIDER_ON_THE_WAY':
    case 'SERVICE_STARTED':
    case 'PAYMENT_PENDING':
      return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500' };
    case 'SERVICE_REQUESTED':
    case 'PROVIDER_ASSIGNED':
    case 'PROVIDER_ACCEPTED':
    default:
      return { bg: 'bg-blue-50 border-blue-200', text: 'text-brand', dot: 'bg-brand' };
  }
}

function formatDateTime(isoString: string, lang: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
    return d.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

interface TimelineStage {
  status: BookingStatus;
  labelKey: string;
}

const ORDERED_STAGES: TimelineStage[] = [
  { status: 'SERVICE_REQUESTED', labelKey: 'status.service_requested' },
  { status: 'PROVIDER_ASSIGNED', labelKey: 'status.provider_assigned' },
  { status: 'PROVIDER_ACCEPTED', labelKey: 'status.provider_accepted' },
  { status: 'PROVIDER_ON_THE_WAY', labelKey: 'status.provider_on_the_way' },
  { status: 'SERVICE_STARTED', labelKey: 'status.service_started' },
  { status: 'SERVICE_COMPLETED', labelKey: 'status.service_completed' },
  { status: 'PAYMENT_PENDING', labelKey: 'status.payment_pending' },
  { status: 'PAYMENT_COLLECTED', labelKey: 'status.payment_collected' },
  { status: 'BOOKING_COMPLETED', labelKey: 'status.booking_completed' },
];

export function BookingDetailScreen() {
  const lang = currentLanguage.value || 'en';
  const booking = activeBookingDetail.value;
  const isLoading = isDetailLoading.value;
  const error = detailError.value;
  const isPlaying = isPlayingDetailAudio.value;
  const audioError = detailAudioError.value;

  useEffect(() => {
    if (categories.value.length === 0) {
      fetchCategories();
    }
    return () => {
      stopDetailAudio();
    };
  }, []);

  const category = booking ? categories.value.find((c) => c.id === booking.categoryId) : null;
  const categoryTitle = category
    ? (lang === 'hi' ? category.titleHi : category.titleEn)
    : (booking?.categoryId || '');

  const localityObj = booking ? CHANDIL_LOCALITIES.find((l) => l.id === booking.areaLocality) : null;
  const localityName = localityObj
    ? (lang === 'hi' ? localityObj.nameHi : localityObj.nameEn)
    : (booking?.areaLocality || '');

  const shortId = booking ? `#CHS-${booking.id.substring(0, 8).toUpperCase()}` : '';
  const statusKey = booking ? `status.${booking.status.toLowerCase()}` as any : '';
  const badgeStyle = booking ? getStatusBadgeStyle(booking.status) : null;

  const isExceptionalStatus =
    booking?.status === 'CANCELLED_BY_CUSTOMER' ||
    booking?.status === 'CANCELLED_BY_ADMIN' ||
    booking?.status === 'REJECTED_BY_PROVIDER';

  // Build status lookup from server logs
  const logsByStatus = new Map<BookingStatus, BookingStatusLog>();
  if (booking?.statusLogs) {
    for (const log of booking.statusLogs) {
      logsByStatus.set(log.toStatus, log);
    }
  }

  // Determine stage progression index based on the highest completed stage
  const currentStatusIndex = booking
    ? ORDERED_STAGES.findIndex((s) => s.status === booking.status)
    : -1;

  return (
    <div class="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header class="bg-brand text-white px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div class="max-w-md mx-auto flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <button
              onClick={() => closeBookingDetail()}
              class="p-2 -ml-2 text-white hover:bg-white/10 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center focus:outline-none"
              aria-label={t('app.back')}
            >
              <ArrowLeftIcon size={22} />
            </button>
            <h1 class="text-base font-bold leading-tight">{t('detail.title')}</h1>
          </div>

          <button
            onClick={() => refreshCurrentBooking()}
            disabled={isLoading}
            class="p-2 -mr-2 text-white hover:bg-white/10 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center focus:outline-none transition-colors"
            aria-label={t('detail.refresh')}
            title={t('detail.refresh')}
          >
            <RefreshIcon size={20} class={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main class="max-w-md mx-auto w-full p-4 flex-1 space-y-4">
        {/* Loading Spinner */}
        {isLoading && !booking && (
          <div class="flex flex-col items-center justify-center py-16 space-y-3">
            <SpinnerIcon size={32} class="text-brand" />
            <p class="text-xs text-text-sub font-medium">{t('app.loading')}</p>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div class="bg-surface border border-red-200 rounded-lg p-6 text-center space-y-4 shadow-sm my-4">
            <div class="w-12 h-12 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto">
              <AlertCircleIcon size={28} />
            </div>
            <div>
              <p class="text-sm font-semibold text-text-main">{error}</p>
              <p class="text-xs text-text-sub mt-1">{t('app.network_error')}</p>
            </div>
            <button
              type="button"
              onClick={() => refreshCurrentBooking()}
              class="min-h-[48px] px-6 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-lg font-bold text-xs transition-colors inline-flex items-center space-x-2"
            >
              <RefreshIcon size={16} />
              <span>{t('app.retry')}</span>
            </button>
          </div>
        )}

        {/* Booking Details Content */}
        {booking && (
          <>
            {/* 1. Status & Summary Header Card */}
            <section class="bg-surface border border-border rounded-lg p-4 shadow-sm space-y-3">
              <div class="flex items-start justify-between">
                <div class="flex items-center space-x-3">
                  <div class="w-12 h-12 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
                    {category ? (
                      <CategoryIconRenderer iconName={category.iconName} size={26} />
                    ) : (
                      <FileTextIcon size={24} />
                    )}
                  </div>
                  <div>
                    <h2 class="text-base font-bold text-text-main leading-tight">
                      {categoryTitle}
                    </h2>
                    <div class="text-xs text-text-sub font-mono mt-0.5">
                      {shortId}
                    </div>
                  </div>
                </div>

                <div class="text-right">
                  <span class="text-base font-bold text-action">
                    ₹{booking.visitingFee.toFixed(2)}
                  </span>
                  <div class="text-xs text-text-sub">
                    {t('booking.cash_on_completion')}
                  </div>
                </div>
              </div>

              {/* Current Status Pill */}
              <div class={`w-full flex items-center space-x-2 p-3 rounded-lg border ${badgeStyle?.bg} ${badgeStyle?.text}`}>
                <span class={`w-2.5 h-2.5 rounded-full ${badgeStyle?.dot} shrink-0 animate-pulse`}></span>
                <span class="text-xs font-bold leading-normal">
                  {booking.status === 'PROVIDER_ASSIGNED' && booking.provider?.name
                    ? t('status.provider_assigned', { name: booking.provider.name })
                    : booking.status === 'PAYMENT_PENDING'
                    ? t('status.payment_pending', { amount: (booking.finalAmount ?? booking.visitingFee).toFixed(2) })
                    : t(statusKey)}
                </span>
              </div>

              {/* Assigned Technician Banner (ONLY when assigned by server) */}
              {booking.provider?.name ? (
                <div class="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-xs flex items-center justify-between">
                  <span class="text-text-sub font-medium">{t('detail.provider_label')}:</span>
                  <span class="font-bold text-brand">{booking.provider.name}</span>
                </div>
              ) : (
                !isExceptionalStatus && (
                  <div class="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-text-sub flex items-center space-x-2">
                    <ClockIcon size={15} class="text-slate-400 shrink-0" />
                    <span>{t('detail.no_provider')}</span>
                  </div>
                )
              )}
            </section>

            {/* 2. Status Progression Timeline */}
            <section class="bg-surface border border-border rounded-lg p-4 shadow-sm space-y-3">
              <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 class="text-xs font-bold text-text-sub uppercase tracking-wider">
                  {t('detail.timeline_title')}
                </h3>
                {isLoading && (
                  <div class="flex items-center space-x-1 text-xs text-brand">
                    <SpinnerIcon size={12} />
                    <span>{t('detail.refreshing')}</span>
                  </div>
                )}
              </div>

              <div class="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {ORDERED_STAGES.map((stage, idx) => {
                  const logEntry = logsByStatus.get(stage.status);
                  const isPassed = currentStatusIndex > idx || (currentStatusIndex === -1 && Boolean(logEntry));
                  const isCurrent = booking.status === stage.status;
                  const isPending = !isPassed && !isCurrent;

                  // Provider assigned name template & payment pending handling
                  let stageText = t(stage.labelKey as any);
                  if (stage.status === 'PROVIDER_ASSIGNED') {
                    stageText = booking.provider?.name
                      ? t('status.provider_assigned', { name: booking.provider.name })
                      : (lang === 'hi' ? 'मिस्त्री नियुक्त' : 'Technician assigned');
                  } else if (stage.status === 'PAYMENT_PENDING') {
                    const fee = booking.finalAmount ?? booking.visitingFee;
                    stageText = t('status.payment_pending', { amount: fee.toFixed(2) });
                  }

                  let dotClass = 'border-slate-300 bg-white text-slate-400';
                  if (isPassed) {
                    dotClass = 'bg-action text-white border-action';
                  } else if (isCurrent) {
                    dotClass = 'bg-brand text-white border-brand ring-4 ring-brand/20';
                  }

                  return (
                    <div key={stage.status} class="relative flex items-start space-x-3 text-xs">
                      {/* Timeline Node */}
                      <span
                        class={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${dotClass}`}
                      >
                        {isPassed ? <CheckIcon size={12} /> : idx + 1}
                      </span>

                      {/* Content */}
                      <div class="flex-1 min-w-0">
                        <div
                          class={`font-semibold ${
                            isCurrent
                              ? 'text-brand font-bold'
                              : isPassed
                              ? 'text-text-main'
                              : 'text-text-sub/70'
                          }`}
                        >
                          {stageText}
                        </div>

                        {logEntry && (
                          <div class="text-[11px] text-text-sub mt-0.5">
                            {formatDateTime(logEntry.createdAt, lang)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Exceptional Terminal State (if applicable) */}
                {isExceptionalStatus && (
                  <div class="relative flex items-start space-x-3 text-xs pt-1">
                    <span class="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xs ring-4 ring-red-100">
                      ✕
                    </span>
                    <div class="flex-1 bg-red-50 border border-red-200 rounded p-2.5">
                      <div class="font-bold text-red-700">
                        {t(statusKey)}
                      </div>
                      <div class="text-[11px] text-red-600 mt-0.5">
                        {formatDateTime(booking.updatedAt, lang)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 3. Problem Description & Voice Note Player */}
            {(booking.textDescription || booking.audioUrl) && (
              <section class="bg-surface border border-border rounded-lg p-4 shadow-sm space-y-3">
                <h3 class="text-xs font-bold text-text-sub uppercase tracking-wider">
                  {t('booking.step1_title')}
                </h3>

                {booking.textDescription && (
                  <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-text-main leading-relaxed">
                    {booking.textDescription}
                  </div>
                )}

                {booking.audioUrl && (
                  <div class="border border-border rounded-lg p-3 space-y-2 bg-white">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center space-x-2">
                        <div class="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                          <MicIcon size={18} />
                        </div>
                        <div>
                          <div class="text-xs font-bold text-text-main">
                            {t('detail.audio_note_title')}
                          </div>
                          {booking.audioDurationSeconds && (
                            <div class="text-[11px] text-text-sub">
                              {booking.audioDurationSeconds} {lang === 'hi' ? 'सेकंड' : 'seconds'}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleDetailAudio(booking.audioUrl!)}
                        class="min-h-[48px] px-4 py-2 bg-brand hover:bg-brand-dark text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center space-x-2"
                        aria-label={isPlaying ? t('booking.audio_stop') : t('booking.audio_play')}
                      >
                        {isPlaying ? (
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

                    {audioError && (
                      <p class="text-xs text-red-600 font-medium pt-1">
                        {t('detail.audio_error')}
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* 4. Location & Financial Information */}
            <section class="bg-surface border border-border rounded-lg p-4 shadow-sm space-y-2.5">
              <h3 class="text-xs font-bold text-text-sub uppercase tracking-wider">
                {t('detail.service_address')}
              </h3>

              <div class="text-xs space-y-1.5">
                <div class="flex items-start justify-between">
                  <span class="text-text-sub">{t('booking.select_locality')}:</span>
                  <span class="font-semibold text-text-main text-right">{localityName}</span>
                </div>

                {booking.landmark && (
                  <div class="flex items-start justify-between">
                    <span class="text-text-sub">{t('booking.landmark_label')}:</span>
                    <span class="font-medium text-text-main text-right">{booking.landmark}</span>
                  </div>
                )}

                <div class="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span class="text-text-sub">{t('detail.created_at')}:</span>
                  <span class="text-text-main">{formatDateTime(booking.createdAt, lang)}</span>
                </div>

                <div class="flex items-center justify-between">
                  <span class="text-text-sub">{t('booking.cash_on_completion')}:</span>
                  <span class="font-bold text-action text-sm">₹{booking.visitingFee.toFixed(2)}</span>
                </div>
              </div>
            </section>

            {/* Back Button CTA */}
            <div>
              <button
                type="button"
                onClick={() => closeBookingDetail()}
                class="w-full min-h-[48px] px-4 py-3 bg-slate-100 hover:bg-slate-200 text-text-main font-bold rounded-lg text-sm transition-colors flex items-center justify-center space-x-2"
              >
                <ArrowLeftIcon size={18} />
                <span>{t('app.back')}</span>
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
