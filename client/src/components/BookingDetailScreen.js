import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useEffect } from 'preact/hooks';
import { activeBookingDetail, isDetailLoading, detailError, refreshCurrentBooking, closeBookingDetail, toggleDetailAudio, stopDetailAudio, isPlayingDetailAudio, detailAudioError, } from '../state/booking';
import { categories, fetchCategories } from '../state/categories';
import { currentLanguage, t } from '../state/language';
import { CHANDIL_LOCALITIES } from '@shared';
import { ArrowLeftIcon, RefreshIcon, SpinnerIcon, AlertCircleIcon, CheckIcon, PlayIcon, PauseIcon, MicIcon, CategoryIconRenderer, FileTextIcon, ClockIcon, } from './icons';
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
function formatDateTime(isoString, lang) {
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
const ORDERED_STAGES = [
    { status: 'SERVICE_REQUESTED', labelKey: 'status.service_requested' },
    { status: 'PROVIDER_ASSIGNED', labelKey: 'status.provider_assigned' },
    { status: 'PROVIDER_ACCEPTED', labelKey: 'status.provider_accepted' },
    { status: 'PROVIDER_ON_THE_WAY', labelKey: 'status.provider_on_the_way' },
    { status: 'SERVICE_STARTED', labelKey: 'status.service_started' },
    { status: 'SERVICE_COMPLETED', labelKey: 'status.service_completed' },
    { status: 'PAYMENT_PENDING', labelKey: 'status.payment_pending' },
    { status: 'PAYMENT_COLLECTED', labelKey: 'status.payment_collected' },
    { status: 'BOOKING_COMPLETED', labelKey: 'status.booking_completed' },
];
export function BookingDetailScreen() {
    const lang = currentLanguage.value || 'en';
    const booking = activeBookingDetail.value;
    const isLoading = isDetailLoading.value;
    const error = detailError.value;
    const isPlaying = isPlayingDetailAudio.value;
    const audioError = detailAudioError.value;
    useEffect(() => {
        if (categories.value.length === 0) {
            fetchCategories();
        }
        return () => {
            stopDetailAudio();
        };
    }, []);
    const category = booking ? categories.value.find((c) => c.id === booking.categoryId) : null;
    const categoryTitle = category
        ? (lang === 'hi' ? category.titleHi : category.titleEn)
        : (booking?.categoryId || '');
    const localityObj = booking ? CHANDIL_LOCALITIES.find((l) => l.id === booking.areaLocality) : null;
    const localityName = localityObj
        ? (lang === 'hi' ? localityObj.nameHi : localityObj.nameEn)
        : (booking?.areaLocality || '');
    const shortId = booking ? `#CHS-${booking.id.substring(0, 8).toUpperCase()}` : '';
    const statusKey = booking ? `status.${booking.status.toLowerCase()}` : '';
    const badgeStyle = booking ? getStatusBadgeStyle(booking.status) : null;
    const isExceptionalStatus = booking?.status === 'CANCELLED_BY_CUSTOMER' ||
        booking?.status === 'CANCELLED_BY_ADMIN' ||
        booking?.status === 'REJECTED_BY_PROVIDER';
    // Build status lookup from server logs
    const logsByStatus = new Map();
    if (booking?.statusLogs) {
        for (const log of booking.statusLogs) {
            logsByStatus.set(log.toStatus, log);
        }
    }
    // Determine stage progression index based on the highest completed stage
    const currentStatusIndex = booking
        ? ORDERED_STAGES.findIndex((s) => s.status === booking.status)
        : -1;
    return (_jsxs("div", { class: "min-h-screen flex flex-col bg-background", children: [_jsx("header", { class: "bg-brand text-white px-4 py-3 sticky top-0 z-10 shadow-sm", children: _jsxs("div", { class: "max-w-md mx-auto flex items-center justify-between", children: [_jsxs("div", { class: "flex items-center space-x-3", children: [_jsx("button", { onClick: () => closeBookingDetail(), class: "p-2 -ml-2 text-white hover:bg-white/10 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center focus:outline-none", "aria-label": t('app.back'), children: _jsx(ArrowLeftIcon, { size: 22 }) }), _jsx("h1", { class: "text-base font-bold leading-tight", children: t('detail.title') })] }), _jsx("button", { onClick: () => refreshCurrentBooking(), disabled: isLoading, class: "p-2 -mr-2 text-white hover:bg-white/10 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center focus:outline-none transition-colors", "aria-label": t('detail.refresh'), title: t('detail.refresh'), children: _jsx(RefreshIcon, { size: 20, class: isLoading ? 'animate-spin' : '' }) })] }) }), _jsxs("main", { class: "max-w-md mx-auto w-full p-4 flex-1 space-y-4", children: [isLoading && !booking && (_jsxs("div", { class: "flex flex-col items-center justify-center py-16 space-y-3", children: [_jsx(SpinnerIcon, { size: 32, class: "text-brand" }), _jsx("p", { class: "text-xs text-text-sub font-medium", children: t('app.loading') })] })), error && (_jsxs("div", { class: "bg-surface border border-red-200 rounded-lg p-6 text-center space-y-4 shadow-sm my-4", children: [_jsx("div", { class: "w-12 h-12 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto", children: _jsx(AlertCircleIcon, { size: 28 }) }), _jsxs("div", { children: [_jsx("p", { class: "text-sm font-semibold text-text-main", children: error }), _jsx("p", { class: "text-xs text-text-sub mt-1", children: t('app.network_error') })] }), _jsxs("button", { type: "button", onClick: () => refreshCurrentBooking(), class: "min-h-[48px] px-6 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-lg font-bold text-xs transition-colors inline-flex items-center space-x-2", children: [_jsx(RefreshIcon, { size: 16 }), _jsx("span", { children: t('app.retry') })] })] })), booking && (_jsxs(_Fragment, { children: [_jsxs("section", { class: "bg-surface border border-border rounded-lg p-4 shadow-sm space-y-3", children: [_jsxs("div", { class: "flex items-start justify-between", children: [_jsxs("div", { class: "flex items-center space-x-3", children: [_jsx("div", { class: "w-12 h-12 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0", children: category ? (_jsx(CategoryIconRenderer, { iconName: category.iconName, size: 26 })) : (_jsx(FileTextIcon, { size: 24 })) }), _jsxs("div", { children: [_jsx("h2", { class: "text-base font-bold text-text-main leading-tight", children: categoryTitle }), _jsx("div", { class: "text-xs text-text-sub font-mono mt-0.5", children: shortId })] })] }), _jsxs("div", { class: "text-right", children: [_jsxs("span", { class: "text-base font-bold text-action", children: ["\u20B9", booking.visitingFee.toFixed(2)] }), _jsx("div", { class: "text-xs text-text-sub", children: t('booking.cash_on_completion') })] })] }), _jsxs("div", { class: `w-full flex items-center space-x-2 p-3 rounded-lg border ${badgeStyle?.bg} ${badgeStyle?.text}`, children: [_jsx("span", { class: `w-2.5 h-2.5 rounded-full ${badgeStyle?.dot} shrink-0 animate-pulse` }), _jsx("span", { class: "text-xs font-bold leading-normal", children: booking.status === 'PROVIDER_ASSIGNED' && booking.provider?.name
                                                    ? t('status.provider_assigned', { name: booking.provider.name })
                                                    : booking.status === 'PAYMENT_PENDING'
                                                        ? t('status.payment_pending', { amount: (booking.finalAmount ?? booking.visitingFee).toFixed(2) })
                                                        : t(statusKey) })] }), booking.provider?.name ? (_jsxs("div", { class: "bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-xs flex items-center justify-between", children: [_jsxs("span", { class: "text-text-sub font-medium", children: [t('detail.provider_label'), ":"] }), _jsx("span", { class: "font-bold text-brand", children: booking.provider.name })] })) : (!isExceptionalStatus && (_jsxs("div", { class: "bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-text-sub flex items-center space-x-2", children: [_jsx(ClockIcon, { size: 15, class: "text-slate-400 shrink-0" }), _jsx("span", { children: t('detail.no_provider') })] })))] }), _jsxs("section", { class: "bg-surface border border-border rounded-lg p-4 shadow-sm space-y-3", children: [_jsxs("div", { class: "flex items-center justify-between pb-2 border-b border-slate-100", children: [_jsx("h3", { class: "text-xs font-bold text-text-sub uppercase tracking-wider", children: t('detail.timeline_title') }), isLoading && (_jsxs("div", { class: "flex items-center space-x-1 text-xs text-brand", children: [_jsx(SpinnerIcon, { size: 12 }), _jsx("span", { children: t('detail.refreshing') })] }))] }), _jsxs("div", { class: "relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200", children: [ORDERED_STAGES.map((stage, idx) => {
                                                const logEntry = logsByStatus.get(stage.status);
                                                const isPassed = currentStatusIndex > idx || (currentStatusIndex === -1 && Boolean(logEntry));
                                                const isCurrent = booking.status === stage.status;
                                                const isPending = !isPassed && !isCurrent;
                                                // Provider assigned name template & payment pending handling
                                                let stageText = t(stage.labelKey);
                                                if (stage.status === 'PROVIDER_ASSIGNED') {
                                                    stageText = booking.provider?.name
                                                        ? t('status.provider_assigned', { name: booking.provider.name })
                                                        : (lang === 'hi' ? 'मिस्त्री नियुक्त' : 'Technician assigned');
                                                }
                                                else if (stage.status === 'PAYMENT_PENDING') {
                                                    const fee = booking.finalAmount ?? booking.visitingFee;
                                                    stageText = t('status.payment_pending', { amount: fee.toFixed(2) });
                                                }
                                                let dotClass = 'border-slate-300 bg-white text-slate-400';
                                                if (isPassed) {
                                                    dotClass = 'bg-action text-white border-action';
                                                }
                                                else if (isCurrent) {
                                                    dotClass = 'bg-brand text-white border-brand ring-4 ring-brand/20';
                                                }
                                                return (_jsxs("div", { class: "relative flex items-start space-x-3 text-xs", children: [_jsx("span", { class: `absolute -left-6 top-0.5 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${dotClass}`, children: isPassed ? _jsx(CheckIcon, { size: 12 }) : idx + 1 }), _jsxs("div", { class: "flex-1 min-w-0", children: [_jsx("div", { class: `font-semibold ${isCurrent
                                                                        ? 'text-brand font-bold'
                                                                        : isPassed
                                                                            ? 'text-text-main'
                                                                            : 'text-text-sub/70'}`, children: stageText }), logEntry && (_jsx("div", { class: "text-[11px] text-text-sub mt-0.5", children: formatDateTime(logEntry.createdAt, lang) }))] })] }, stage.status));
                                            }), isExceptionalStatus && (_jsxs("div", { class: "relative flex items-start space-x-3 text-xs pt-1", children: [_jsx("span", { class: "absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xs ring-4 ring-red-100", children: "\u2715" }), _jsxs("div", { class: "flex-1 bg-red-50 border border-red-200 rounded p-2.5", children: [_jsx("div", { class: "font-bold text-red-700", children: t(statusKey) }), _jsx("div", { class: "text-[11px] text-red-600 mt-0.5", children: formatDateTime(booking.updatedAt, lang) })] })] }))] })] }), (booking.textDescription || booking.audioUrl) && (_jsxs("section", { class: "bg-surface border border-border rounded-lg p-4 shadow-sm space-y-3", children: [_jsx("h3", { class: "text-xs font-bold text-text-sub uppercase tracking-wider", children: t('booking.step1_title') }), booking.textDescription && (_jsx("div", { class: "bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-text-main leading-relaxed", children: booking.textDescription })), booking.audioUrl && (_jsxs("div", { class: "border border-border rounded-lg p-3 space-y-2 bg-white", children: [_jsxs("div", { class: "flex items-center justify-between", children: [_jsxs("div", { class: "flex items-center space-x-2", children: [_jsx("div", { class: "w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0", children: _jsx(MicIcon, { size: 18 }) }), _jsxs("div", { children: [_jsx("div", { class: "text-xs font-bold text-text-main", children: t('detail.audio_note_title') }), booking.audioDurationSeconds && (_jsxs("div", { class: "text-[11px] text-text-sub", children: [booking.audioDurationSeconds, " ", lang === 'hi' ? 'सेकंड' : 'seconds'] }))] })] }), _jsx("button", { type: "button", onClick: () => toggleDetailAudio(booking.audioUrl), class: "min-h-[48px] px-4 py-2 bg-brand hover:bg-brand-dark text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center space-x-2", "aria-label": isPlaying ? t('booking.audio_stop') : t('booking.audio_play'), children: isPlaying ? (_jsxs(_Fragment, { children: [_jsx(PauseIcon, { size: 14 }), _jsx("span", { children: t('booking.audio_stop') })] })) : (_jsxs(_Fragment, { children: [_jsx(PlayIcon, { size: 14 }), _jsx("span", { children: t('booking.audio_play') })] })) })] }), audioError && (_jsx("p", { class: "text-xs text-red-600 font-medium pt-1", children: t('detail.audio_error') }))] }))] })), _jsxs("section", { class: "bg-surface border border-border rounded-lg p-4 shadow-sm space-y-2.5", children: [_jsx("h3", { class: "text-xs font-bold text-text-sub uppercase tracking-wider", children: t('detail.service_address') }), _jsxs("div", { class: "text-xs space-y-1.5", children: [_jsxs("div", { class: "flex items-start justify-between", children: [_jsxs("span", { class: "text-text-sub", children: [t('booking.select_locality'), ":"] }), _jsx("span", { class: "font-semibold text-text-main text-right", children: localityName })] }), booking.landmark && (_jsxs("div", { class: "flex items-start justify-between", children: [_jsxs("span", { class: "text-text-sub", children: [t('booking.landmark_label'), ":"] }), _jsx("span", { class: "font-medium text-text-main text-right", children: booking.landmark })] })), _jsxs("div", { class: "flex items-center justify-between pt-2 border-t border-slate-100", children: [_jsxs("span", { class: "text-text-sub", children: [t('detail.created_at'), ":"] }), _jsx("span", { class: "text-text-main", children: formatDateTime(booking.createdAt, lang) })] }), _jsxs("div", { class: "flex items-center justify-between", children: [_jsxs("span", { class: "text-text-sub", children: [t('booking.cash_on_completion'), ":"] }), _jsxs("span", { class: "font-bold text-action text-sm", children: ["\u20B9", booking.visitingFee.toFixed(2)] })] })] })] }), _jsx("div", { children: _jsxs("button", { type: "button", onClick: () => closeBookingDetail(), class: "w-full min-h-[48px] px-4 py-3 bg-slate-100 hover:bg-slate-200 text-text-main font-bold rounded-lg text-sm transition-colors flex items-center justify-center space-x-2", children: [_jsx(ArrowLeftIcon, { size: 18 }), _jsx("span", { children: t('app.back') })] }) })] }))] })] }));
}
