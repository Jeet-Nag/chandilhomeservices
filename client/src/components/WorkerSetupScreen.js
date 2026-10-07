import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useEffect } from 'preact/hooks';
import { workerFullName, workerCategoryId, aadhaarFront, aadhaarBack, workerPhoto, isSubmittingWorker, workerSubmitError, submitWorkerOnboarding, } from '../state/worker';
import { categories, fetchCategories } from '../state/categories';
import { currentUser, logout } from '../state/auth';
import { currentLanguage, selectLanguage, t } from '../state/language';
import { DocumentUploadCard } from './DocumentUploadCard';
import { SpinnerIcon, AlertCircleIcon, LogOutIcon } from './icons';
import { INITIAL_SERVICE_CATEGORIES } from '@shared';
export function WorkerSetupScreen() {
    const lang = currentLanguage.value || 'en';
    useEffect(() => {
        if (categories.value.length === 0) {
            fetchCategories();
        }
    }, []);
    // Use loaded categories or fallback to INITIAL_SERVICE_CATEGORIES
    const availableCategories = categories.value.length > 0 ? categories.value : INITIAL_SERVICE_CATEGORIES;
    const handleSubmit = async (e) => {
        e.preventDefault();
        await submitWorkerOnboarding();
    };
    return (_jsxs("div", { class: "min-h-screen flex flex-col bg-background", children: [_jsx("header", { class: "bg-brand text-white px-4 py-3 sticky top-0 z-10 shadow-sm", children: _jsxs("div", { class: "max-w-md mx-auto flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { class: "text-base font-bold leading-tight", children: t('app.title') }), _jsx("p", { class: "text-xs text-slate-300 leading-tight", children: t('onboarding.worker_title') })] }), _jsxs("div", { class: "flex items-center space-x-2", children: [_jsxs("div", { class: "flex items-center bg-brand-dark p-0.5 rounded border border-slate-600", children: [_jsx("button", { type: "button", onClick: () => selectLanguage('en'), class: `px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${lang === 'en' ? 'bg-action text-white' : 'text-slate-300 hover:text-white'}`, "aria-label": "Switch to English", children: "EN" }), _jsx("button", { type: "button", onClick: () => selectLanguage('hi'), class: `px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${lang === 'hi' ? 'bg-action text-white' : 'text-slate-300 hover:text-white'}`, "aria-label": "\u0939\u093F\u0902\u0926\u0940 \u092D\u093E\u0937\u093E \u091A\u0941\u0928\u0947\u0902", children: "\u0939\u093F\u0902\u0926\u0940" })] }), _jsx("button", { type: "button", onClick: () => logout(), class: "p-2 text-slate-300 hover:text-white rounded min-h-[40px] min-w-[40px] flex items-center justify-center border border-slate-600 hover:border-slate-400", title: t('auth.logout'), "aria-label": t('auth.logout'), children: _jsx(LogOutIcon, { size: 18 }) })] })] }) }), _jsxs("main", { class: "flex-1 p-4 max-w-md mx-auto w-full space-y-4", children: [_jsxs("section", { class: "bg-surface border border-border rounded-lg p-5 shadow-xs", children: [_jsx("h2", { class: "text-lg font-bold text-text-main leading-tight", children: t('onboarding.worker_setup_title') }), _jsx("p", { class: "text-xs text-text-sub mt-1 leading-relaxed", children: t('onboarding.worker_setup_sub') }), currentUser.value && (_jsx("div", { class: "mt-2 text-xs font-semibold text-text-main bg-slate-100 px-2.5 py-1 rounded inline-block", children: t('auth.logged_in_as', { phone: `+91 ${currentUser.value.phone}` }) }))] }), workerSubmitError.value && (_jsxs("div", { class: "p-3.5 rounded-lg bg-red-50 border border-red-200 text-danger text-sm flex items-start space-x-2.5 shadow-xs", children: [_jsx(AlertCircleIcon, { size: 18, class: "mt-0.5 shrink-0" }), _jsx("span", { class: "leading-snug", children: workerSubmitError.value })] })), _jsxs("form", { onSubmit: handleSubmit, class: "space-y-4", children: [_jsxs("div", { class: "bg-surface border border-border rounded-lg p-4 space-y-2", children: [_jsx("label", { for: "worker-fullname-input", class: "block text-sm font-bold text-text-main", children: t('onboarding.full_name_required') }), _jsx("input", { id: "worker-fullname-input", type: "text", required: true, maxLength: 100, placeholder: t('onboarding.full_name_placeholder'), value: workerFullName.value, onInput: (e) => {
                                            workerFullName.value = e.target.value;
                                            workerSubmitError.value = null;
                                        }, class: "w-full px-3.5 py-3 border-2 border-border rounded-lg text-base text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]" })] }), _jsxs("div", { class: "bg-surface border border-border rounded-lg p-4 space-y-2", children: [_jsx("label", { for: "worker-category-select", class: "block text-sm font-bold text-text-main", children: t('onboarding.work_category_label') }), _jsxs("select", { id: "worker-category-select", required: true, value: workerCategoryId.value, onChange: (e) => {
                                            workerCategoryId.value = e.target.value;
                                            workerSubmitError.value = null;
                                        }, class: "w-full px-3.5 py-3 border-2 border-border rounded-lg text-base text-text-main bg-white focus:outline-none focus:border-brand min-h-[48px]", children: [_jsxs("option", { value: "", disabled: true, children: ["-- ", t('onboarding.select_category_prompt'), " --"] }), availableCategories.map((cat) => (_jsx("option", { value: cat.id, children: lang === 'hi' ? cat.titleHi : cat.titleEn }, cat.id)))] })] }), _jsx(DocumentUploadCard, { title: t('onboarding.aadhaar_front_label'), subtitle: lang === 'hi' ? 'आधार कार्ड के सामने का स्पष्ट फोटो' : 'Clear photo of Aadhaar front', imageState: aadhaarFront.value, onImageSelected: (st) => {
                                    aadhaarFront.value = st;
                                    workerSubmitError.value = null;
                                }, onRetake: () => {
                                    aadhaarFront.value = null;
                                }, isPhoto: false, required: true }), _jsx(DocumentUploadCard, { title: t('onboarding.aadhaar_back_label'), subtitle: lang === 'hi' ? 'आधार कार्ड के पीछे का स्पष्ट फोटो' : 'Clear photo of Aadhaar back', imageState: aadhaarBack.value, onImageSelected: (st) => {
                                    aadhaarBack.value = st;
                                    workerSubmitError.value = null;
                                }, onRetake: () => {
                                    aadhaarBack.value = null;
                                }, isPhoto: false, required: true }), _jsx(DocumentUploadCard, { title: t('onboarding.photo_title'), subtitle: t('onboarding.photo_sub'), imageState: workerPhoto.value, onImageSelected: (st) => {
                                    workerPhoto.value = st;
                                    workerSubmitError.value = null;
                                }, onRetake: () => {
                                    workerPhoto.value = null;
                                }, isPhoto: true, required: true }), _jsx("div", { class: "pt-2", children: _jsx("button", { type: "submit", id: "worker-submit-btn", disabled: isSubmittingWorker.value, class: `w-full min-h-[48px] px-6 py-3.5 font-bold rounded-lg text-base transition-colors flex items-center justify-center space-x-2 shadow-sm ${!isSubmittingWorker.value
                                        ? 'bg-action hover:bg-action-active text-white cursor-pointer'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`, children: isSubmittingWorker.value ? (_jsxs(_Fragment, { children: [_jsx(SpinnerIcon, { size: 20, class: "text-white" }), _jsx("span", { children: t('onboarding.submitting_profile') })] })) : (_jsx("span", { children: t('onboarding.btn_submit_profile') })) }) })] })] }), _jsx("footer", { class: "bg-surface border-t border-border p-3 max-w-md mx-auto w-full text-center text-xs text-text-sub", children: _jsx("span", { children: t('home.service_area_label') }) })] }));
}
