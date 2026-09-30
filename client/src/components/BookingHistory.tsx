import { useEffect } from 'preact/hooks';
import {
  bookingHistory,
  isHistoryLoading,
  historyError,
  fetchBookingHistory,
  openBookingDetail,
  returnToHome,
} from '../state/booking';
import { categories, fetchCategories } from '../state/categories';
import { currentLanguage, t } from '../state/language';
import { CHANDIL_LOCALITIES, BookingStatus } from '@shared';
import {
  ArrowLeftIcon,
  RefreshIcon,
  SpinnerIcon,
  AlertCircleIcon,
  FileTextIcon,
  ChevronRightIcon,
  CategoryIconRenderer,
  MicIcon,
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

function formatDate(isoString: string, lang: string): string {
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

export function BookingHistory() {
  const lang = currentLanguage.value || 'en';

  useEffect(() => {
    fetchBookingHistory();
    if (categories.value.length === 0) {
      fetchCategories();
    }
  }, []);

  const bookings = bookingHistory.value;
  const isLoading = isHistoryLoading.value;
  const error = historyError.value;

  return (
    <div class="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header class="bg-brand text-white px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div class="max-w-md mx-auto flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <button
              onClick={() => returnToHome()}
              class="p-2 -ml-2 text-white hover:bg-white/10 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center focus:outline-none"
              aria-label={t('app.back')}
            >
              <ArrowLeftIcon size={22} />
            </button>
            <h1 class="text-base font-bold leading-tight">{t('history.title')}</h1>
          </div>

          <button
            onClick={() => fetchBookingHistory(true)}
            disabled={isLoading}
            class="p-2 -mr-2 text-white hover:bg-white/10 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center focus:outline-none transition-colors"
            aria-label={t('history.refresh')}
            title={t('history.refresh')}
          >
            <RefreshIcon size={20} class={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main class="max-w-md mx-auto w-full p-4 flex-1">
        {/* Loading State */}
        {isLoading && bookings.length === 0 && (
          <div class="flex flex-col items-center justify-center py-16 space-y-3">
            <SpinnerIcon size={32} class="text-brand" />
            <p class="text-xs text-text-sub font-medium">{t('app.loading')}</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div class="bg-surface border border-red-200 rounded-lg p-6 text-center space-y-4 shadow-sm my-6">
            <div class="w-12 h-12 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto">
              <AlertCircleIcon size={28} />
            </div>
            <div>
              <p class="text-sm font-semibold text-text-main">{error}</p>
              <p class="text-xs text-text-sub mt-1">{t('app.network_error')}</p>
            </div>
            <button
              type="button"
              onClick={() => fetchBookingHistory(true)}
              class="min-h-[48px] px-6 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-lg font-bold text-xs transition-colors inline-flex items-center space-x-2"
            >
              <RefreshIcon size={16} />
              <span>{t('app.retry')}</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && bookings.length === 0 && (
          <div class="bg-surface border border-border rounded-lg p-8 text-center space-y-4 shadow-sm my-8">
            <div class="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <FileTextIcon size={32} />
            </div>
            <div>
              <h2 class="text-base font-bold text-text-main">{t('history.empty_title')}</h2>
              <p class="text-xs text-text-sub mt-1 leading-relaxed max-w-xs mx-auto">
                {t('history.empty_desc')}
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => returnToHome()}
                class="min-h-[48px] px-6 py-3 bg-action hover:bg-action-active text-white rounded-lg font-bold text-sm transition-colors inline-flex items-center space-x-2"
              >
                <span>{t('history.book_now')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Bookings List (Newest First) */}
        {bookings.length > 0 && (
          <div class="space-y-3">
            {isLoading && (
              <div class="flex items-center justify-center py-1 text-xs text-text-sub space-x-2">
                <SpinnerIcon size={14} class="text-brand" />
                <span>{t('history.refreshing')}</span>
              </div>
            )}

            {bookings.map((booking) => {
              const category = categories.value.find((c) => c.id === booking.categoryId);
              const categoryTitle = category
                ? (lang === 'hi' ? category.titleHi : category.titleEn)
                : booking.categoryId;

              const localityObj = CHANDIL_LOCALITIES.find((l) => l.id === booking.areaLocality);
              const localityName = localityObj
                ? (lang === 'hi' ? localityObj.nameHi : localityObj.nameEn)
                : booking.areaLocality;

              const badgeStyle = getStatusBadgeStyle(booking.status);
              const shortId = `#CHS-${booking.id.substring(0, 8).toUpperCase()}`;
              const statusKey = `status.${booking.status.toLowerCase()}` as any;

              return (
                <button
                  key={booking.id}
                  onClick={() => openBookingDetail(booking.id)}
                  class="w-full text-left bg-surface border border-border hover:border-brand rounded-lg p-4 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand/30 space-y-2.5 active:bg-slate-50 min-h-[48px]"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
                        {category ? (
                          <CategoryIconRenderer iconName={category.iconName} size={22} />
                        ) : (
                          <FileTextIcon size={20} />
                        )}
                      </div>
                      <div>
                        <div class="text-sm font-bold text-text-main leading-tight">
                          {categoryTitle}
                        </div>
                        <div class="text-xs text-text-sub font-mono mt-0.5">
                          {shortId}
                        </div>
                      </div>
                    </div>

                    <div class="text-right">
                      <span class="text-sm font-bold text-action">
                        ₹{booking.visitingFee.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <div class="flex items-center space-x-2 text-text-sub">
                      <span>{localityName}</span>
                      <span>•</span>
                      <span>{formatDate(booking.createdAt, lang)}</span>
                      {booking.audioUrl && (
                        <span class="inline-flex items-center text-red-600 ml-1" title={t('booking.voice_note')}>
                          <MicIcon size={13} />
                        </span>
                      )}
                    </div>
                    <ChevronRightIcon size={16} class="text-slate-400" />
                  </div>

                  <div class={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeStyle.bg} ${badgeStyle.text}`}>
                    <span class={`w-2 h-2 rounded-full ${badgeStyle.dot}`}></span>
                    <span>
                      {booking.status === 'PAYMENT_PENDING'
                        ? t('status.payment_pending', { amount: (booking.finalAmount ?? booking.visitingFee).toFixed(2) })
                        : t(statusKey)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
