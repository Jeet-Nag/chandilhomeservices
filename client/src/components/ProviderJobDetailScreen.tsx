import { useEffect } from 'preact/hooks';
import {
  activeJobDetail,
  isJobDetailLoading,
  jobDetailError,
  refreshCurrentJob,
  closeJobDetail,
  toggleJobAudio,
  stopJobAudio,
  isPlayingJobAudio,
  jobAudioError,
  acceptJob,
  isAcceptingJob,
  jobAcceptError,
  jobAcceptSuccess,
  rejectJob,
  isRejectingJob,
  jobRejectError,
  jobRejectSuccess,
  isUpdatingStatus,
  statusUpdateError,
  statusUpdateSuccess,
  updateJobStatus,
  collectCashPayment,
  isCollectingPayment,
  paymentCollectError,
  paymentCollectSuccess,
} from '../state/provider';
import { categories, fetchCategories } from '../state/categories';
import { currentLanguage, t } from '../state/language';
import { CHANDIL_LOCALITIES, BookingStatus } from '@shared';
import {
  ArrowLeftIcon,
  RefreshIcon,
  SpinnerIcon,
  AlertCircleIcon,
  CategoryIconRenderer,
  FileTextIcon,
  MicIcon,
  PlayIcon,
  PauseIcon,
  ClockIcon,
  CheckIcon,
  XIcon,
  NavigationIcon,
} from './icons';

