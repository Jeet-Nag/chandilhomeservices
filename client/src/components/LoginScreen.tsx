import {
  authMode,
  selectedOnboardingRole,
  phoneInput,
  fullNameInput,
  authLoading,
  authError,
  authCancelled,
  loginWithPasskey,
  registerPasskey,
} from '../state/auth';
import { currentLanguage, selectLanguage, t } from '../state/language';
import { SpinnerIcon, AlertCircleIcon, ChevronRightIcon } from './icons';

export function LoginScreen() {
  const isLoginMode = authMode.value === 'login';
  const role = selectedOnboardingRole.value;
  const lang = currentLanguage.value || 'en';

  const handleLoginSubmit = (e: Event) => {
    e.preventDefault();
    loginWithPasskey();
  };

  const handleCustomerRegisterSubmit = (e: Event) => {
    e.preventDefault();
    registerPasskey(phoneInput.value, fullNameInput.value, 'customer');
  };

  const handleWorkerRegisterSubmit = (e: Event) => {
    e.preventDefault();
    registerPasskey(phoneInput.value, undefined, 'worker');
  };

  return (
    <div class="min-h-screen flex flex-col justify-between bg-background p-4">
      {/* Header bar with Language Toggle */}
      <header class="max-w-md mx-auto w-full flex items-center justify-between py-2">
        <div class="font-bold text-brand text-lg">{t('app.title')}</div>
        <div class="flex items-center space-x-1 bg-surface p-1 rounded border border-border">
          <button
            type="button"
            onClick={() => selectLanguage('en')}
            class={`px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${
              lang === 'en'
                ? 'bg-brand text-white'
                : 'text-text-sub hover:text-text-main'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => selectLanguage('hi')}
            class={`px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${
              lang === 'hi'
                ? 'bg-brand text-white'
                : 'text-text-sub hover:text-text-main'
            }`}
          >
            हिंदी
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main class="max-w-md mx-auto w-full my-auto">
        <div class="bg-surface border border-border rounded-lg p-6 shadow-sm">
          {/* Card Header */}
          <div class="text-center mb-6">
            <h1 class="text-xl font-bold text-text-main leading-snug">
              {isLoginMode
                ? t('auth.login_title')
                : role === 'customer'
                ? t('onboarding.customer_title')
                : role === 'worker'
                ? t('onboarding.worker_title')
                : t('onboarding.role_title')}
            </h1>
            <p class="text-xs text-text-sub mt-1 leading-relaxed">
              {t('app.tagline')}
            </p>
          </div>

          {/* Error Message Box with Cancellation Retry */}
          {authError.value && (
            <div class="mb-5 p-3 rounded bg-red-50 border border-red-200 flex flex-col space-y-2 text-danger text-sm">
              <div class="flex items-start space-x-2">
                <AlertCircleIcon size={18} class="mt-0.5 shrink-0" />
                <span class="leading-snug">{authError.value}</span>
              </div>
              {authCancelled.value && (
                <button
                  type="button"
                  onClick={() => {
                    authError.value = null;
                    authCancelled.value = false;
                    if (isLoginMode) {
                      loginWithPasskey();
                    } else if (role === 'customer') {
                      registerPasskey(phoneInput.value, fullNameInput.value, 'customer');
                    } else if (role === 'worker') {
                      registerPasskey(phoneInput.value, undefined, 'worker');
                    } else {
                      registerPasskey();
                    }
                  }}
                  class="self-start text-xs font-semibold text-brand underline min-h-[36px] px-2 py-1"
                >
                  {t('auth.retry')}
                </button>
              )}
            </div>
          )}

          {isLoginMode ? (
            /* ============================================================ */
            /* 1. PASSKEY LOGIN FLOW                                        */
            /* ============================================================ */
            <form onSubmit={handleLoginSubmit} class="space-y-4">
              <div>
                <label for="login-phone-input" class="block text-sm font-semibold text-text-main mb-1.5">
                  {t('auth.phone_label')}
                </label>
                <div class="relative flex items-center">
                  <span class="absolute left-3 text-text-sub font-semibold text-base select-none">
                    +91
                  </span>
                  <input
                    id="login-phone-input"
                    type="tel"
                    inputMode="tel"
                    maxLength={10}
                    placeholder={t('auth.phone_optional_placeholder')}
                    value={phoneInput.value}
                    onInput={(e) => {
                      const val = (e.target as HTMLInputElement).value.replace(/\D/g, '');
                      phoneInput.value = val.slice(0, 10);
                      authError.value = null;
                      authCancelled.value = false;
                    }}
                    class="w-full pl-14 pr-3 py-3 border-2 border-border rounded-lg text-base font-semibold text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="passkey-login-btn"
                disabled={authLoading.value}
                class={`w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-base transition-colors flex items-center justify-center space-x-2 ${
                  !authLoading.value
                    ? 'bg-brand hover:bg-brand-dark text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {authLoading.value ? (
                  <>
                    <SpinnerIcon size={20} class="text-white" />
                    <span>{t('auth.authenticating')}</span>
                  </>
                ) : (
                  <span>{t('auth.login_button')}</span>
                )}
              </button>

              <div class="text-center pt-3 border-t border-border">
                <button
                  type="button"
                  id="switch-to-register-btn"
                  onClick={() => {
                    authMode.value = 'register';
                    selectedOnboardingRole.value = null;
                    authError.value = null;
                    authCancelled.value = false;
                    authLoading.value = false;
                  }}
                  class="text-sm font-semibold text-brand hover:underline min-h-[44px] px-3 py-2"
                >
                  {t('auth.switch_to_register')}
                </button>
              </div>
            </form>
          ) : role === null ? (
            /* ============================================================ */
            /* 2. SCREEN 1 — ROLE SELECTION ("Who are you?" / "आप कौन हैं?")*/
            /* ============================================================ */
            <div class="space-y-4">
              <button
                type="button"
                id="role-select-customer-btn"
                onClick={() => {
                  selectedOnboardingRole.value = 'customer';
                  authError.value = null;
                  authCancelled.value = false;
                }}
                class="w-full min-h-[56px] flex items-center justify-between p-4 border-2 border-border hover:border-brand active:bg-slate-50 rounded-lg text-left transition-colors bg-white group focus:outline-none focus:border-brand"
              >
                <div>
                  <div class="text-base font-bold text-text-main group-hover:text-brand">
                    {t('onboarding.role_customer')}
                  </div>
                  <div class="text-xs text-text-sub mt-0.5">
                    {t('onboarding.role_customer_sub')}
                  </div>
                </div>
                <span class="text-brand font-bold text-lg">→</span>
              </button>

              <button
                type="button"
                id="role-select-worker-btn"
                onClick={() => {
                  selectedOnboardingRole.value = 'worker';
                  authError.value = null;
                  authCancelled.value = false;
                }}
                class="w-full min-h-[56px] flex items-center justify-between p-4 border-2 border-border hover:border-brand active:bg-slate-50 rounded-lg text-left transition-colors bg-white group focus:outline-none focus:border-brand"
              >
                <div>
                  <div class="text-base font-bold text-text-main group-hover:text-brand">
                    {t('onboarding.role_worker')}
                  </div>
                  <div class="text-xs text-text-sub mt-0.5">
                    {t('onboarding.role_worker_sub')}
                  </div>
                </div>
                <span class="text-brand font-bold text-lg">→</span>
              </button>

              <div class="text-center pt-3 border-t border-border">
                <button
                  type="button"
                  id="switch-to-login-btn"
                  onClick={() => {
                    authMode.value = 'login';
                    selectedOnboardingRole.value = null;
                    authError.value = null;
                    authCancelled.value = false;
                  }}
                  class="text-sm font-semibold text-brand hover:underline min-h-[44px] px-3 py-2"
                >
                  {t('onboarding.returning_user_sign_in')}
                </button>
              </div>
            </div>
          ) : role === 'customer' ? (
            /* ============================================================ */
            /* 3. CUSTOMER REGISTRATION (Mobile + Full Name REQUIRED)       */
            /* ============================================================ */
            <form onSubmit={handleCustomerRegisterSubmit} class="space-y-4">
              <div>
                <label for="register-phone-input" class="block text-sm font-semibold text-text-main mb-1.5">
                  {t('auth.phone_label')} *
                </label>
                <div class="relative flex items-center">
                  <span class="absolute left-3 text-text-sub font-semibold text-base select-none">
                    +91
                  </span>
                  <input
                    id="register-phone-input"
                    type="tel"
                    inputMode="tel"
                    maxLength={10}
                    placeholder={t('auth.phone_placeholder')}
                    value={phoneInput.value}
                    onInput={(e) => {
                      const val = (e.target as HTMLInputElement).value.replace(/\D/g, '');
                      phoneInput.value = val.slice(0, 10);
                      authError.value = null;
                      authCancelled.value = false;
                    }}
                    class="w-full pl-14 pr-3 py-3 border-2 border-border rounded-lg text-base font-semibold text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label for="register-name-input" class="block text-sm font-semibold text-text-main mb-1.5">
                  {t('onboarding.full_name_required')}
                </label>
                <input
                  id="register-name-input"
                  type="text"
                  maxLength={100}
                  placeholder={t('onboarding.full_name_placeholder')}
                  value={fullNameInput.value}
                  onInput={(e) => {
                    fullNameInput.value = (e.target as HTMLInputElement).value;
                    authError.value = null;
                  }}
                  class="w-full px-3 py-3 border-2 border-border rounded-lg text-base text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]"
                  required
                />
              </div>

              <button
                type="submit"
                id="passkey-register-btn"
                disabled={
                  authLoading.value ||
                  phoneInput.value.length !== 10 ||
                  fullNameInput.value.trim().length === 0
                }
                class={`w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-base transition-colors flex items-center justify-center space-x-2 ${
                  phoneInput.value.length === 10 &&
                  fullNameInput.value.trim().length > 0 &&
                  !authLoading.value
                    ? 'bg-action hover:bg-action-active text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {authLoading.value ? (
                  <>
                    <SpinnerIcon size={20} class="text-white" />
                    <span>{t('auth.registering')}</span>
                  </>
                ) : (
                  <span>{t('onboarding.customer_create_passkey')}</span>
                )}
              </button>

              <div class="flex items-center justify-between pt-3 border-t border-border text-xs font-semibold">
                <button
                  type="button"
                  id="back-to-roles-btn"
                  onClick={() => {
                    selectedOnboardingRole.value = null;
                    authError.value = null;
                  }}
                  class="text-text-sub hover:text-text-main min-h-[44px] px-2 py-2 flex items-center space-x-1"
                >
                  <span>← {lang === 'hi' ? 'वापस जाएं' : 'Back'}</span>
                </button>

                <button
                  type="button"
                  id="switch-to-login-btn"
                  onClick={() => {
                    authMode.value = 'login';
                    selectedOnboardingRole.value = null;
                    authError.value = null;
                    authCancelled.value = false;
                  }}
                  class="text-brand hover:underline min-h-[44px] px-2 py-2"
                >
                  {t('auth.switch_to_login')}
                </button>
              </div>
            </form>
          ) : (
            /* ============================================================ */
            /* 4. WORKER REGISTRATION (Step 1 - Mobile + Passkey)           */
            /* ============================================================ */
            <form onSubmit={handleWorkerRegisterSubmit} class="space-y-4">
              <div>
                <label for="register-phone-input" class="block text-sm font-semibold text-text-main mb-1.5">
                  {t('auth.phone_label')} *
                </label>
                <div class="relative flex items-center">
                  <span class="absolute left-3 text-text-sub font-semibold text-base select-none">
                    +91
                  </span>
                  <input
                    id="register-phone-input"
                    type="tel"
                    inputMode="tel"
                    maxLength={10}
                    placeholder={t('auth.phone_placeholder')}
                    value={phoneInput.value}
                    onInput={(e) => {
                      const val = (e.target as HTMLInputElement).value.replace(/\D/g, '');
                      phoneInput.value = val.slice(0, 10);
                      authError.value = null;
                      authCancelled.value = false;
                    }}
                    class="w-full pl-14 pr-3 py-3 border-2 border-border rounded-lg text-base font-semibold text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                id="passkey-register-btn"
                disabled={authLoading.value || phoneInput.value.length !== 10}
                class={`w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-base transition-colors flex items-center justify-center space-x-2 ${
                  phoneInput.value.length === 10 && !authLoading.value
                    ? 'bg-action hover:bg-action-active text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {authLoading.value ? (
                  <>
                    <SpinnerIcon size={20} class="text-white" />
                    <span>{t('auth.registering')}</span>
                  </>
                ) : (
                  <span>{t('auth.register_button')}</span>
                )}
              </button>

              <div class="flex items-center justify-between pt-3 border-t border-border text-xs font-semibold">
                <button
                  type="button"
                  id="back-to-roles-btn"
                  onClick={() => {
                    selectedOnboardingRole.value = null;
                    authError.value = null;
                  }}
                  class="text-text-sub hover:text-text-main min-h-[44px] px-2 py-2 flex items-center space-x-1"
                >
                  <span>← {lang === 'hi' ? 'वापस जाएं' : 'Back'}</span>
                </button>

                <button
                  type="button"
                  id="switch-to-login-btn"
                  onClick={() => {
                    authMode.value = 'login';
                    selectedOnboardingRole.value = null;
                    authError.value = null;
                    authCancelled.value = false;
                  }}
                  class="text-brand hover:underline min-h-[44px] px-2 py-2"
                >
                  {t('auth.switch_to_login')}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Footer info */}
      <footer class="max-w-md mx-auto w-full text-center py-3 text-xs text-text-sub">
        <span>{t('home.service_area_label')}</span>
      </footer>
    </div>
  );
}
