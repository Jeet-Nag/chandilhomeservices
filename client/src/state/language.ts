import { signal, computed } from '@preact/signals';
import { i18n, Language, TranslationKey } from '@shared';

const STORAGE_KEY = 'chandil_lang';

function getInitialLanguage(): Language | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'hi') {
      return stored;
    }
  } catch {
    // LocalStorage unavailable/restricted
  }
  return null;
}

export const currentLanguage = signal<Language | null>(getInitialLanguage());

export const isLanguageChosen = computed(() => currentLanguage.value !== null);

export function selectLanguage(lang: Language): void {
  currentLanguage.value = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // LocalStorage quota or restricted
  }
}

/**
 * Reactive translation helper.
 * When currentLanguage signal updates, components accessing this re-render instantly.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const lang = currentLanguage.value || 'en';
  return i18n.t(key, params, lang);
}
