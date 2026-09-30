import { signal, computed } from '@preact/signals';
import { i18n } from '@shared';
const STORAGE_KEY = 'chandil_lang';
function getInitialLanguage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'en' || stored === 'hi') {
            return stored;
        }
    }
    catch {
        // LocalStorage unavailable/restricted
    }
    return null;
}
export const currentLanguage = signal(getInitialLanguage());
export const isLanguageChosen = computed(() => currentLanguage.value !== null);
export function selectLanguage(lang) {
    currentLanguage.value = lang;
    try {
        localStorage.setItem(STORAGE_KEY, lang);
    }
    catch {
        // LocalStorage quota or restricted
    }
}
/**
 * Reactive translation helper.
 * When currentLanguage signal updates, components accessing this re-render instantly.
 */
export function t(key, params) {
    const lang = currentLanguage.value || 'en';
    return i18n.t(key, params, lang);
}
