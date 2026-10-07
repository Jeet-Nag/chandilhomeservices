import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { authMode, selectedOnboardingRole, phoneInput, fullNameInput, authLoading, authError, authCancelled, loginWithPasskey, registerPasskey, } from '../state/auth';
import { currentLanguage, selectLanguage, t } from '../state/language';
import { SpinnerIcon, AlertCircleIcon } from './icons';
export function LoginScreen() {
    const isLoginMode = authMode.value === 'login';
    const role = selectedOnboardingRole.value;
    const lang = currentLanguage.value || 'en';
    const handleLoginSubmit = (e) => {
        e.preventDefault();
        loginWithPasskey();
    };
    const handleCustomerRegisterSubmit = (e) => {
        e.preventDefault();
        registerPasskey(phoneInput.value, fullNameInput.value, 'customer');
    };
    const handleWorkerRegisterSubmit = (e) => {
        e.preventDefault();
        registerPasskey(phoneInput.value, undefined, 'worker');
    };
    return (_jsxs("div", { class: "min-h-screen flex flex-col justify-between bg-background p-4", children: [_jsxs("header", { class: "max-w-md mx-auto w-full flex items-center justify-between py-2", children: [_jsx("div", { class: "font-bold text-brand text-lg", children: t('app.title') }), _jsxs("div", { class: "flex items-center space-x-1 bg-surface p-1 rounded border border-border", children: [_jsx("button", { type: "button", onClick: () => selectLanguage('en'), class: `px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${lang === 'en'
                                    ? 'bg-brand text-white'
                                    : 'text-text-sub hover:text-text-main'}`, children: "EN" }), _jsx("button", { type: "button", onClick: () => selectLanguage('hi'), class: `px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${lang === 'hi'
                                    ? 'bg-brand text-white'
                                    : 'text-text-sub hover:text-text-main'}`, children: "\u0939\u093F\u0902\u0926\u0940" })] })] }), _jsx("main", { class: "max-w-md mx-auto w-full my-auto", children: _jsxs("div", { class: "bg-surface border border-border rounded-lg p-6 shadow-sm", children: [_jsxs("div", { class: "text-center mb-6", children: [_jsx("h1", { class: "text-xl font-bold text-text-main leading-snug", children: isLoginMode
                                        ? t('auth.login_title')
                                        : role === 'customer'
                                            ? t('onboarding.customer_title')
                                            : role === 'worker'
                                                ? t('onboarding.worker_title')
                                                : t('onboarding.role_title') }), _jsx("p", { class: "text-xs text-text-sub mt-1 leading-relaxed", children: t('app.tagline') })] }), authError.value && (_jsxs("div", { class: "mb-5 p-3 rounded bg-red-50 border border-red-200 flex flex-col space-y-2 text-danger text-sm", children: [_jsxs("div", { class: "flex items-start space-x-2", children: [_jsx(AlertCircleIcon, { size: 18, class: "mt-0.5 shrink-0" }), _jsx("span", { class: "leading-snug", children: authError.value })] }), authCancelled.value && (_jsx("button", { type: "button", onClick: () => {
                                        authError.value = null;
                                        authCancelled.value = false;
                                        if (isLoginMode) {
                                            loginWithPasskey();
                                        }
                                        else if (role === 'customer') {
                                            registerPasskey(phoneInput.value, fullNameInput.value, 'customer');
                                        }
                                        else if (role === 'worker') {
                                            registerPasskey(phoneInput.value, undefined, 'worker');
                                        }
                                        else {
                                            registerPasskey();
                                        }
                                    }, class: "self-start text-xs font-semibold text-brand underline min-h-[36px] px-2 py-1", children: t('auth.retry') }))] })), isLoginMode ? (
                        /* ============================================================ */
                        /* 1. PASSKEY LOGIN FLOW                                        */
                        /* ============================================================ */
                        _jsxs("form", { onSubmit: handleLoginSubmit, class: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { for: "login-phone-input", class: "block text-sm font-semibold text-text-main mb-1.5", children: t('auth.phone_label') }), _jsxs("div", { class: "relative flex items-center", children: [_jsx("span", { class: "absolute left-3 text-text-sub font-semibold text-base select-none", children: "+91" }), _jsx("input", { id: "login-phone-input", type: "tel", inputMode: "tel", maxLength: 10, placeholder: t('auth.phone_optional_placeholder'), value: phoneInput.value, onInput: (e) => {
                                                        const val = e.target.value.replace(/\D/g, '');
                                                        phoneInput.value = val.slice(0, 10);
                                                        authError.value = null;
                                                        authCancelled.value = false;
                                                    }, class: "w-full pl-14 pr-3 py-3 border-2 border-border rounded-lg text-base font-semibold text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]" })] })] }), _jsx("button", { type: "submit", id: "passkey-login-btn", disabled: authLoading.value, class: `w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-base transition-colors flex items-center justify-center space-x-2 ${!authLoading.value
                                        ? 'bg-brand hover:bg-brand-dark text-white cursor-pointer'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`, children: authLoading.value ? (_jsxs(_Fragment, { children: [_jsx(SpinnerIcon, { size: 20, class: "text-white" }), _jsx("span", { children: t('auth.authenticating') })] })) : (_jsx("span", { children: t('auth.login_button') })) }), _jsx("div", { class: "text-center pt-3 border-t border-border", children: _jsx("button", { type: "button", id: "switch-to-register-btn", onClick: () => {
                                            authMode.value = 'register';
                                            selectedOnboardingRole.value = null;
                                            authError.value = null;
                                            authCancelled.value = false;
                                            authLoading.value = false;
                                        }, class: "text-sm font-semibold text-brand hover:underline min-h-[44px] px-3 py-2", children: t('auth.switch_to_register') }) })] })) : role === null ? (
                        /* ============================================================ */
                        /* 2. SCREEN 1 — ROLE SELECTION ("Who are you?" / "आप कौन हैं?")*/
                        /* ============================================================ */
                        _jsxs("div", { class: "space-y-4", children: [_jsxs("button", { type: "button", id: "role-select-customer-btn", onClick: () => {
                                        selectedOnboardingRole.value = 'customer';
                                        authError.value = null;
                                        authCancelled.value = false;
                                    }, class: "w-full min-h-[56px] flex items-center justify-between p-4 border-2 border-border hover:border-brand active:bg-slate-50 rounded-lg text-left transition-colors bg-white group focus:outline-none focus:border-brand", children: [_jsxs("div", { children: [_jsx("div", { class: "text-base font-bold text-text-main group-hover:text-brand", children: t('onboarding.role_customer') }), _jsx("div", { class: "text-xs text-text-sub mt-0.5", children: t('onboarding.role_customer_sub') })] }), _jsx("span", { class: "text-brand font-bold text-lg", children: "\u2192" })] }), _jsxs("button", { type: "button", id: "role-select-worker-btn", onClick: () => {
                                        selectedOnboardingRole.value = 'worker';
                                        authError.value = null;
                                        authCancelled.value = false;
                                    }, class: "w-full min-h-[56px] flex items-center justify-between p-4 border-2 border-border hover:border-brand active:bg-slate-50 rounded-lg text-left transition-colors bg-white group focus:outline-none focus:border-brand", children: [_jsxs("div", { children: [_jsx("div", { class: "text-base font-bold text-text-main group-hover:text-brand", children: t('onboarding.role_worker') }), _jsx("div", { class: "text-xs text-text-sub mt-0.5", children: t('onboarding.role_worker_sub') })] }), _jsx("span", { class: "text-brand font-bold text-lg", children: "\u2192" })] }), _jsx("div", { class: "text-center pt-3 border-t border-border", children: _jsx("button", { type: "button", id: "switch-to-login-btn", onClick: () => {
                                            authMode.value = 'login';
                                            selectedOnboardingRole.value = null;
                                            authError.value = null;
                                            authCancelled.value = false;
                                        }, class: "text-sm font-semibold text-brand hover:underline min-h-[44px] px-3 py-2", children: t('onboarding.returning_user_sign_in') }) })] })) : role === 'customer' ? (
                        /* ============================================================ */
                        /* 3. CUSTOMER REGISTRATION (Mobile + Full Name REQUIRED)       */
                        /* ============================================================ */
                        _jsxs("form", { onSubmit: handleCustomerRegisterSubmit, class: "space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { for: "register-phone-input", class: "block text-sm font-semibold text-text-main mb-1.5", children: [t('auth.phone_label'), " *"] }), _jsxs("div", { class: "relative flex items-center", children: [_jsx("span", { class: "absolute left-3 text-text-sub font-semibold text-base select-none", children: "+91" }), _jsx("input", { id: "register-phone-input", type: "tel", inputMode: "tel", maxLength: 10, placeholder: t('auth.phone_placeholder'), value: phoneInput.value, onInput: (e) => {
                                                        const val = e.target.value.replace(/\D/g, '');
                                                        phoneInput.value = val.slice(0, 10);
                                                        authError.value = null;
                                                        authCancelled.value = false;
                                                    }, class: "w-full pl-14 pr-3 py-3 border-2 border-border rounded-lg text-base font-semibold text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]", required: true, autoFocus: true })] })] }), _jsxs("div", { children: [_jsx("label", { for: "register-name-input", class: "block text-sm font-semibold text-text-main mb-1.5", children: t('onboarding.full_name_required') }), _jsx("input", { id: "register-name-input", type: "text", maxLength: 100, placeholder: t('onboarding.full_name_placeholder'), value: fullNameInput.value, onInput: (e) => {
                                                fullNameInput.value = e.target.value;
                                                authError.value = null;
                                            }, class: "w-full px-3 py-3 border-2 border-border rounded-lg text-base text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]", required: true })] }), _jsx("button", { type: "submit", id: "passkey-register-btn", disabled: authLoading.value ||
                                        phoneInput.value.length !== 10 ||
                                        fullNameInput.value.trim().length === 0, class: `w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-base transition-colors flex items-center justify-center space-x-2 ${phoneInput.value.length === 10 &&
                                        fullNameInput.value.trim().length > 0 &&
                                        !authLoading.value
                                        ? 'bg-action hover:bg-action-active text-white cursor-pointer'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`, children: authLoading.value ? (_jsxs(_Fragment, { children: [_jsx(SpinnerIcon, { size: 20, class: "text-white" }), _jsx("span", { children: t('auth.registering') })] })) : (_jsx("span", { children: t('onboarding.customer_create_passkey') })) }), _jsxs("div", { class: "flex items-center justify-between pt-3 border-t border-border text-xs font-semibold", children: [_jsx("button", { type: "button", id: "back-to-roles-btn", onClick: () => {
                                                selectedOnboardingRole.value = null;
                                                authError.value = null;
                                            }, class: "text-text-sub hover:text-text-main min-h-[44px] px-2 py-2 flex items-center space-x-1", children: _jsxs("span", { children: ["\u2190 ", lang === 'hi' ? 'वापस जाएं' : 'Back'] }) }), _jsx("button", { type: "button", id: "switch-to-login-btn", onClick: () => {
                                                authMode.value = 'login';
                                                selectedOnboardingRole.value = null;
                                                authError.value = null;
                                                authCancelled.value = false;
                                            }, class: "text-brand hover:underline min-h-[44px] px-2 py-2", children: t('auth.switch_to_login') })] })] })) : (
                        /* ============================================================ */
                        /* 4. WORKER REGISTRATION (Step 1 - Mobile + Passkey)           */
                        /* ============================================================ */
                        _jsxs("form", { onSubmit: handleWorkerRegisterSubmit, class: "space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { for: "register-phone-input", class: "block text-sm font-semibold text-text-main mb-1.5", children: [t('auth.phone_label'), " *"] }), _jsxs("div", { class: "relative flex items-center", children: [_jsx("span", { class: "absolute left-3 text-text-sub font-semibold text-base select-none", children: "+91" }), _jsx("input", { id: "register-phone-input", type: "tel", inputMode: "tel", maxLength: 10, placeholder: t('auth.phone_placeholder'), value: phoneInput.value, onInput: (e) => {
                                                        const val = e.target.value.replace(/\D/g, '');
                                                        phoneInput.value = val.slice(0, 10);
                                                        authError.value = null;
                                                        authCancelled.value = false;
                                                    }, class: "w-full pl-14 pr-3 py-3 border-2 border-border rounded-lg text-base font-semibold text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]", required: true, autoFocus: true })] })] }), _jsx("button", { type: "submit", id: "passkey-register-btn", disabled: authLoading.value || phoneInput.value.length !== 10, class: `w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-base transition-colors flex items-center justify-center space-x-2 ${phoneInput.value.length === 10 && !authLoading.value
                                        ? 'bg-action hover:bg-action-active text-white cursor-pointer'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`, children: authLoading.value ? (_jsxs(_Fragment, { children: [_jsx(SpinnerIcon, { size: 20, class: "text-white" }), _jsx("span", { children: t('auth.registering') })] })) : (_jsx("span", { children: t('auth.register_button') })) }), _jsxs("div", { class: "flex items-center justify-between pt-3 border-t border-border text-xs font-semibold", children: [_jsx("button", { type: "button", id: "back-to-roles-btn", onClick: () => {
                                                selectedOnboardingRole.value = null;
                                                authError.value = null;
                                            }, class: "text-text-sub hover:text-text-main min-h-[44px] px-2 py-2 flex items-center space-x-1", children: _jsxs("span", { children: ["\u2190 ", lang === 'hi' ? 'वापस जाएं' : 'Back'] }) }), _jsx("button", { type: "button", id: "switch-to-login-btn", onClick: () => {
                                                authMode.value = 'login';
                                                selectedOnboardingRole.value = null;
                                                authError.value = null;
                                                authCancelled.value = false;
                                            }, class: "text-brand hover:underline min-h-[44px] px-2 py-2", children: t('auth.switch_to_login') })] })] }))] }) }), _jsx("footer", { class: "max-w-md mx-auto w-full text-center py-3 text-xs text-text-sub", children: _jsx("span", { children: t('home.service_area_label') }) })] }));
}
