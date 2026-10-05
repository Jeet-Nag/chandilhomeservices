import {
  authMode,
  phoneInput,
  fullNameInput,
  authLoading,
  authError,
  authCancelled,
  loginWithPasskey,
  registerPasskey,
} from '../state/auth';
import { currentLanguage, selectLanguage, t } from '../state/language';
import { SpinnerIcon, AlertCircleIcon } from './icons';

export function LoginScreen() {
  const handleLoginSubmit = (e: Event) => {
    e.preventDefault();
    loginWithPasskey();
  };

  const handleRegisterSubmit = (e: Event) => {
    e.preventDefault();
    registerPasskey();
  };

  const isLoginMode = authMode.value === 'login';

  return (
    <div class="min-h-screen flex flex-col justify-between bg-background p-4">
      {/* Header bar with Language Toggle */}
      <header class="max-w-md mx-auto w-full flex items-center justify-between py-2">
        <div class="font-bold text-brand text-lg">{t('app.title')}</div>
        <div class="flex items-center space-x-1 bg-surface p-1 rounded border border-border">
          <button
            onClick={() => selectLanguage('en')}
            class={`px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${
              currentLanguage.value === 'en'
                ? 'bg-brand text-white'
                : 'text-text-sub hover:text-text-main'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => selectLanguage('hi')}
            class={`px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${
              currentLanguage.value === 'hi'
                ? 'bg-brand text-white'
                : 'text-text-sub hover:text-text-main'
            }`}
          >
            हिंदी
          </button>
        </div>
      </header>

      {/* Main Login Card */}
      <main class="max-w-md mx-auto w-full my-auto">
        <div class="bg-surface border border-border rounded-lg p-6 shadow-sm">
          <div class="text-center mb-6">
            <h1 class="text-xl font-bold text-text-main leading-snug">
              {isLoginMode ? t('auth.login_title') : t('auth.register_title')}
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
            /* --- PASSKEY LOGIN FLOW --- */
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
          ) : (
            /* --- PASSKEY REGISTRATION FLOW --- */
            <form onSubmit={handleRegisterSubmit} class="space-y-4">
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
                  {t('auth.name_label')}
                </label>
                <input
                  id="register-name-input"
                  type="text"
                  maxLength={100}
                  placeholder={t('auth.name_placeholder')}
                  value={fullNameInput.value}
                  onInput={(e) => {
                    fullNameInput.value = (e.target as HTMLInputElement).value;
                    authError.value = null;
                  }}
                  class="w-full px-3 py-3 border-2 border-border rounded-lg text-base text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]"
                />
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

              <div class="text-center pt-3 border-t border-border">
                <button
                  type="button"
                  id="switch-to-login-btn"
                  onClick={() => {
                    authMode.value = 'login';
                    authError.value = null;
                    authCancelled.value = false;
                    authLoading.value = false;
                  }}
                  class="text-sm font-semibold text-brand hover:underline min-h-[44px] px-3 py-2"
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
