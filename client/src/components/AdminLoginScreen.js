import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useState } from 'preact/hooks';
import { loginWithPasskey, registerPasskey, authLoading, authError, currentUser, logout, } from '../state/auth';
import { currentLanguage, selectLanguage } from '../state/language';
import { SpinnerIcon, AlertCircleIcon } from './icons';
export function AdminLoginScreen({ onLoginSuccess }) {
    const lang = currentLanguage.value || 'en';
    const [phone, setPhone] = useState('');
    const [mode, setMode] = useState('login');
    const [adminCustomError, setAdminCustomError] = useState(null);
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const isValidPhone = /^[6-9]\d{9}$/.test(cleanPhone);
    const handlePhoneChange = (e) => {
        const val = (e.target?.value || '').replace(/[^0-9]/g, '').slice(0, 10);
        setPhone(val);
        setAdminCustomError(null);
    };
    const handleAdminLogin = async (e) => {
        if (e)
            e.preventDefault();
        setAdminCustomError(null);
        if (!isValidPhone) {
            setAdminCustomError(lang === 'hi'
                ? 'कृपया सही 10 अंकों का एडमिन मोबाइल नंबर दर्ज करें।'
                : 'Please enter a valid 10-digit registered admin mobile number.');
            return;
        }
        const success = await loginWithPasskey(cleanPhone);
        if (success) {
            // Validate role boundary immediately
            if (currentUser.value?.role !== 'admin') {
                logout();
                setAdminCustomError(lang === 'hi'
                    ? 'पहुंच अस्वीकृत: यह खाता एडमिन के रूप में अधिकृत नहीं है।'
                    : 'Access Denied: This account does not have administrator privileges.');
                return;
            }
            onLoginSuccess();
        }
    };
    const handleAdminSetup = async (e) => {
        if (e)
            e.preventDefault();
        setAdminCustomError(null);
        if (!isValidPhone) {
            setAdminCustomError(lang === 'hi'
                ? 'कृपया सही 10 अंकों का एडमिन मोबाइल नंबर दर्ज करें।'
                : 'Please enter a valid 10-digit registered admin mobile number.');
            return;
        }
        const success = await registerPasskey(cleanPhone, 'Chandil Admin', undefined);
        if (success) {
            // Validate role boundary immediately
            if (currentUser.value?.role !== 'admin') {
                logout();
                setAdminCustomError(lang === 'hi'
                    ? 'पहुंच अस्वीकृत: यह खाता एडमिन के रूप में अधिकृत नहीं है।'
                    : 'Access Denied: This account does not have administrator privileges.');
                return;
            }
            onLoginSuccess();
        }
    };
    return (_jsxs("div", { class: "min-h-screen flex flex-col justify-between bg-slate-100 text-text-main p-4", children: [_jsxs("header", { class: "max-w-md mx-auto w-full flex items-center justify-between py-3", children: [_jsxs("div", { class: "flex items-center gap-2", children: [_jsx("div", { class: "w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center font-bold text-sm shadow-xs", children: "C" }), _jsx("span", { class: "font-bold text-brand text-base tracking-tight", children: "Chandil Home Services" })] }), _jsxs("div", { class: "flex items-center bg-white rounded-lg p-0.5 border border-border shadow-xs", children: [_jsx("button", { type: "button", onClick: () => selectLanguage('en'), class: `px-3 py-1 text-xs font-semibold rounded min-h-[36px] transition-colors ${lang === 'en' ? 'bg-brand text-white' : 'text-text-sub hover:text-text-main'}`, children: "EN" }), _jsx("button", { type: "button", onClick: () => selectLanguage('hi'), class: `px-3 py-1 text-xs font-semibold rounded min-h-[36px] transition-colors ${lang === 'hi' ? 'bg-brand text-white' : 'text-text-sub hover:text-text-main'}`, children: "\u0939\u093F\u0902\u0926\u0940" })] })] }), _jsx("main", { class: "max-w-md mx-auto w-full my-auto", children: _jsxs("div", { class: "bg-surface border border-border rounded-xl p-6 sm:p-8 shadow-sm space-y-6", children: [_jsxs("div", { class: "text-center space-y-2", children: [_jsx("span", { class: "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 uppercase tracking-wider", children: lang === 'hi' ? 'केवल अधिकृत एडमिन' : 'ADMINISTRATOR ACCESS ONLY' }), _jsx("h1", { class: "text-2xl font-bold text-text-main tracking-tight pt-1", children: lang === 'hi' ? 'एडमिन संचालन केंद्र' : 'Operations Control Center' }), _jsx("p", { class: "text-xs text-text-sub", children: lang === 'hi'
                                        ? 'चंडिल होम सर्विसेज प्रबंधन पोर्टल में प्रवेश करें।'
                                        : 'Secure administrative portal for Chandil Home Services.' })] }), (adminCustomError || authError.value) && (_jsxs("div", { class: "p-3.5 rounded-lg bg-red-50 border border-red-200 text-danger text-xs flex items-start gap-2.5", children: [_jsx(AlertCircleIcon, { size: 18, class: "shrink-0 mt-0.5 text-danger" }), _jsx("div", { class: "flex-1 font-medium leading-relaxed", children: adminCustomError || authError.value })] })), _jsxs("form", { onSubmit: mode === 'login' ? handleAdminLogin : handleAdminSetup, class: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-2", children: lang === 'hi' ? 'पंजीकृत एडमिन मोबाइल नंबर' : 'Registered Admin Mobile Number' }), _jsxs("div", { class: "relative flex items-center", children: [_jsx("span", { class: "absolute left-3.5 text-sm font-semibold text-text-sub select-none", children: "+91" }), _jsx("input", { type: "tel", inputMode: "numeric", pattern: "[0-9]*", value: phone, onInput: handlePhoneChange, placeholder: "98XXXXXXXX", maxLength: 10, autofocus: true, disabled: authLoading.value, class: "w-full pl-14 pr-4 py-3 min-h-[48px] bg-white border border-border rounded-lg text-sm font-medium text-text-main placeholder-slate-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" })] }), _jsx("p", { class: "text-[11px] text-text-sub mt-1.5", children: lang === 'hi'
                                                ? 'केवल डेटाबेस में अधिकृत एडमिन फोन नंबर ही लॉगिन कर सकते हैं।'
                                                : 'Only authorized administrator phone numbers in the database can sign in.' })] }), mode === 'login' ? (_jsxs("div", { class: "space-y-3 pt-2", children: [_jsx("button", { type: "submit", disabled: authLoading.value || !isValidPhone, class: `w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-sm text-white flex items-center justify-center gap-2 transition-all shadow-xs ${isValidPhone && !authLoading.value
                                                ? 'bg-brand hover:bg-brand-dark active:bg-slate-900 cursor-pointer'
                                                : 'bg-slate-400 cursor-not-allowed opacity-75'}`, children: authLoading.value ? (_jsxs(_Fragment, { children: [_jsx(SpinnerIcon, { size: 18, class: "animate-spin text-white" }), _jsx("span", { children: lang === 'hi' ? 'सत्यापन हो रहा है...' : 'Verifying...' })] })) : (_jsx("span", { children: lang === 'hi' ? 'एडमिन पासकी से साइन इन करें' : 'Sign In with Admin Passkey' })) }), _jsx("button", { type: "button", onClick: () => {
                                                setMode('setup');
                                                setAdminCustomError(null);
                                            }, disabled: authLoading.value, class: "w-full min-h-[40px] px-3 py-2 text-xs font-semibold text-text-sub hover:text-brand hover:underline transition-colors", children: lang === 'hi'
                                                ? 'इस डिवाइस पर पहली बार हैं? पासकी सेटअप करें'
                                                : 'First time on this device? Setup Admin Passkey' })] })) : (_jsxs("div", { class: "space-y-3 pt-2", children: [_jsx("button", { type: "submit", disabled: authLoading.value || !isValidPhone, class: `w-full min-h-[48px] px-4 py-3 rounded-lg font-bold text-sm text-white flex items-center justify-center gap-2 transition-all shadow-xs ${isValidPhone && !authLoading.value
                                                ? 'bg-action hover:bg-action-active cursor-pointer'
                                                : 'bg-slate-400 cursor-not-allowed opacity-75'}`, children: authLoading.value ? (_jsxs(_Fragment, { children: [_jsx(SpinnerIcon, { size: 18, class: "animate-spin text-white" }), _jsx("span", { children: lang === 'hi' ? 'पासकी बनाई जा रही है...' : 'Creating Passkey...' })] })) : (_jsx("span", { children: lang === 'hi' ? 'इस डिवाइस पर एडमिन पासकी बनाएं' : 'Create Admin Device Passkey' })) }), _jsx("button", { type: "button", onClick: () => {
                                                setMode('login');
                                                setAdminCustomError(null);
                                            }, disabled: authLoading.value, class: "w-full min-h-[40px] px-3 py-2 text-xs font-semibold text-text-sub hover:text-brand hover:underline transition-colors", children: lang === 'hi' ? '← लॉगिन पर वापस जाएं' : '← Back to Sign In' })] }))] }), _jsx("div", { class: "pt-4 border-t border-border/60 text-center", children: _jsxs("p", { class: "text-[11px] text-text-sub flex items-center justify-center gap-1.5", children: [_jsx("span", { class: "w-1.5 h-1.5 rounded-full bg-action inline-block" }), _jsx("span", { children: "WebAuthn FIDO2 Protected / \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924 \u092C\u093E\u092F\u094B\u092E\u0947\u091F\u094D\u0930\u093F\u0915 \u0938\u0924\u094D\u092F\u093E\u092A\u0928" })] }) })] }) }), _jsx("footer", { class: "max-w-md mx-auto w-full text-center py-4 text-xs text-text-sub", children: _jsx("span", { children: "Chandil Home Services \u00A9 2026. All rights reserved." }) })] }));
}
