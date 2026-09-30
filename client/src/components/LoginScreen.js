import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { authStep, phoneInput, otpInput, authLoading, authError, mockOtpHint, resendCooldown, requestOtp, verifyOtp, } from '../state/auth';
import { currentLanguage, selectLanguage, t } from '../state/language';
import { SpinnerIcon, AlertCircleIcon } from './icons';
export function LoginScreen() {
    const handlePhoneSubmit = (e) => {
        e.preventDefault();
        requestOtp();
    };
    const handleOtpSubmit = (e) => {
        e.preventDefault();
        verifyOtp();
    };
    return (_jsxs("div", { class: "min-h-screen flex flex-col justify-between bg-background p-4", children: [_jsxs("header", { class: "max-w-md mx-auto w-full flex items-center justify-between py-2", children: [_jsx("div", { class: "font-bold text-brand text-lg", children: t('app.title') }), _jsxs("div", { class: "flex items-center space-x-1 bg-surface p-1 rounded border border-border", children: [_jsx("button", { onClick: () => selectLanguage('en'), class: `px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${currentLanguage.value === 'en'
                                    ? 'bg-brand text-white'
                                    : 'text-text-sub hover:text-text-main'}`, children: "EN" }), _jsx("button", { onClick: () => selectLanguage('hi'), class: `px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${currentLanguage.value === 'hi'
                                    ? 'bg-brand text-white'
                                    : 'text-text-sub hover:text-text-main'}`, children: "\u0939\u093F\u0902\u0926\u0940" })] })] }), _jsx("main", { class: "max-w-md mx-auto w-full my-auto", children: _jsxs("div", { class: "bg-surface border border-border rounded-lg p-6 shadow-sm", children: [_jsxs("div", { class: "text-center mb-6", children: [_jsx("h1", { class: "text-xl font-bold text-text-main leading-snug", children: t('auth.login_title') }), _jsx("p", { class: "text-xs text-text-sub mt-1 leading-relaxed", children: t('app.tagline') })] }), authError.value && (_jsxs("div", { class: "mb-5 p-3 rounded bg-red-50 border border-red-200 flex items-start space-x-2 text-danger text-sm", children: [_jsx(AlertCircleIcon, { size: 18, class: "mt-0.5 shrink-0" }), _jsx("span", { class: "leading-snug", children: authError.value })] })), authStep.value === 'phone' ? (
                        /* STEP 1: Phone Number Input */
                        _jsxs("form", { onSubmit: handlePhoneSubmit, class: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { for: "phone-input", class: "block text-sm font-semibold text-text-main mb-1.5", children: t('auth.phone_label') }), _jsxs("div", { class: "relative flex items-center", children: [_jsx("span", { class: "absolute left-3 text-text-sub font-semibold text-base select-none", children: "+91" }), _jsx("input", { id: "phone-input", type: "tel", inputMode: "tel", maxLength: 10, placeholder: t('auth.phone_placeholder'), value: phoneInput.value, onInput: (e) => {
                                                        const val = e.target.value.replace(/\D/g, '');
                                                        phoneInput.value = val.slice(0, 10);
                                                        authError.value = null;
                                                    }, class: "w-full pl-14 pr-3 py-3 border-2 border-border rounded-lg text-base font-semibold text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]", required: true, autoFocus: true })] })] }), _jsx("button", { type: "submit", disabled: authLoading.value || phoneInput.value.length !== 10, class: `w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-base transition-colors flex items-center justify-center space-x-2 ${phoneInput.value.length === 10 && !authLoading.value
                                        ? 'bg-brand hover:bg-brand-dark text-white cursor-pointer'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`, children: authLoading.value ? (_jsxs(_Fragment, { children: [_jsx(SpinnerIcon, { size: 20, class: "text-white" }), _jsx("span", { children: t('app.loading') })] })) : (_jsx("span", { children: t('auth.send_otp') })) })] })) : (
                        /* STEP 2: OTP Verification */
                        _jsxs("form", { onSubmit: handleOtpSubmit, class: "space-y-4", children: [_jsxs("div", { class: "bg-slate-50 border border-slate-200 rounded p-3 text-xs flex items-center justify-between", children: [_jsx("div", { children: _jsx("span", { class: "text-text-sub", children: t('auth.otp_sent_to', { phone: `+91 ${phoneInput.value}` }) }) }), _jsx("button", { type: "button", onClick: () => {
                                                authStep.value = 'phone';
                                                authError.value = null;
                                            }, class: "text-brand font-semibold hover:underline min-h-[32px] px-2", children: t('auth.change_phone') })] }), mockOtpHint.value && (_jsx("div", { class: "bg-amber-50 border border-amber-200 rounded p-2.5 text-xs text-warning text-center font-medium", children: t('auth.mock_hint', { otp: mockOtpHint.value }) })), _jsxs("div", { children: [_jsx("label", { for: "otp-input", class: "block text-sm font-semibold text-text-main mb-1.5", children: t('auth.otp_label') }), _jsx("input", { id: "otp-input", type: "text", inputMode: "numeric", maxLength: 4, placeholder: t('auth.otp_placeholder'), value: otpInput.value, onInput: (e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                otpInput.value = val.slice(0, 4);
                                                authError.value = null;
                                            }, class: "w-full text-center tracking-widest text-2xl font-bold py-3 border-2 border-border rounded-lg text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]", required: true, autoFocus: true })] }), _jsx("button", { type: "submit", disabled: authLoading.value || otpInput.value.length !== 4, class: `w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-base transition-colors flex items-center justify-center space-x-2 ${otpInput.value.length === 4 && !authLoading.value
                                        ? 'bg-action hover:bg-action-active text-white cursor-pointer'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`, children: authLoading.value ? (_jsxs(_Fragment, { children: [_jsx(SpinnerIcon, { size: 20, class: "text-white" }), _jsx("span", { children: t('app.loading') })] })) : (_jsx("span", { children: t('auth.verify_otp') })) }), _jsx("div", { class: "text-center pt-2", children: resendCooldown.value > 0 ? (_jsxs("span", { class: "text-xs text-text-sub", children: [t('auth.resend_otp'), " (", resendCooldown.value, "s)"] })) : (_jsx("button", { type: "button", onClick: () => requestOtp(), class: "text-xs font-semibold text-brand hover:underline min-h-[36px] px-3", children: t('auth.resend_otp') })) })] }))] }) }), _jsx("footer", { class: "max-w-md mx-auto w-full text-center py-3 text-xs text-text-sub", children: _jsx("span", { children: t('home.service_area_label') }) })] }));
}
