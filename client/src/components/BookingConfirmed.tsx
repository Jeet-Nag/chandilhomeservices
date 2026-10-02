import { useEffect } from 'preact/hooks';
import { createdBooking, activeCategory, returnToHome, openBookingDetail } from '../state/booking';
import { currentLanguage, t } from '../state/language';
import { CHANDIL_LOCALITIES } from '@shared';
import {
  CategoryIconRenderer,
  CheckIcon,
  PhoneIcon,
  WhatsAppIcon,
} from './icons';
import { supportPhone, supportWhatsApp, fetchSupportConfig } from '../state/config';

export function BookingConfirmed() {
  useEffect(() => {
    fetchSupportConfig();
  }, []);

  const booking = createdBooking.value;
  const category = activeCategory.value;
  const lang = currentLanguage.value || 'en';
  const phone = supportPhone.value;
  const rawWhatsApp = supportWhatsApp.value;
  const cleanWhatsApp = rawWhatsApp ? rawWhatsApp.replace(/[^0-9]/g, '') : null;
  const whatsappUrl = cleanWhatsApp
    ? `https://wa.me/${cleanWhatsApp}?text=${encodeURIComponent('Hello Chandil Home Services')}`
    : null;

  if (!booking) {
    return null;
  }

  const categoryTitle = category
    ? (lang === 'hi' ? category.titleHi : category.titleEn)
    : booking.categoryId;

  const localityObj = CHANDIL_LOCALITIES.find((l) => l.id === booking.areaLocality);
  const localityName = localityObj
    ? (lang === 'hi' ? localityObj.nameHi : localityObj.nameEn)
    : booking.areaLocality;

  // Short ID display (e.g. #CHS-8A3F)
  const shortId = `#CHS-${booking.id.substring(0, 8).toUpperCase()}`;

  return (
    <div class="min-h-screen flex flex-col justify-between bg-background p-4">
      <main class="max-w-md mx-auto w-full my-auto space-y-4">
        {/* Success Header Card */}
        <div class="bg-surface border border-border rounded-lg p-6 shadow-sm text-center space-y-3">
          <div class="w-16 h-16 bg-green-100 text-action rounded-full flex items-center justify-center mx-auto">
            <CheckIcon size={36} />
          </div>

          <div>
            <h1 class="text-xl font-bold text-text-main leading-tight">
              {t('booking.booking_created_title')}
            </h1>
            <p class="text-xs text-text-sub mt-1.5 leading-relaxed">
              {t('booking.booking_success_note')}
            </p>
          </div>

          {/* Current Status Pill */}
          <div class="inline-flex items-center space-x-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-xs font-semibold text-brand">
            <span class="w-2 h-2 rounded-full bg-brand animate-pulse"></span>
            <span>{t('status.service_requested')}</span>
          </div>
        </div>

        {/* Confirmed Booking Summary Details */}
        <section class="bg-surface border border-border rounded-lg p-4 shadow-sm space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <span class="text-xs text-text-sub font-semibold">{t('booking.booking_id_label')}:</span>
            <span class="text-xs font-mono font-bold text-brand bg-slate-100 px-2 py-0.5 rounded">
              {shortId}
            </span>
          </div>

          <div class="flex items-center space-x-3 py-1">
            {category && (
              <div class="w-10 h-10 rounded bg-brand/10 text-brand flex items-center justify-center shrink-0">
                <CategoryIconRenderer iconName={category.iconName} size={22} />
              </div>
            )}
            <div>
              <div class="text-sm font-bold text-text-main">{categoryTitle}</div>
              <div class="text-xs text-text-sub">{localityName}</div>
            </div>
          </div>

          <div class="bg-slate-50 border border-slate-200 rounded p-3 text-xs flex items-center justify-between">
            <span class="text-text-sub font-medium">{t('booking.cash_on_completion')}:</span>
            <span class="text-action-active font-bold text-sm">
              ₹{booking.visitingFee.toFixed(2)}
            </span>
          </div>
        </section>

        {/* Direct Dispatch Helpline */}
        <section class="bg-surface border border-border rounded-lg p-4 shadow-sm space-y-3">
          <h2 class="text-xs font-bold text-text-sub uppercase tracking-wider">
            {t('app.help')}
          </h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {phone ? (
              <a
                href={`tel:${phone}`}
                class="min-h-[48px] px-3 py-2.5 border-2 border-brand text-brand hover:bg-brand hover:text-white rounded-lg font-semibold text-xs transition-colors flex items-center justify-center space-x-2 text-center"
              >
                <PhoneIcon size={18} />
                <span>{t('home.call_to_book')}</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                class="min-h-[48px] px-3 py-2.5 border-2 border-slate-200 text-slate-400 rounded-lg font-semibold text-xs flex items-center justify-center space-x-2 text-center cursor-not-allowed opacity-60"
              >
                <PhoneIcon size={18} />
                <span>{t('home.call_to_book')}</span>
              </button>
            )}

            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="min-h-[48px] px-3 py-2.5 bg-action hover:bg-action-active text-white rounded-lg font-semibold text-xs transition-colors flex items-center justify-center space-x-2 text-center"
              >
                <WhatsAppIcon size={18} />
                <span>{t('home.whatsapp_to_book')}</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                class="min-h-[48px] px-3 py-2.5 bg-slate-200 text-slate-400 rounded-lg font-semibold text-xs flex items-center justify-center space-x-2 text-center cursor-not-allowed opacity-60"
              >
                <WhatsAppIcon size={18} />
                <span>{t('home.whatsapp_to_book')}</span>
              </button>
            )}
          </div>
        </section>

        {/* CTAs */}
        <div class="space-y-2.5">
          <button
            type="button"
            onClick={() => openBookingDetail(booking.id)}
            class="w-full min-h-[48px] px-4 py-3 bg-action hover:bg-action-active text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center space-x-2"
          >
            <span>{t('history.view_details')}</span>
            <span>→</span>
          </button>

          <button
            type="button"
            onClick={() => returnToHome()}
            class="w-full min-h-[48px] px-4 py-3 bg-slate-100 hover:bg-slate-200 text-text-main font-bold rounded-lg text-sm transition-colors flex items-center justify-center"
          >
            {t('booking.back_to_home')}
          </button>
        </div>
      </main>
    </div>
  );
}