function formatFullDateTime(isoString: string, lang: string): string {
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

function getProviderStatusBadge(status: BookingStatus): { bg: string; dot: string; pulse: boolean } {
  switch (status) {
    case 'PAYMENT_COLLECTED':
    case 'BOOKING_COMPLETED':
    case 'SERVICE_COMPLETED':
    case 'PROVIDER_ACCEPTED':
      return {
        bg: 'bg-green-50 border-green-200 text-action-active',
        dot: 'bg-action',
        pulse: false,
      };
    case 'PAYMENT_PENDING':
    case 'PROVIDER_ON_THE_WAY':
    case 'SERVICE_STARTED':
      return {
        bg: 'bg-amber-50 border-amber-200 text-amber-800',
        dot: 'bg-amber-500',
        pulse: true,
      };
    case 'PROVIDER_ASSIGNED':
      return {
        bg: 'bg-blue-50 border-blue-200 text-brand',
        dot: 'bg-brand',
        pulse: true,
      };
    case 'SERVICE_REQUESTED':
    default:
      return {
        bg: 'bg-blue-50 border-blue-200 text-brand',
        dot: 'bg-brand',
        pulse: true,
      };
  }
}

export function ProviderJobDetailScreen() {
  const lang = currentLanguage.value || 'en';
  const job = activeJobDetail.value;
  const isLoading = isJobDetailLoading.value;
  const error = jobDetailError.value;
  const isPlaying = isPlayingJobAudio.value;
  const audioError = jobAudioError.value;

  useEffect(() => {
    if (categories.value.length === 0) {
      fetchCategories();
    }
    return () => {
      stopJobAudio();
    };
  }, []);

  const category = job ? categories.value.find((c) => c.id === job.categoryId) : null;
  const categoryTitle = category
    ? (lang === 'hi' ? category.titleHi : category.titleEn)
    : (job?.categoryId || '');

  const localityObj = job ? CHANDIL_LOCALITIES.find((l) => l.id === job.areaLocality) : null;
  const localityName = localityObj
    ? (lang === 'hi' ? localityObj.nameHi : localityObj.nameEn)
    : (job?.areaLocality || '');

  const shortId = job ? `#CHS-${job.id.substring(0, 8).toUpperCase()}` : '';

  return (
    <div class="min-h-screen flex flex-col bg-background">
      {/* Top Header */}
      <header class="bg-brand text-white px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div class="max-w-md mx-auto flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <button
              onClick={() => closeJobDetail()}
              class="p-2 -ml-2 text-white hover:bg-white/10 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center focus:outline-none"
              aria-label={t('app.back')}
            >
              <ArrowLeftIcon size={22} />
            </button>
            <h1 class="text-base font-bold leading-tight">
              {t('provider.job_details_title')}
            </h1>
          </div>

          <button
            onClick={() => refreshCurrentJob()}
            disabled={isLoading}
            class="p-2 -mr-2 text-white hover:bg-white/10 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center focus:outline-none transition-colors"
            aria-label={t('provider.refresh')}
            title={t('provider.refresh')}
          >
            <RefreshIcon size={20} class={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main class="max-w-md mx-auto w-full p-4 flex-1 space-y-4">
        {/* Loading Spinner */}
        {isLoading && !job && (
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
              onClick={() => refreshCurrentJob()}
              class="min-h-[48px] px-6 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-lg font-bold text-xs transition-colors inline-flex items-center space-x-2"
            >
              <RefreshIcon size={16} />
              <span>{t('app.retry')}</span>
            </button>
          </div>
        )}

        {/* Job Details Card */}
        {job && (
          <>
            {/* 1. Category & Visiting Fee Card */}
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
                    ₹{job.visitingFee.toFixed(2)}
                  </span>
                  <div class="text-[11px] text-text-sub">
                    {t('booking.cash_on_completion')}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              {(() => {
                const badge = getProviderStatusBadge(job.status);
                return (
                  <div class={`w-full flex items-center space-x-2 p-3 rounded-lg border ${badge.bg}`}>
                    <span class={`w-2.5 h-2.5 rounded-full shrink-0 ${badge.dot} ${badge.pulse ? 'animate-pulse' : ''}`}></span>
                    <span class="text-xs font-bold leading-normal">
                      {t(('status.' + job.status.toLowerCase()) as any)}
                    </span>
                  </div>
                );
              })()}
            </section>

            {/* 2. Customer Problem Description */}
            <section class="bg-surface border border-border rounded-lg p-4 shadow-sm space-y-3">
              <h3 class="text-xs font-bold text-text-sub uppercase tracking-wider">
                {t('provider.customer_problem')}
              </h3>

              {job.textDescription ? (
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-text-main leading-relaxed">
                  {job.textDescription}
                </div>
              ) : (
                <p class="text-xs text-text-sub italic">
                  {t('booking.no_voice_note')}
                </p>
              )}

              {/* Voice Note Audio Player */}
              {job.audioUrl && (
                <div class="border border-border rounded-lg p-3 space-y-2 bg-white">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                      <div class="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                        <MicIcon size={18} />
                      </div>
                      <div>
                        <div class="text-xs font-bold text-text-main">
                          {t('provider.voice_note')}
                        </div>
                        {job.audioDurationSeconds && (
                          <div class="text-[11px] text-text-sub">
                            {t('provider.voice_note_duration', { seconds: job.audioDurationSeconds })}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleJobAudio(job.audioUrl!)}
                      class={`min-h-[48px] px-4 py-2 rounded-lg font-bold text-xs flex items-center space-x-2 transition-colors focus:outline-none ${
                        isPlaying
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-brand hover:bg-brand-dark text-white'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <PauseIcon size={16} />
                          <span>{t('provider.audio_pause')}</span>
                        </>
                      ) : (
                        <>
                          <PlayIcon size={16} />
                          <span>{t('provider.audio_play')}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {isPlaying && (
                    <div class="flex items-center space-x-2 pt-1 text-[11px] text-amber-700">
                      <span class="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                      <span>{t('provider.audio_playing')}</span>
                    </div>
                  )}

                  {audioError && (
                    <div class="bg-red-50 border border-red-200 text-red-700 rounded p-2 text-xs flex items-center space-x-2">
                      <AlertCircleIcon size={14} class="shrink-0" />
                      <span>{audioError}</span>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 3. Service Location Card */}
            <section class="bg-surface border border-border rounded-lg p-4 shadow-sm space-y-2">
              <h3 class="text-xs font-bold text-text-sub uppercase tracking-wider">
                {t('provider.service_location')}
              </h3>
              <div class="text-sm font-bold text-text-main">
                {localityName}
              </div>
              {job.landmark && (
                <div class="text-xs text-text-sub">
                  <span class="font-medium text-text-main">{t('booking.landmark_label')} </span>
                  <span>{job.landmark}</span>
                </div>
              )}
            </section>

            {/* 4. Request Time Card */}
            <section class="bg-surface border border-border rounded-lg p-4 shadow-sm space-y-1">
              <h3 class="text-xs font-bold text-text-sub uppercase tracking-wider">
                {t('provider.request_time')}
              </h3>
              <div class="flex items-center space-x-1.5 text-xs text-text-sub">
                <ClockIcon size={14} class="text-slate-400" />
                <span>{formatFullDateTime(job.createdAt, lang)}</span>
              </div>
            </section>

            {/* 5. Provider Operational Actions & Banners */}
            <section class="space-y-3 pt-2">
              {/* Conflict / Error Banners */}
              {jobAcceptError.value && (
                <div class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs flex items-center space-x-2">
                  <AlertCircleIcon size={16} class="shrink-0" />
                  <span class="font-medium">{jobAcceptError.value}</span>
                </div>
              )}

              {jobRejectError.value && (
                <div class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs flex items-center space-x-2">
                  <AlertCircleIcon size={16} class="shrink-0" />
                  <span class="font-medium">{jobRejectError.value}</span>
                </div>
              )}

              {statusUpdateError.value && (
                <div class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs flex items-center space-x-2">
                  <AlertCircleIcon size={16} class="shrink-0" />
                  <span class="font-medium">{statusUpdateError.value}</span>
                </div>
              )}

              {/* Relinquished Banner */}
              {jobRejectSuccess.value && (
                <div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-xs flex items-center space-x-2">
                  <span class="font-medium">{t('provider.reject_success')}</span>
                </div>
              )}

              {/* Assigned by Admin: Accept or Decline / Relinquish */}
              {job.status === 'PROVIDER_ASSIGNED' ? (
                <div class="space-y-3">
                  <div class="bg-blue-50 border border-blue-200 text-brand rounded-lg p-4 text-xs flex items-center space-x-3 shadow-xs">
                    <div class="w-8 h-8 rounded-full bg-blue-100 text-brand flex items-center justify-center shrink-0">
                      <AlertCircleIcon size={18} />
                    </div>
                    <div>
                      <div class="font-bold text-sm text-brand">
                        {t('provider.assigned_to_you')}
                      </div>
                      <div class="text-[11px] text-text-sub mt-0.5">
                        {t('provider.assigned_job_banner')}
                      </div>
                    </div>
                  </div>

                  {/* Primary Action: Accept Job (Min 48px touch target) */}
                  <button
                    type="button"
                    onClick={() => acceptJob(job.id)}
                    disabled={isAcceptingJob.value || isRejectingJob.value}
                    class="w-full min-h-[48px] px-6 py-3 bg-action hover:bg-action-active text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-action/40 active:bg-green-800"
                  >
                    {isAcceptingJob.value ? (
                      <>
                        <SpinnerIcon size={18} class="animate-spin" />
                        <span>{t('provider.accepting')}</span>
                      </>
                    ) : (
                      <>
                        <CheckIcon size={18} />
                        <span>{t('provider.accept_assigned_job')}</span>
                      </>
                    )}
                  </button>

                  {/* Secondary Action: Decline / Relinquish (Min 48px touch target) */}
                  <button
                    type="button"
                    onClick={() => rejectJob(job.id)}
                    disabled={isRejectingJob.value || isAcceptingJob.value}
                    class="w-full min-h-[48px] px-6 py-3 border border-red-300 hover:border-red-400 bg-white hover:bg-red-50 text-red-700 rounded-lg font-bold text-sm transition-colors flex items-center justify-center space-x-2 shadow-xs disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-400/40 active:bg-red-100"
                  >
                    {isRejectingJob.value ? (
                      <>
                        <SpinnerIcon size={18} class="animate-spin text-red-600" />
                        <span>{t('provider.rejecting')}</span>
                      </>
                    ) : (
                      <>
                        <XIcon size={18} class="text-red-600" />
                        <span>{t('provider.decline_assigned_job')}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : job.status === 'SERVICE_REQUESTED' ? (
                <button
                  type="button"
                  onClick={() => acceptJob(job.id)}
                  disabled={isAcceptingJob.value || isRejectingJob.value || isUpdatingStatus.value}
                  class="w-full min-h-[48px] px-6 py-3 bg-action hover:bg-action-active text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-action/40 active:bg-green-800"
                >
                  {isAcceptingJob.value ? (
                    <>
                      <SpinnerIcon size={18} class="animate-spin" />
                      <span>{t('provider.accepting')}</span>
                    </>
                  ) : (
                    <>
                      <CheckIcon size={18} />
                      <span>{t('provider.accept_job')}</span>
                    </>
                  )}
                </button>
              ) : job.status === 'PROVIDER_ACCEPTED' ? (
                /* Accepted State: Primary "On the Way" + Secondary "Reject Job" */
                <div class="space-y-3">
                  <div class="bg-green-50 border border-green-200 text-action-active rounded-lg p-4 text-xs flex items-center space-x-3 shadow-xs">
                    <div class="w-8 h-8 rounded-full bg-action/20 text-action flex items-center justify-center shrink-0">
                      <CheckIcon size={18} />
                    </div>
                    <div>
                      <div class="font-bold text-sm text-action-active">
                        {t('provider.job_accepted_banner')}
                      </div>
                      <div class="text-[11px] text-green-700 mt-0.5">
                        {t('provider.accept_success')}
                      </div>
                    </div>
                  </div>

                  {/* Primary Operational Action: "On the Way" (Min 48px touch target) */}
                  <button
                    type="button"
                    onClick={() => updateJobStatus(job.id, 'PROVIDER_ON_THE_WAY')}
                    disabled={isUpdatingStatus.value || isRejectingJob.value}
                    class="w-full min-h-[48px] px-6 py-3 bg-brand hover:bg-brand-dark text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand/40 active:bg-brand-dark"
                  >
                    {isUpdatingStatus.value ? (
                      <>
                        <SpinnerIcon size={18} class="animate-spin" />
                        <span>{t('provider.updating_status')}</span>
                      </>
                    ) : (
                      <>
                        <NavigationIcon size={18} />
                        <span>{t('provider.on_the_way')}</span>
                      </>
                    )}
                  </button>

                  {/* Secondary Action: "Reject Job" (Min 48px touch target) */}
                  <button
                    type="button"
                    onClick={() => rejectJob(job.id)}
                    disabled={isRejectingJob.value || isUpdatingStatus.value}
                    class="w-full min-h-[48px] px-6 py-3 border border-red-300 hover:border-red-400 bg-white hover:bg-red-50 text-red-700 rounded-lg font-bold text-sm transition-colors flex items-center justify-center space-x-2 shadow-xs disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-400/40 active:bg-red-100"
                  >
                    {isRejectingJob.value ? (
                      <>
                        <SpinnerIcon size={18} class="animate-spin text-red-600" />
                        <span>{t('provider.rejecting')}</span>
                      </>
                    ) : (
                      <>
                        <XIcon size={18} class="text-red-600" />
                        <span>{t('provider.reject_job')}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : job.status === 'PROVIDER_ON_THE_WAY' ? (
                /* On The Way State: Primary "Start Service" */
                <div class="space-y-3">
                  <div class="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 text-xs flex items-center space-x-3 shadow-xs">
                    <div class="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <NavigationIcon size={18} />
                    </div>
                    <div>
                      <div class="font-bold text-sm text-amber-800">
                        {t('status.provider_on_the_way')}
                      </div>
                      <div class="text-[11px] text-amber-700 mt-0.5">
                        {t('provider.on_the_way_banner')}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateJobStatus(job.id, 'SERVICE_STARTED')}
                    disabled={isUpdatingStatus.value}
                    class="w-full min-h-[48px] px-6 py-3 bg-action hover:bg-action-active text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-action/40 active:bg-green-800"
                  >
                    {isUpdatingStatus.value ? (
                      <>
                        <SpinnerIcon size={18} class="animate-spin" />
                        <span>{t('provider.updating_status')}</span>
                      </>
                    ) : (
                      <>
                        <PlayIcon size={18} />
                        <span>{t('provider.start_work')}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : job.status === 'SERVICE_STARTED' ? (
                /* Service Started State: Primary "Complete Service" */
                <div class="space-y-3">
                  <div class="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 text-xs flex items-center space-x-3 shadow-xs">
                    <div class="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <ClockIcon size={18} />
                    </div>
                    <div>
                      <div class="font-bold text-sm text-amber-800">
                        {t('status.service_started')}
                      </div>
                      <div class="text-[11px] text-amber-700 mt-0.5">
                        {t('provider.service_started_banner')}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateJobStatus(job.id, 'SERVICE_COMPLETED')}
                    disabled={isUpdatingStatus.value}
                    class="w-full min-h-[48px] px-6 py-3 bg-action hover:bg-action-active text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-action/40 active:bg-green-800"
                  >
                    {isUpdatingStatus.value ? (
                      <>
                        <SpinnerIcon size={18} class="animate-spin" />
                        <span>{t('provider.updating_status')}</span>
                      </>
                    ) : (
                      <>
                        <CheckIcon size={18} />
                        <span>{t('provider.work_completed')}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : job.status === 'SERVICE_COMPLETED' ? (
                /* Service Completed: Provider proceeds to payment */
                <div class="space-y-3">
                  <div class="bg-green-50 border border-green-200 text-action-active rounded-lg p-4 text-xs flex items-center space-x-3 shadow-xs">
                    <div class="w-8 h-8 rounded-full bg-action/20 text-action flex items-center justify-center shrink-0">
                      <CheckIcon size={18} />
                    </div>
                    <div>
                      <div class="font-bold text-sm text-action-active">
                        {t('status.service_completed')}
                      </div>
                      <div class="text-[11px] text-green-700 mt-0.5">
                        {t('provider.service_completed_banner')}
                      </div>
                    </div>
                  </div>

                  {statusUpdateError.value && (
                    <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                      {statusUpdateError.value}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => updateJobStatus(job.id, 'PAYMENT_PENDING')}
                    disabled={isUpdatingStatus.value}
                    class="w-full min-h-[48px] px-6 py-3 bg-brand hover:bg-brand-dark text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand/40 active:bg-brand-dark"
                  >
                    {isUpdatingStatus.value ? (
                      <>
                        <SpinnerIcon size={18} class="animate-spin" />
                        <span>{t('provider.updating_status')}</span>
                      </>
                    ) : (
                      <>
                        <CheckIcon size={18} />
                        <span>{t('provider.proceed_to_payment')}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : job.status === 'PAYMENT_PENDING' ? (
                /* Payment Pending: Collect cash from customer */
                <div class="space-y-3">
                  {/* Amount to Collect Card */}
                  <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 shadow-xs">
                    <div class="text-xs font-semibold text-amber-800 mb-1">
                      {t('provider.amount_to_collect')}
                    </div>
                    <div class="text-2xl font-bold text-amber-900">
                      ₹{job.visitingFee.toFixed(0)}
                    </div>
                    <div class="text-[11px] text-amber-700 mt-1 flex items-center space-x-1">
                      <span>💵</span>
                      <span>{t('provider.cash_payment_due_note')}</span>
                    </div>
                  </div>

                  {paymentCollectError.value && (
                    <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                      {paymentCollectError.value}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => collectCashPayment(job.id)}
                    disabled={isCollectingPayment.value}
                    class="w-full min-h-[48px] px-6 py-3 bg-action hover:bg-action-active text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-action/40 active:bg-green-800"
                  >
                    {isCollectingPayment.value ? (
                      <>
                        <SpinnerIcon size={18} class="animate-spin" />
                        <span>{t('provider.collecting_payment')}</span>
                      </>
                    ) : (
                      <>
                        <CheckIcon size={18} />
                        <span>{t('provider.cash_collected_action')}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : job.status === 'PAYMENT_COLLECTED' ? (
                /* Payment Collected: Complete the booking */
                <div class="space-y-3">
                  <div class="bg-green-50 border border-green-200 text-action-active rounded-lg p-4 text-xs flex items-center space-x-3 shadow-xs">
                    <div class="w-8 h-8 rounded-full bg-action/20 text-action flex items-center justify-center shrink-0">
                      <CheckIcon size={18} />
                    </div>
                    <div>
                      <div class="font-bold text-sm text-action-active">
                        {t('provider.payment_collected_banner')}
                      </div>
                      <div class="text-[11px] text-green-700 mt-0.5">
                        ₹{job.visitingFee.toFixed(0)} — Cash
                      </div>
                    </div>
                  </div>

                  {statusUpdateError.value && (
                    <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                      {statusUpdateError.value}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => updateJobStatus(job.id, 'BOOKING_COMPLETED')}
                    disabled={isUpdatingStatus.value}
                    class="w-full min-h-[48px] px-6 py-3 bg-action hover:bg-action-active text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-action/40 active:bg-green-800"
                  >
                    {isUpdatingStatus.value ? (
                      <>
                        <SpinnerIcon size={18} class="animate-spin" />
                        <span>{t('provider.updating_status')}</span>
                      </>
                    ) : (
                      <>
                        <CheckIcon size={18} />
                        <span>{t('provider.complete_booking_action')}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : job.status === 'BOOKING_COMPLETED' ? (
                /* Booking Completed: Terminal state — no further actions */
                <div class="bg-green-50 border border-green-200 text-action-active rounded-lg p-4 text-xs flex items-center space-x-3 shadow-xs">
                  <div class="w-8 h-8 rounded-full bg-action/20 text-action flex items-center justify-center shrink-0">
                    <CheckIcon size={18} />
                  </div>
                  <div>
                    <div class="font-bold text-sm text-action-active">
                      {t('provider.booking_completed_banner')}
                    </div>
                    <div class="text-[11px] text-green-700 mt-0.5">
                      ₹{job.visitingFee.toFixed(0)} — Cash
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
