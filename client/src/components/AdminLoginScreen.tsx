import { useState } from 'preact/hooks';
import {
  loginWithPasskey,
  registerPasskey,
  authLoading,
  authError,
  currentUser,
  logout,
} from '../state/auth';
import { currentLanguage, selectLanguage, t } from '../state/language';
import { SpinnerIcon, AlertCircleIcon, CheckIcon } from './icons';

interface AdminLoginScreenProps {
  onLoginSuccess: () => void;
}

export function AdminLoginScreen({ onLoginSuccess }: AdminLoginScreenProps) {
  const lang = currentLanguage.value || 'en';
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState<'login' | 'setup'>('login');
  const [adminCustomError, setAdminCustomError] = useState<string | null>(null);

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const isValidPhone = /^[6-9]\d{9}$/.test(cleanPhone);

  const handlePhoneChange = (e: any) => {
    const val = (e.target?.value || '').replace(/[^0-9]/g, '').slice(0, 10);
    setPhone(val);
    setAdminCustomError(null);
  };

  const handleAdminLogin = async (e?: Event) => {
    if (e) e.preventDefault();
    setAdminCustomError(null);

    if (!isValidPhone) {
      setAdminCustomError(
        lang === 'hi'
          ? 'कृपया सही 10 अंकों का एडमिन मोबाइल नंबर दर्ज करें।'
          : 'Please enter a valid 10-digit registered admin mobile number.'
      );
      return;
    }

    const success = await loginWithPasskey(cleanPhone);
    if (success) {
      // Validate role boundary immediately
      if (currentUser.value?.role !== 'admin') {
        logout();
        setAdminCustomError(
          lang === 'hi'
            ? 'पहुंच अस्वीकृत: यह खाता एडमिन के रूप में अधिकृत नहीं है।'
            : 'Access Denied: This account does not have administrator privileges.'
        );
        return;
      }
      onLoginSuccess();
    }
  };

  const handleAdminSetup = async (e?: Event) => {
    if (e) e.preventDefault();
    setAdminCustomError(null);

    if (!isValidPhone) {
      setAdminCustomError(
        lang === 'hi'
          ? 'कृपया सही 10 अंकों का एडमिन मोबाइल नंबर दर्ज करें।'
          : 'Please enter a valid 10-digit registered admin mobile number.'
      );
      return;
    }

    const success = await registerPasskey(cleanPhone, 'Chandil Admin', undefined);
    if (success) {
      // Validate role boundary immediately
      if (currentUser.value?.role !== 'admin') {
        logout();
        setAdminCustomError(
          lang === 'hi'
            ? 'पहुंच अस्वीकृत: यह खाता एडमिन के रूप में अधिकृत नहीं है।'
            : 'Access Denied: This account does not have administrator privileges.'
        );
        return;
      }
      onLoginSuccess();
    }
  };

  return (
    <div class="min-h-screen flex flex-col justify-between bg-slate-100 text-text-main p-4">
      {/* Top Bar with Language Toggle */}
      <header class="max-w-md mx-auto w-full flex items-center justify-between py-3">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center font-bold text-sm shadow-xs">
            C
          </div>
          <span class="font-bold text-brand text-base tracking-tight">Chandil Home Services</span>
        </div>

        <div class="flex items-center bg-white rounded-lg p-0.5 border border-border shadow-xs">
          <button
            type="button"
            onClick={() => selectLanguage('en')}
            class={`px-3 py-1 text-xs font-semibold rounded min-h-[36px] transition-colors ${
              lang === 'en' ? 'bg-brand text-white' : 'text-text-sub hover:text-text-main'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => selectLanguage('hi')}
            class={`px-3 py-1 text-xs font-semibold rounded min-h-[36px] transition-colors ${
              lang === 'hi' ? 'bg-brand text-white' : 'text-text-sub hover:text-text-main'
            }`}
          >
            हिंदी
          </button>
        </div>
      </header>

      {/* Main Administrative Card */}
      <main class="max-w-md mx-auto w-full my-auto">
        <div class="bg-surface border border-border rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
          <div class="text-center space-y-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 uppercase tracking-wider">
              {lang === 'hi' ? 'केवल अधिकृत एडमिन' : 'ADMINISTRATOR ACCESS ONLY'}
            </span>
            <h1 class="text-2xl font-bold text-text-main tracking-tight pt-1">
              {lang === 'hi' ? 'एडमिन संचालन केंद्र' : 'Operations Control Center'}
            </h1>
            <p class="text-xs text-text-sub">
              {lang === 'hi'
                ? 'चंडिल होम सर्विसेज प्रबंधन पोर्टल में प्रवेश करें।'
                : 'Secure administrative portal for Chandil Home Services.'}
            </p>
          </div>

          {/* Error Banner */}
          {(adminCustomError || authError.value) && (
            <div class="p-3.5 rounded-lg bg-red-50 border border-red-200 text-danger text-xs flex items-start gap-2.5">
              <AlertCircleIcon size={18} class="shrink-0 mt-0.5 text-danger" />
              <div class="flex-1 font-medium leading-relaxed">
                {adminCustomError || authError.value}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={mode === 'login' ? handleAdminLogin : handleAdminSetup} class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-2">
                {lang === 'hi' ? 'पंजीकृत एडमिन मोबाइल नंबर' : 'Registered Admin Mobile Number'}
              </label>
              <div class="relative flex items-center">
                <span class="absolute left-3.5 text-sm font-semibold text-text-sub select-none">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={phone}
                  onInput={handlePhoneChange}
                  placeholder="98XXXXXXXX"
                  maxLength={10}
                  autofocus
                  disabled={authLoading.value}
                  class="w-full pl-14 pr-4 py-3 min-h-[48px] bg-white border border-border rounded-lg text-sm font-medium text-text-main placeholder-slate-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
                />
              </div>
              <p class="text-[11px] text-text-sub mt-1.5">
                {lang === 'hi'
                  ? 'केवल डेटाबेस में अधिकृत एडमिन फोन नंबर ही लॉगिन कर सकते हैं।'
                  : 'Only authorized administrator phone numbers in the database can sign in.'}
              </p>
            </div>

            {/* Action Buttons */}
            {mode === 'login' ? (
              <div class="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={authLoading.value || !isValidPhone}
                  class={`w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-sm text-white flex items-center justify-center gap-2 transition-all shadow-xs ${
                    isValidPhone && !authLoading.value
                      ? 'bg-brand hover:bg-brand-dark active:bg-slate-900 cursor-pointer'
                      : 'bg-slate-400 cursor-not-allowed opacity-75'
                  }`}
                >
                  {authLoading.value ? (
                    <>
                      <SpinnerIcon size={18} class="animate-spin text-white" />
                      <span>{lang === 'hi' ? 'सत्यापन हो रहा है...' : 'Verifying...'}</span>
                    </>
                  ) : (
                    <span>{lang === 'hi' ? 'एडमिन पासकी से साइन इन करें' : 'Sign In with Admin Passkey'}</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('setup');
                    setAdminCustomError(null);
                  }}
                  disabled={authLoading.value}
                  class="w-full min-h-[40px] px-3 py-2 text-xs font-semibold text-text-sub hover:text-brand hover:underline transition-colors"
                >
                  {lang === 'hi'
                    ? 'इस डिवाइस पर पहली बार हैं? पासकी सेटअप करें'
                    : 'First time on this device? Setup Admin Passkey'}
                </button>
              </div>
            ) : (
              <div class="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={authLoading.value || !isValidPhone}
                  class={`w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-sm text-white flex items-center justify-center gap-2 transition-all shadow-xs ${
                    isValidPhone && !authLoading.value
                      ? 'bg-action hover:bg-action-active cursor-pointer'
                      : 'bg-slate-400 cursor-not-allowed opacity-75'
                  }`}
                >
                  {authLoading.value ? (
                    <>
                      <SpinnerIcon size={18} class="animate-spin text-white" />
                      <span>{lang === 'hi' ? 'पासकी बनाई जा रही है...' : 'Creating Passkey...'}</span>
                    </>
                  ) : (
                    <span>{lang === 'hi' ? 'इस डिवाइस पर एडमिन पासकी बनाएं' : 'Create Admin Device Passkey'}</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setAdminCustomError(null);
                  }}
                  disabled={authLoading.value}
                  class="w-full min-h-[40px] px-3 py-2 text-xs font-semibold text-text-sub hover:text-brand hover:underline transition-colors"
                >
                  {lang === 'hi' ? '← लॉगिन पर वापस जाएं' : '← Back to Sign In'}
                </button>
              </div>
            )}
          </form>

          {/* Security Assurance */}
          <div class="pt-4 border-t border-border/60 text-center">
            <p class="text-[11px] text-text-sub flex items-center justify-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-action inline-block"></span>
              <span>WebAuthn FIDO2 Protected / सुरक्षित बायोमेट्रिक सत्यापन</span>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer class="max-w-md mx-auto w-full text-center py-4 text-xs text-text-sub">
        <span>Chandil Home Services &copy; 2026. All rights reserved.</span>
      </footer>
    </div>
  );
}
