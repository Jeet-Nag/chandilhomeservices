import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { authMode, phoneInput, fullNameInput, authLoading, authError, authCancelled, loginWithPasskey, registerPasskey, } from '../state/auth';
import { currentLanguage, selectLanguage, t } from '../state/language';
import { SpinnerIcon, AlertCircleIcon } from './icons';
export function LoginScreen() {
    const handleLoginSubmit = (e) => {
        e.preventDefault();
        loginWithPasskey();
    };
    const handleRegisterSubmit = (e) => {
        e.preventDefault();
        registerPasskey();
    };
    const isLoginMode = authMode.value === 'login';
    return (_jsxs("div", { class: "min-h-screen flex flex-col justify-between bg-background p-4", children: [_jsxs("header", { class: "max-w-md mx-auto w-full flex items-center justify-between py-2", children: [_jsx("div", { class: "font-bold text-brand text-lg", children: t('app.title') }), _jsxs("div", { class: "flex items-center space-x-1 bg-surface p-1 rounded border border-border", children: [_jsx("button", { onClick: () => selectLanguage('en'), class: `px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${currentLanguage.value === 'en'
                                    ? 'bg-brand text-white'
                                    : 'text-text-sub hover:text-text-main'}`, children: "EN" }), _jsx("button", { onClick: () => selectLanguage('hi'), class: `px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${currentLanguage.value === 'hi'
                                    ? 'bg-brand text-white'
                                    : 'text-text-sub hover:text-text-main'}`, children: "\u0939\u093F\u0902\u0926\u0940" })] })] }), _jsx("main", { class: "max-w-md mx-auto w-full my-auto", children: _jsxs("div", { class: "bg-surface border border-border rounded-lg p-6 shadow-sm", children: [_jsxs("div", { class: "text-center mb-6", children: [_jsx("h1", { class: "text-xl font-bold text-text-main leading-snug", children: isLoginMode ? t('auth.login_title') : t('auth.register_title') }), _jsx("p", { class: "text-xs text-text-sub mt-1 leading-relaxed", children: t('app.tagline') })] }), authError.value && (_jsxs("div", { class: "mb-5 p-3 rounded bg-red-50 border border-red-200 flex flex-col space-y-2 text-danger text-sm", children: [_jsxs("div", { class: "flex items-start space-x-2", children: [_jsx(AlertCircleIcon, { size: 18, class: "mt-0.5 shrink-0" }), _jsx("span", { class: "leading-snug", children: authError.value })] }), authCancelled.value && (_jsx("button", { type: "button", onClick: () => {
                                        authError.value = null;
                                        authCancelled.value = false;
                                        if (isLoginMode) {
                                            loginWithPasskey();
                                        }
                                        else {
                                            registerPasskey();
                                        }
                                    }, class: "self-start text-xs font-semibold text-brand underline min-h-[36px] px-2 py-1", children: t('auth.retry') }))] })), isLoginMode ? (
                        /* --- PASSKEY LOGIN FLOW --- */
                        _jsxs("form", { onSubmit: handleLoginSubmit, class: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { for: "login-phone-input", class: "block text-sm font-semibold text-text-main mb-1.5", children: t('auth.phone_label') }), _jsxs("div", { class: "relative flex items-center", children: [_jsx("span", { class: "absolute left-3 text-text-sub font-semibold text-base select-none", children: "+91" }), _jsx("input", { id: "login-phone-input", type: "tel", inputMode: "tel", maxLength: 10, placeholder: t('auth.phone_optional_placeholder'), value: phoneInput.value, onInput: (e) => {
                                                        const val = e.target.value.replace(/\D/g, '');
                                                        phoneInput.value = val.slice(0, 10);
                                                        authError.value = null;
                                                        authCancelled.value = false;
                                                    }, class: "w-full pl-14 pr-3 py-3 border-2 border-border rounded-lg text-base font-semibold text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]" })] })] }), _jsx("button", { type: "submit", id: "passkey-login-btn", disabled: authLoading.value, class: `w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-base transition-colors flex items-center justify-center space-x-2 ${!authLoading.value
                                        ? 'bg-brand hover:bg-brand-dark text-white cursor-pointer'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`, children: authLoading.value ? (_jsxs(_Fragment, { children: [_jsx(SpinnerIcon, { size: 20, class: "text-white" }), _jsx("span", { children: t('auth.authenticating') })] })) : (_jsx("span", { children: t('auth.login_button') })) }), _jsx("div", { class: "text-center pt-3 border-t border-border", children: _jsx("button", { type: "button", id: "switch-to-register-btn", onClick: () => {
                                            authMode.value = 'register';
                                            authError.value = null;
                                            authCancelled.value = false;
                                            authLoading.value = false;
                                        }, class: "text-sm font-semibold text-brand hover:underline min-h-[44px] px-3 py-2", children: t('auth.switch_to_register') }) })] })) : (
                        /* --- PASSKEY REGISTRATION FLOW --- */
                        _jsxs("form", { onSubmit: handleRegisterSubmit, class: "space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { for: "register-phone-input", class: "block text-sm font-semibold text-text-main mb-1.5", children: [t('auth.phone_label'), " *"] }), _jsxs("div", { class: "relative flex items-center", children: [_jsx("span", { class: "absolute left-3 text-text-sub font-semibold text-base select-none", children: "+91" }), _jsx("input", { id: "register-phone-input", type: "tel", inputMode: "tel", maxLength: 10, placeholder: t('auth.phone_placeholder'), value: phoneInput.value, onInput: (e) => {
                                                        const val = e.target.value.replace(/\D/g, '');
                                                        phoneInput.value = val.slice(0, 10);
                                                        authError.value = null;
                                                        authCancelled.value = false;
                                                    }, class: "w-full pl-14 pr-3 py-3 border-2 border-border rounded-lg text-base font-semibold text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]", required: true, autoFocus: true })] })] }), _jsxs("div", { children: [_jsx("label", { for: "register-name-input", class: "block text-sm font-semibold text-text-main mb-1.5", children: t('auth.name_label') }), _jsx("input", { id: "register-name-input", type: "text", maxLength: 100, placeholder: t('auth.name_placeholder'), value: fullNameInput.value, onInput: (e) => {
                                                fullNameInput.value = e.target.value;
                                                authError.value = null;
                                            }, class: "w-full px-3 py-3 border-2 border-border rounded-lg text-base text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]" })] }), _jsx("button", { type: "submit", id: "passkey-register-btn", disabled: authLoading.value || phoneInput.value.length !== 10, class: `w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-base transition-colors flex items-center justify-center space-x-2 ${phoneInput.value.length === 10 && !authLoading.value
                                        ? 'bg-action hover:bg-action-active text-white cursor-pointer'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`, children: authLoading.value ? (_jsxs(_Fragment, { children: [_jsx(SpinnerIcon, { size: 20, class: "text-white" }), _jsx("span", { children: t('auth.registering') })] })) : (_jsx("span", { children: t('auth.register_button') })) }), _jsx("div", { class: "text-center pt-3 border-t border-border", children: _jsx("button", { type: "button", id: "switch-to-login-btn", onClick: () => {
                                            authMode.value = 'login';
                                            authError.value = null;
                                            authCancelled.value = false;
                                            authLoading.value = false;
                                        }, class: "text-sm font-semibold text-brand hover:underline min-h-[44px] px-3 py-2", children: t('auth.switch_to_login') }) })] }))] }) }), _jsx("footer", { class: "max-w-md mx-auto w-full text-center py-3 text-xs text-text-sub", children: _jsx("span", { children: t('home.service_area_label') }) })] }));
}
