import { useEffect } from 'preact/hooks';
import {
  categories,
  selectedCategory,
  categoriesLoading,
  categoriesError,
  isSelectingCategory,
  fetchCategories,
  selectCategory,
  clearCategorySelection,
} from '../state/categories';
import { currentUser, logout } from '../state/auth';
import { startNewBookingFlow, openBookingHistory } from '../state/booking';
import { currentLanguage, selectLanguage, t } from '../state/language';
import {
  CategoryIconRenderer,
  PhoneIcon,
  WhatsAppIcon,
  CheckIcon,
  AlertCircleIcon,
  SpinnerIcon,
  LogOutIcon,
  FileTextIcon,
} from './icons';
import { ServiceCategory } from '@shared';
import { supportPhone, supportWhatsApp, fetchSupportConfig } from '../state/config';

export function CustomerHome() {
  useEffect(() => {
    fetchCategories();
    fetchSupportConfig();
  }, []);

  const lang = currentLanguage.value || 'en';
  const user = currentUser.value;
  const phone = supportPhone.value;
  const rawWhatsApp = supportWhatsApp.value;
  const cleanWhatsApp = rawWhatsApp ? rawWhatsApp.replace(/[^0-9]/g, '') : null;
  const whatsappUrl = cleanWhatsApp
    ? `https://wa.me/${cleanWhatsApp}?text=${encodeURIComponent('Hello Chandil Home Services')}`
    : null;

  const getCategoryTitle = (cat: ServiceCategory) => {
    return lang === 'hi' ? cat.titleHi : cat.titleEn;
  };

  const getCategoryDesc = (cat: ServiceCategory) => {
    return lang === 'hi' ? (cat.descHi || '') : (cat.descEn || '');
  };

  return (
    <div class="min-h-screen flex flex-col bg-background">
      {/* 1. Top Header */}
      <header class="bg-brand text-white px-4 py-3 shadow-sm sticky top-0 z-10">
        <div class="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 class="text-base font-bold leading-tight">{t('app.title')}</h1>
            <p class="text-xs text-slate-300 leading-tight">{t('home.service_area_label')}</p>
          </div>

          <div class="flex items-center space-x-2">
            {/* Quick Language Toggle */}
            <div class="flex items-center bg-brand-dark p-0.5 rounded border border-slate-600">
              <button
                onClick={() => selectLanguage('en')}
                class={`px-2 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${
                  lang === 'en'
                    ? 'bg-action text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
                aria-label="Switch to English"
              >
                EN
              </button>
              <button
                onClick={() => selectLanguage('hi')}
                class={`px-2 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${
                  lang === 'hi'
                    ? 'bg-action text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
                aria-label="हिंदी भाषा चुनें"
              >
                हिंदी
              </button>
            </div>

            {/* Logout button */}
            <button
              onClick={() => logout()}
              class="p-2 text-slate-300 hover:text-white rounded min-h-[40px] min-w-[40px] flex items-center justify-center border border-slate-600 hover:border-slate-400"
              title={t('auth.logout')}
              aria-label={t('auth.logout')}
            >
              <LogOutIcon size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Customer Context Bar & My Bookings Button */}
      {user && (
        <section class="bg-slate-100 border-b border-border px-4 py-2">
          <div class="max-w-md mx-auto flex items-center justify-between text-xs text-text-sub">
            <span class="font-medium text-text-main">
              {t('auth.logged_in_as', { phone: `+91 ${user.phone}` })}
            </span>
            <button
              onClick={() => openBookingHistory()}
              class="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-brand font-bold rounded text-xs transition-colors flex items-center space-x-1 shadow-2xs min-h-[36px]"
              aria-label={t('history.title')}
            >
              <FileTextIcon size={14} />
              <span>{t('history.title')}</span>
            </button>
          </div>
        </section>
      )}

      {/* 3. Main Content Area */}
      <main class="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        {/* Section Heading & Tagline */}
        <section class="bg-surface border border-border rounded-lg p-4 shadow-sm">
          <h2 class="text-lg font-bold text-text-main leading-tight mb-1">
            {t('home.service_heading')}
          </h2>
          <p class="text-xs text-text-sub leading-relaxed">
            {t('app.tagline')}
          </p>
        </section>

        {/* Selected Category Notice Banner */}
        {selectedCategory.value && (
          <section class="bg-green-50 border-2 border-action rounded-lg p-4 shadow-sm space-y-3">
            <div class="flex items-start justify-between space-x-3">
              <div class="flex items-start space-x-2">
                <CheckIcon size={20} class="text-action mt-0.5 shrink-0" />
                <div>
                  <div class="text-sm font-bold text-action-active leading-tight">
                    {t('home.selected_category_notice', {
                      title: getCategoryTitle(selectedCategory.value),
                    })}
                  </div>
                  <div class="text-xs text-text-sub mt-1">
                    {t('home.visit_charge', { amount: selectedCategory.value.baseVisitFee })}
                  </div>
                </div>
              </div>
              <button
                onClick={() => clearCategorySelection()}
                class="text-xs font-semibold text-text-sub hover:text-danger p-1 min-h-[32px] shrink-0 underline"
              >
                {t('app.cancel')}
              </button>
            </div>

            <button
              onClick={() => startNewBookingFlow(selectedCategory.value!)}
              class="w-full min-h-[44px] px-4 py-2.5 bg-action hover:bg-action-active text-white font-bold rounded-lg text-sm flex items-center justify-center space-x-1.5 shadow-sm transition-colors"
            >
              <span>{t('booking.continue_to_book')}</span>
              <span>→</span>
            </button>
          </section>
        )}

        {/* UI State 1: Loading */}
        {categoriesLoading.value && (
          <div class="bg-surface border border-border rounded-lg p-8 flex flex-col items-center justify-center space-y-3">
            <SpinnerIcon size={32} class="text-brand" />
            <p class="text-sm font-semibold text-text-sub">{t('app.loading')}</p>
          </div>
        )}

        {/* UI State 2: Network / Fetch Error */}
        {!categoriesLoading.value && categoriesError.value && (
          <div class="bg-surface border border-red-200 rounded-lg p-5 shadow-sm space-y-3">
            <div class="flex items-start space-x-3 text-danger">
              <AlertCircleIcon size={24} class="shrink-0 mt-0.5" />
              <div>
                <h3 class="text-sm font-bold">{t('app.network_error')}</h3>
                <p class="text-xs text-text-sub mt-1">{categoriesError.value}</p>
              </div>
            </div>
            <button
              onClick={() => fetchCategories()}
              class="w-full min-h-[48px] px-4 py-2.5 bg-brand hover:bg-brand-dark text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center"
            >
              {t('app.retry')}
            </button>
          </div>
        )}

        {/* UI State 3: Empty State */}
        {!categoriesLoading.value && !categoriesError.value && categories.value.length === 0 && (
          <div class="bg-surface border border-border rounded-lg p-6 text-center space-y-3">
            <p class="text-sm text-text-sub">{t('home.empty_categories')}</p>
            <button
              onClick={() => fetchCategories()}
              class="min-h-[48px] px-6 py-2 bg-brand text-white font-semibold rounded-lg text-sm hover:bg-brand-dark transition-colors"
            >
              {t('app.retry')}
            </button>
          </div>
        )}

        {/* UI State 4: Success - 5 Approved Category Cards */}
        {!categoriesLoading.value && !categoriesError.value && categories.value.length > 0 && (
          <section class="space-y-3" aria-label="Service Categories">
            {categories.value.map((cat) => {
              const isSelected = selectedCategory.value?.id === cat.id;
              const isDisabled = !cat.isActive || isSelectingCategory.value;

              return (
                <button
                  key={cat.id}
                  onClick={() => selectCategory(cat)}
                  disabled={isDisabled}
                  aria-pressed={isSelected}
                  class={`w-full text-left p-4 rounded-lg border-2 transition-all flex items-center justify-between min-h-[76px] ${
                    !cat.isActive
                      ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-green-50/60 border-action shadow-sm'
                      : 'bg-surface border-border hover:border-brand active:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <div class="flex items-center space-x-3.5 flex-1 pr-2">
                    {/* Category Icon Badge */}
                    <div
                      class={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-action text-white'
                          : !cat.isActive
                          ? 'bg-slate-200 text-slate-400'
                          : 'bg-brand/10 text-brand'
                      }`}
                    >
                      <CategoryIconRenderer iconName={cat.iconName} size={26} />
                    </div>

                    {/* Category Details */}
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-base font-bold text-text-main leading-tight truncate">
                          {getCategoryTitle(cat)}
                        </span>
                        {!cat.isActive && (
                          <span class="text-[11px] font-semibold text-warning bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded ml-2 shrink-0">
                            {t('home.category_unavailable')}
                          </span>
                        )}
                      </div>

                      <p class="text-xs text-text-sub leading-normal mt-0.5 line-clamp-2">
                        {getCategoryDesc(cat)}
                      </p>

                      <div class="text-xs font-semibold text-action mt-1">
                        {t('home.visit_charge', { amount: cat.baseVisitFee })}
                      </div>
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  <div class="shrink-0 pl-1">
                    {isSelected ? (
                      <div class="w-7 h-7 rounded-full bg-action text-white flex items-center justify-center">
                        <CheckIcon size={16} />
                      </div>
                    ) : (
                      <div class="w-7 h-7 rounded-full border-2 border-slate-300 flex items-center justify-center text-slate-300">
                        <span class="text-xs">→</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </section>
        )}

        {/* 4. Support & Direct Booking Call/WhatsApp Bar */}
        <section class="bg-surface border border-border rounded-lg p-4 shadow-sm space-y-3">
          <h3 class="text-xs font-bold text-text-sub uppercase tracking-wider">
            {t('app.help')}
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Direct Call Button */}
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

            {/* Direct WhatsApp Button */}
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
      </main>

      {/* 5. Sticky Bottom Footer */}
      <footer class="bg-surface border-t border-border p-3 max-w-md mx-auto w-full">
        <div class="flex items-center justify-between text-xs text-text-sub">
          <span>{t('app.title')}</span>
          <button
            onClick={() => selectLanguage(lang === 'en' ? 'hi' : 'en')}
            class="text-brand font-semibold hover:underline min-h-[36px] flex items-center px-2"
          >
            {lang === 'en' ? 'हिंदी में बदलें' : 'Switch to English'}
          </button>
        </div>
      </footer>
    </div>
  );
}
