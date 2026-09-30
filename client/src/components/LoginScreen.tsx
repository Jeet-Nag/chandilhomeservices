import {
  authStep,
  phoneInput,
  otpInput,
  authLoading,
  authError,
  mockOtpHint,
  resendCooldown,
  requestOtp,
  verifyOtp,
} from '../state/auth';
import { currentLanguage, selectLanguage, t } from '../state/language';
import { SpinnerIcon, AlertCircleIcon } from './icons';

export function LoginScreen() {
  const handlePhoneSubmit = (e: Event) => {
    e.preventDefault();
    requestOtp();
  };

  const handleOtpSubmit = (e: Event) => {
    e.preventDefault();
    verifyOtp();
  };

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
              {t('auth.login_title')}
            </h1>
            <p class="text-xs text-text-sub mt-1 leading-relaxed">
              {t('app.tagline')}
            </p>
          </div>

          {/* Error Message Box */}
          {authError.value && (
            <div class="mb-5 p-3 rounded bg-red-50 border border-red-200 flex items-start space-x-2 text-danger text-sm">
              <AlertCircleIcon size={18} class="mt-0.5 shrink-0" />
              <span class="leading-snug">{authError.value}</span>
            </div>
          )}

          {authStep.value === 'phone' ? (
            /* STEP 1: Phone Number Input */
            <form onSubmit={handlePhoneSubmit} class="space-y-4">
              <div>
                <label for="phone-input" class="block text-sm font-semibold text-text-main mb-1.5">
                  {t('auth.phone_label')}
                </label>
                <div class="relative flex items-center">
                  <span class="absolute left-3 text-text-sub font-semibold text-base select-none">
                    +91
                  </span>
                  <input
                    id="phone-input"
                    type="tel"
                    inputMode="tel"
                    maxLength={10}
                    placeholder={t('auth.phone_placeholder')}
                    value={phoneInput.value}
                    onInput={(e) => {
                      const val = (e.target as HTMLInputElement).value.replace(/\D/g, '');
                      phoneInput.value = val.slice(0, 10);
                      authError.value = null;
                    }}
                    class="w-full pl-14 pr-3 py-3 border-2 border-border rounded-lg text-base font-semibold text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading.value || phoneInput.value.length !== 10}
                class={`w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-base transition-colors flex items-center justify-center space-x-2 ${
                  phoneInput.value.length === 10 && !authLoading.value
                    ? 'bg-brand hover:bg-brand-dark text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {authLoading.value ? (
                  <>
                    <SpinnerIcon size={20} class="text-white" />
                    <span>{t('app.loading')}</span>
                  </>
                ) : (
                  <span>{t('auth.send_otp')}</span>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: OTP Verification */
            <form onSubmit={handleOtpSubmit} class="space-y-4">
              <div class="bg-slate-50 border border-slate-200 rounded p-3 text-xs flex items-center justify-between">
                <div>
                  <span class="text-text-sub">{t('auth.otp_sent_to', { phone: `+91 ${phoneInput.value}` })}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    authStep.value = 'phone';
                    authError.value = null;
                  }}
                  class="text-brand font-semibold hover:underline min-h-[32px] px-2"
                >
                  {t('auth.change_phone')}
                </button>
              </div>

              {/* Dev Mock OTP Hint */}
              {mockOtpHint.value && (
                <div class="bg-amber-50 border border-amber-200 rounded p-2.5 text-xs text-warning text-center font-medium">
                  {t('auth.mock_hint', { otp: mockOtpHint.value })}
                </div>
              )}

              <div>
                <label for="otp-input" class="block text-sm font-semibold text-text-main mb-1.5">
                  {t('auth.otp_label')}
                </label>
                <input
                  id="otp-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder={t('auth.otp_placeholder')}
                  value={otpInput.value}
                  onInput={(e) => {
                    const val = (e.target as HTMLInputElement).value.replace(/\D/g, '');
                    otpInput.value = val.slice(0, 4);
                    authError.value = null;
                  }}
                  class="w-full text-center tracking-widest text-2xl font-bold py-3 border-2 border-border rounded-lg text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={authLoading.value || otpInput.value.length !== 4}
                class={`w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-base transition-colors flex items-center justify-center space-x-2 ${
                  otpInput.value.length === 4 && !authLoading.value
                    ? 'bg-action hover:bg-action-active text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {authLoading.value ? (
                  <>
                    <SpinnerIcon size={20} class="text-white" />
                    <span>{t('app.loading')}</span>
                  </>
                ) : (
                  <span>{t('auth.verify_otp')}</span>
                )}
              </button>

              <div class="text-center pt-2">
                {resendCooldown.value > 0 ? (
                  <span class="text-xs text-text-sub">
                    {t('auth.resend_otp')} ({resendCooldown.value}s)
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => requestOtp()}
                    class="text-xs font-semibold text-brand hover:underline min-h-[36px] px-3"
                  >
                    {t('auth.resend_otp')}
                  </button>
                )}
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
