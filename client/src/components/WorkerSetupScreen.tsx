import { useEffect } from 'preact/hooks';
import {
  workerFullName,
  workerCategoryId,
  aadhaarFront,
  aadhaarBack,
  workerPhoto,
  isSubmittingWorker,
  workerSubmitError,
  submitWorkerOnboarding,
} from '../state/worker';
import { categories, fetchCategories } from '../state/categories';
import { currentUser, logout } from '../state/auth';
import { currentLanguage, selectLanguage, t } from '../state/language';
import { DocumentUploadCard } from './DocumentUploadCard';
import { SpinnerIcon, AlertCircleIcon, LogOutIcon } from './icons';
import { INITIAL_SERVICE_CATEGORIES } from '@shared';

export function WorkerSetupScreen() {
  const lang = currentLanguage.value || 'en';

  useEffect(() => {
    if (categories.value.length === 0) {
      fetchCategories();
    }
  }, []);

  // Use loaded categories or fallback to INITIAL_SERVICE_CATEGORIES
  const availableCategories = categories.value.length > 0 ? categories.value : INITIAL_SERVICE_CATEGORIES;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    await submitWorkerOnboarding();
  };

  return (
    <div class="min-h-screen flex flex-col bg-background">
      {/* 1. Header Bar */}
      <header class="bg-brand text-white px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div class="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 class="text-base font-bold leading-tight">{t('app.title')}</h1>
            <p class="text-xs text-slate-300 leading-tight">{t('onboarding.worker_title')}</p>
          </div>

          <div class="flex items-center space-x-2">
            {/* Language toggle */}
            <div class="flex items-center bg-brand-dark p-0.5 rounded border border-slate-600">
              <button
                type="button"
                onClick={() => selectLanguage('en')}
                class={`px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${
                  lang === 'en' ? 'bg-action text-white' : 'text-slate-300 hover:text-white'
                }`}
                aria-label="Switch to English"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => selectLanguage('hi')}
                class={`px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${
                  lang === 'hi' ? 'bg-action text-white' : 'text-slate-300 hover:text-white'
                }`}
                aria-label="हिंदी भाषा चुनें"
              >
                हिंदी
              </button>
            </div>

            {/* Logout button */}
            <button
              type="button"
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

      {/* 2. Main Form Body */}
      <main class="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        {/* Intro Banner */}
        <section class="bg-surface border border-border rounded-lg p-5 shadow-xs">
          <h2 class="text-lg font-bold text-text-main leading-tight">
            {t('onboarding.worker_setup_title')}
          </h2>
          <p class="text-xs text-text-sub mt-1 leading-relaxed">
            {t('onboarding.worker_setup_sub')}
          </p>
          {currentUser.value && (
            <div class="mt-2 text-xs font-semibold text-text-main bg-slate-100 px-2.5 py-1 rounded inline-block">
              {t('auth.logged_in_as', { phone: `+91 ${currentUser.value.phone}` })}
            </div>
          )}
        </section>

        {/* Error Notification */}
        {workerSubmitError.value && (
          <div class="p-3.5 rounded-lg bg-red-50 border border-red-200 text-danger text-sm flex items-start space-x-2.5 shadow-xs">
            <AlertCircleIcon size={18} class="mt-0.5 shrink-0" />
            <span class="leading-snug">{workerSubmitError.value}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} class="space-y-4">
          {/* Field 1: Full Name */}
          <div class="bg-surface border border-border rounded-lg p-4 space-y-2">
            <label for="worker-fullname-input" class="block text-sm font-bold text-text-main">
              {t('onboarding.full_name_required')}
            </label>
            <input
              id="worker-fullname-input"
              type="text"
              required
              maxLength={100}
              placeholder={t('onboarding.full_name_placeholder')}
              value={workerFullName.value}
              onInput={(e) => {
                workerFullName.value = (e.target as HTMLInputElement).value;
                workerSubmitError.value = null;
              }}
              class="w-full px-3.5 py-3 border-2 border-border rounded-lg text-base text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]"
            />
          </div>

          {/* Field 2: Work Category */}
          <div class="bg-surface border border-border rounded-lg p-4 space-y-2">
            <label for="worker-category-select" class="block text-sm font-bold text-text-main">
              {t('onboarding.work_category_label')}
            </label>
            <select
              id="worker-category-select"
              required
              value={workerCategoryId.value}
              onChange={(e) => {
                workerCategoryId.value = (e.target as HTMLSelectElement).value;
                workerSubmitError.value = null;
              }}
              class="w-full px-3.5 py-3 border-2 border-border rounded-lg text-base text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]"
            >
              <option value="" disabled>
                -- {t('onboarding.select_category_prompt')} --
              </option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {lang === 'hi' ? cat.titleHi : cat.titleEn}
                </option>
              ))}
            </select>
          </div>

          {/* Field 3: Aadhaar Front */}
          <DocumentUploadCard
            title={t('onboarding.aadhaar_front_label')}
            subtitle={lang === 'hi' ? 'आधार कार्ड के सामने का स्पष्ट फोटो' : 'Clear photo of Aadhaar front'}
            imageState={aadhaarFront.value}
            onImageSelected={(st) => {
              aadhaarFront.value = st;
              workerSubmitError.value = null;
            }}
            onRetake={() => {
              aadhaarFront.value = null;
            }}
            isPhoto={false}
            required
          />

          {/* Field 4: Aadhaar Back */}
          <DocumentUploadCard
            title={t('onboarding.aadhaar_back_label')}
            subtitle={lang === 'hi' ? 'आधार कार्ड के पीछे का स्पष्ट फोटो' : 'Clear photo of Aadhaar back'}
            imageState={aadhaarBack.value}
            onImageSelected={(st) => {
              aadhaarBack.value = st;
              workerSubmitError.value = null;
            }}
            onRetake={() => {
              aadhaarBack.value = null;
            }}
            isPhoto={false}
            required
          />

          {/* Field 5: Worker Photo */}
          <DocumentUploadCard
            title={t('onboarding.photo_title')}
            subtitle={t('onboarding.photo_sub')}
            imageState={workerPhoto.value}
            onImageSelected={(st) => {
              workerPhoto.value = st;
              workerSubmitError.value = null;
            }}
            onRetake={() => {
              workerPhoto.value = null;
            }}
            isPhoto={true}
            required
          />

          {/* Field 6: Submit Profile Button */}
          <div class="pt-2">
            <button
              type="submit"
              id="worker-submit-btn"
              disabled={isSubmittingWorker.value}
              class={`w-full min-h-[48px] px-6 py-3.5 font-bold rounded-lg text-base transition-colors flex items-center justify-center space-x-2 shadow-sm ${
                !isSubmittingWorker.value
                  ? 'bg-action hover:bg-action-active text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSubmittingWorker.value ? (
                <>
                  <SpinnerIcon size={20} class="text-white" />
                  <span>{t('onboarding.submitting_profile')}</span>
                </>
              ) : (
                <span>{t('onboarding.btn_submit_profile')}</span>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer class="bg-surface border-t border-border p-3 max-w-md mx-auto w-full text-center text-xs text-text-sub">
        <span>{t('home.service_area_label')}</span>
      </footer>
    </div>
  );
}
