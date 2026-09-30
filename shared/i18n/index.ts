import { en } from './en';
import { hi } from './hi';
import { Language, TranslationKey } from './types';

export * from './types';
export { en, hi };

export class I18nService {
  private currentLanguage: Language | null = null;
  private readonly fallbackLanguage: Language = 'en';

  constructor(initialLang?: Language | null) {
    if (initialLang !== undefined) {
      this.currentLanguage = initialLang;
    }
  }

  public setLanguage(lang: Language): void {
    this.currentLanguage = lang;
  }

  public getLanguage(): Language | null {
    return this.currentLanguage;
  }

  public getEffectiveLanguage(): Language {
    return this.currentLanguage || this.fallbackLanguage;
  }

  public isLanguageSelected(): boolean {
    return this.currentLanguage !== null;
  }

  public t(key: TranslationKey, params?: Record<string, string | number>, langOverride?: Language): string {
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
