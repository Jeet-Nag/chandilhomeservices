import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useEffect } from 'preact/hooks';
import { bookingHistory, isHistoryLoading, historyError, fetchBookingHistory, openBookingDetail, returnToHome, } from '../state/booking';
import { categories, fetchCategories } from '../state/categories';
import { currentLanguage, t } from '../state/language';
import { CHANDIL_LOCALITIES } from '@shared';
import { ArrowLeftIcon, RefreshIcon, SpinnerIcon, AlertCircleIcon, FileTextIcon, ChevronRightIcon, CategoryIconRenderer, MicIcon, } from './icons';
function getStatusBadgeStyle(status) {
    switch (status) {
        case 'BOOKING_COMPLETED':
        case 'PAYMENT_COLLECTED':
        case 'SERVICE_COMPLETED':
            return { bg: 'bg-green-50 border-green-200', text: 'text-action-active', dot: 'bg-action' };
        case 'CANCELLED_BY_CUSTOMER':
        case 'CANCELLED_BY_ADMIN':
        case 'REJECTED_BY_PROVIDER':
            return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-600' };
        case 'PROVIDER_ON_THE_WAY':
        case 'SERVICE_STARTED':
        case 'PAYMENT_PENDING':
            return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500' };
        case 'SERVICE_REQUESTED':
        case 'PROVIDER_ASSIGNED':
        case 'PROVIDER_ACCEPTED':
        default:
            return { bg: 'bg-blue-50 border-blue-200', text: 'text-brand', dot: 'bg-brand' };
    }
}
function formatDate(isoString, lang) {
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime()))
            return isoString;
        const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
        return d.toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    catch {
        return isoString;
    }
}
export function BookingHistory() {
    const lang = currentLanguage.value || 'en';
    useEffect(() => {
        fetchBookingHistory();
        if (categories.value.length === 0) {
            fetchCategories();
        }
    }, []);
    const bookings = bookingHistory.value;
    const isLoading = isHistoryLoading.value;
    const error = historyError.value;
    return (_jsxs("div", { class: "min-h-screen flex flex-col bg-background", children: [_jsx("header", { class: "bg-brand text-white px-4 py-3 sticky top-0 z-10 shadow-sm", children: _jsxs("div", { class: "max-w-md mx-auto flex items-center justify-between", children: [_jsxs("div", { class: "flex items-center space-x-3", children: [_jsx("button", { onClick: () => returnToHome(), class: "p-2 -ml-2 text-white hover:bg-white/10 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center focus:outline-none", "aria-label": t('app.back'), children: _jsx(ArrowLeftIcon, { size: 22 }) }), _jsx("h1", { class: "text-base font-bold leading-tight", children: t('history.title') })] }), _jsx("button", { onClick: () => fetchBookingHistory(true), disabled: isLoading, class: "p-2 -mr-2 text-white hover:bg-white/10 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center focus:outline-none transition-colors", "aria-label": t('history.refresh'), title: t('history.refresh'), children: _jsx(RefreshIcon, { size: 20, class: isLoading ? 'animate-spin' : '' }) })] }) }), _jsxs("main", { class: "max-w-md mx-auto w-full p-4 flex-1", children: [isLoading && bookings.length === 0 && (_jsxs("div", { class: "flex flex-col items-center justify-center py-16 space-y-3", children: [_jsx(SpinnerIcon, { size: 32, class: "text-brand" }), _jsx("p", { class: "text-xs text-text-sub font-medium", children: t('app.loading') })] })), !isLoading && error && (_jsxs("div", { class: "bg-surface border border-red-200 rounded-lg p-6 text-center space-y-4 shadow-sm my-6", children: [_jsx("div", { class: "w-12 h-12 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto", children: _jsx(AlertCircleIcon, { size: 28 }) }), _jsxs("div", { children: [_jsx("p", { class: "text-sm font-semibold text-text-main", children: error }), _jsx("p", { class: "text-xs text-text-sub mt-1", children: t('app.network_error') })] }), _jsxs("button", { type: "button", onClick: () => fetchBookingHistory(true), class: "min-h-[48px] px-6 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-lg font-bold text-xs transition-colors inline-flex items-center space-x-2", children: [_jsx(RefreshIcon, { size: 16 }), _jsx("span", { children: t('app.retry') })] })] })), !isLoading && !error && bookings.length === 0 && (_jsxs("div", { class: "bg-surface border border-border rounded-lg p-8 text-center space-y-4 shadow-sm my-8", children: [_jsx("div", { class: "w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto", children: _jsx(FileTextIcon, { size: 32 }) }), _jsxs("div", { children: [_jsx("h2", { class: "text-base font-bold text-text-main", children: t('history.empty_title') }), _jsx("p", { class: "text-xs text-text-sub mt-1 leading-relaxed max-w-xs mx-auto", children: t('history.empty_desc') })] }), _jsx("div", { children: _jsx("button", { type: "button", onClick: () => returnToHome(), class: "min-h-[48px] px-6 py-3 bg-action hover:bg-action-active text-white rounded-lg font-bold text-sm transition-colors inline-flex items-center space-x-2", children: _jsx("span", { children: t('history.book_now') }) }) })] })), bookings.length > 0 && (_jsxs("div", { class: "space-y-3", children: [isLoading && (_jsxs("div", { class: "flex items-center justify-center py-1 text-xs text-text-sub space-x-2", children: [_jsx(SpinnerIcon, { size: 14, class: "text-brand" }), _jsx("span", { children: t('history.refreshing') })] })), bookings.map((booking) => {
                                const category = categories.value.find((c) => c.id === booking.categoryId);
                                const categoryTitle = category
                                    ? (lang === 'hi' ? category.titleHi : category.titleEn)
                                    : booking.categoryId;
                                const localityObj = CHANDIL_LOCALITIES.find((l) => l.id === booking.areaLocality);
                                const localityName = localityObj
                                    ? (lang === 'hi' ? localityObj.nameHi : localityObj.nameEn)
                                    : booking.areaLocality;
                                const badgeStyle = getStatusBadgeStyle(booking.status);
                                const shortId = `#CHS-${booking.id.substring(0, 8).toUpperCase()}`;
                                const statusKey = `status.${booking.status.toLowerCase()}`;
                                return (_jsxs("button", { onClick: () => openBookingDetail(booking.id), class: "w-full text-left bg-surface border border-border hover:border-brand rounded-lg p-4 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand/30 space-y-2.5 active:bg-slate-50 min-h-[48px]", children: [_jsxs("div", { class: "flex items-start justify-between", children: [_jsxs("div", { class: "flex items-center space-x-3", children: [_jsx("div", { class: "w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0", children: category ? (_jsx(CategoryIconRenderer, { iconName: category.iconName, size: 22 })) : (_jsx(FileTextIcon, { size: 20 })) }), _jsxs("div", { children: [_jsx("div", { class: "text-sm font-bold text-text-main leading-tight", children: categoryTitle }), _jsx("div", { class: "text-xs text-text-sub font-mono mt-0.5", children: shortId })] })] }), _jsx("div", { class: "text-right", children: _jsxs("span", { class: "text-sm font-bold text-action", children: ["\u20B9", booking.visitingFee.toFixed(2)] }) })] }), _jsxs("div", { class: "flex items-center justify-between text-xs pt-1 border-t border-slate-100", children: [_jsxs("div", { class: "flex items-center space-x-2 text-text-sub", children: [_jsx("span", { children: localityName }), _jsx("span", { children: "\u2022" }), _jsx("span", { children: formatDate(booking.createdAt, lang) }), booking.audioUrl && (_jsx("span", { class: "inline-flex items-center text-red-600 ml-1", title: t('booking.voice_note'), children: _jsx(MicIcon, { size: 13 }) }))] }), _jsx(ChevronRightIcon, { size: 16, class: "text-slate-400" })] }), _jsxs("div", { class: `inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeStyle.bg} ${badgeStyle.text}`, children: [_jsx("span", { class: `w-2 h-2 rounded-full ${badgeStyle.dot}` }), _jsx("span", { children: booking.status === 'PAYMENT_PENDING'
                                                        ? t('status.payment_pending', { amount: (booking.finalAmount ?? booking.visitingFee).toFixed(2) })
                                                        : t(statusKey) })] })] }, booking.id));
                            })] }))] })] }));
}
