import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { isLanguageChosen, selectLanguage } from './state/language';
import { isAuthenticated, currentUser } from './state/auth';
import { bookingStep } from './state/booking';
import { selectedJobId } from './state/provider';
import { LoginScreen } from './components/LoginScreen';
import { CustomerHome } from './components/CustomerHome';
import { BookingForm } from './components/BookingForm';
import { BookingReview } from './components/BookingReview';
import { BookingConfirmed } from './components/BookingConfirmed';
import { BookingHistory } from './components/BookingHistory';
import { BookingDetailScreen } from './components/BookingDetailScreen';
import { ProviderHome } from './components/ProviderHome';
import { ProviderJobDetailScreen } from './components/ProviderJobDetailScreen';
export function App() {
    // 1. First-launch Language Selection Screen
    // (Strict requirement: do NOT silently assume Hindi or English on fresh install)
    if (!isLanguageChosen.value) {
        return (_jsx("div", { class: "min-h-screen flex items-center justify-center p-4 bg-background", children: _jsxs("div", { class: "w-full max-w-md bg-surface border border-border rounded-lg p-6 shadow-sm", children: [_jsxs("div", { class: "text-center mb-6", children: [_jsx("h1", { class: "text-xl font-bold text-brand", children: "Chandil Home Services" }), _jsx("h2", { class: "text-lg font-semibold text-text-main mt-2", children: "Choose your language / \u092D\u093E\u0937\u093E \u091A\u0941\u0928\u0947\u0902" })] }), _jsxs("div", { class: "space-y-4", children: [_jsxs("button", { onClick: () => selectLanguage('en'), class: "w-full min-h-[56px] flex items-center justify-between px-5 py-4 border-2 border-border hover:border-brand rounded-lg text-left transition-colors bg-white focus:outline-none focus:border-brand", children: [_jsxs("div", { children: [_jsx("div", { class: "text-base font-bold text-text-main", children: "English" }), _jsx("div", { class: "text-sm text-text-sub", children: "Continue in English" })] }), _jsx("span", { class: "text-brand font-bold text-lg", children: "\u2192" })] }), _jsxs("button", { onClick: () => selectLanguage('hi'), class: "w-full min-h-[56px] flex items-center justify-between px-5 py-4 border-2 border-border hover:border-brand rounded-lg text-left transition-colors bg-white focus:outline-none focus:border-brand", children: [_jsxs("div", { children: [_jsx("div", { class: "text-base font-bold text-text-main", children: "\u0939\u093F\u0902\u0926\u0940" }), _jsx("div", { class: "text-sm text-text-sub", children: "\u0939\u093F\u0902\u0926\u0940 \u092E\u0947\u0902 \u091C\u093E\u0930\u0940 \u0930\u0916\u0947\u0902" })] }), _jsx("span", { class: "text-brand font-bold text-lg", children: "\u2192" })] })] })] }) }));
    }
    // 2. Unauthenticated State -> Mobile Login Screen
    if (!isAuthenticated.value) {
        return _jsx(LoginScreen, {});
    }
    // 3. Provider Role Flow
    if (currentUser.value?.role === 'provider') {
        if (selectedJobId.value) {
            return _jsx(ProviderJobDetailScreen, {});
        }
        return _jsx(ProviderHome, {});
    }
    // 4. Customer Role Flow (Customer App)
    switch (bookingStep.value) {
        case 'details':
            return _jsx(BookingForm, {});
        case 'review':
            return _jsx(BookingReview, {});
        case 'confirmed':
            return _jsx(BookingConfirmed, {});
        case 'history':
            return _jsx(BookingHistory, {});
        case 'status':
            return _jsx(BookingDetailScreen, {});
        case 'home':
        default:
            return _jsx(CustomerHome, {});
    }
}
