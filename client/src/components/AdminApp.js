import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useEffect } from 'preact/hooks';
import { isAuthenticated, currentUser, logout } from '../state/auth';
import { currentLanguage } from '../state/language';
import { isAdminLoading, adminError, verifyAdminSession, } from '../state/admin';
import { AdminShell } from './AdminShell';
import { AdminLoginScreen } from './AdminLoginScreen';
import { SpinnerIcon, AlertCircleIcon, RefreshIcon, LogOutIcon } from './icons';
export function AdminApp() {
    const user = currentUser.value;
    const lang = currentLanguage.value || 'en';
    const authenticated = isAuthenticated.value;
    const loading = isAdminLoading.value;
    const error = adminError.value;
    useEffect(() => {
        if (authenticated && user?.role === 'admin') {
            verifyAdminSession();
        }
    }, [authenticated, user?.id]);
    // 1. Unauthenticated -> Dedicated Admin Login Screen
    if (!authenticated) {
        return (_jsx(AdminLoginScreen, { onLoginSuccess: () => {
                verifyAdminSession();
            } }));
    }
    // 2. Authenticated but NOT admin -> Strict Access Denied
    if (user?.role !== 'admin' || error === 'ACCESS_DENIED') {
        return (_jsx("div", { class: "min-h-screen flex items-center justify-center p-4 bg-slate-100 text-text-main", children: _jsxs("div", { class: "w-full max-w-md bg-surface border border-border rounded-xl p-8 shadow-sm text-center space-y-4", children: [_jsx("div", { class: "w-14 h-14 mx-auto rounded-full bg-red-100 flex items-center justify-center text-danger", children: _jsx(AlertCircleIcon, { size: 32 }) }), _jsx("h2", { class: "text-xl font-bold text-text-main", children: lang === 'hi' ? 'पहुंच अस्वीकृत' : 'Access Denied' }), _jsx("p", { class: "text-sm text-text-sub leading-relaxed", children: lang === 'hi'
                            ? 'आपके पास एडमिन पोर्टल तक पहुंचने की अनुमति नहीं है। यह क्षेत्र केवल अधिकृत व्यवस्थापकों के लिए है।'
                            : 'You do not have administrator permissions to access this portal. This area is strictly restricted to authorized administrators.' }), _jsx("div", { class: "pt-2", children: _jsxs("button", { onClick: () => logout(), class: "w-full min-h-[48px] px-4 py-3 bg-brand text-white font-semibold rounded-lg hover:bg-brand-dark transition-colors flex items-center justify-center gap-2", children: [_jsx(LogOutIcon, { size: 18 }), _jsx("span", { children: lang === 'hi' ? 'लॉगआउट करें' : 'Sign Out' })] }) })] }) }));
    }
    // 3. Authenticated Admin Session -> Verify with server
    if (loading && !user) {
        return (_jsx("div", { class: "min-h-screen flex items-center justify-center p-4 bg-slate-100", children: _jsxs("div", { class: "flex flex-col items-center gap-3", children: [_jsx(SpinnerIcon, { size: 36, class: "text-brand animate-spin" }), _jsx("p", { class: "text-sm font-medium text-text-sub", children: lang === 'hi' ? 'एडमिन सत्र की पुष्टि हो रही है...' : 'Verifying admin session...' })] }) }));
    }
    // 4. Session Validation Failed with non-access-denied error (e.g. network failure)
    if (!loading && error && error !== 'ACCESS_DENIED') {
        return (_jsx("div", { class: "min-h-screen flex items-center justify-center p-4 bg-slate-100", children: _jsxs("div", { class: "w-full max-w-md bg-surface border border-border rounded-xl p-6 shadow-sm text-center space-y-4", children: [_jsx("div", { class: "w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center text-amber-700", children: _jsx(AlertCircleIcon, { size: 28 }) }), _jsx("h3", { class: "text-base font-bold text-text-main", children: lang === 'hi' ? 'कनेक्शन त्रुटि' : 'Connection Error' }), _jsx("p", { class: "text-xs text-text-sub leading-relaxed", children: lang === 'hi'
                            ? 'एडमिन सर्वर से संपर्क नहीं हो सका। कृपया इंटरनेट जांचें।'
                            : 'Unable to reach the admin server. Please check your network connection.' }), _jsxs("div", { class: "flex gap-2 pt-2", children: [_jsxs("button", { onClick: () => verifyAdminSession(), class: "flex-1 min-h-[44px] px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark flex items-center justify-center gap-2", children: [_jsx(RefreshIcon, { size: 16 }), _jsx("span", { children: lang === 'hi' ? 'पुनः प्रयास करें' : 'Retry' })] }), _jsxs("button", { onClick: () => logout(), class: "min-h-[44px] px-4 py-2 border border-border text-text-main text-xs font-semibold rounded-lg hover:bg-slate-50 flex items-center justify-center gap-1.5", children: [_jsx(LogOutIcon, { size: 16 }), _jsx("span", { children: lang === 'hi' ? 'लॉगआउट' : 'Logout' })] })] })] }) }));
    }
    // 5. Render Authorized Admin Operations Shell
    return _jsx(AdminShell, {});
}
