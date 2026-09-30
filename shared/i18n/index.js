import { en } from './en';
import { hi } from './hi';
export * from './types';
export { en, hi };
export class I18nService {
    currentLanguage = null;
    fallbackLanguage = 'en';
    constructor(initialLang) {
        if (initialLang !== undefined) {
            this.currentLanguage = initialLang;
        }
    }
    setLanguage(lang) {
        this.currentLanguage = lang;
    }
    getLanguage() {
        return this.currentLanguage;
    }
    getEffectiveLanguage() {
        return this.currentLanguage || this.fallbackLanguage;
    }
    isLanguageSelected() {
        return this.currentLanguage !== null;
    }
    t(key, params, langOverride) {
        const lang = langOverride || this.getEffectiveLanguage();
        const dict = lang === 'hi' ? hi : en;
        let text = dict[key] || en[key] || key;
        if (params) {
            for (const [paramKey, value] of Object.entries(params)) {
                text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
            }
        }
        return text;
    }
}
export const i18n = new I18nService();
