import { signal } from '@preact/signals';
import { ApiResponse, SupportConfig } from '@shared';

export const supportPhone = signal<string | null>(null);
export const supportWhatsApp = signal<string | null>(null);
export const isConfigLoading = signal<boolean>(false);

/**
 * Fetches platform support contacts from /api/config/support.
 * Gracefully caches values in signals and handles errors silently.
 */
export async function fetchSupportConfig(): Promise<void> {
  if (isConfigLoading.value || (supportPhone.value && supportWhatsApp.value)) {
    return;
  }

  isConfigLoading.value = true;
  try {
    const res = await fetch('/api/config/support');
    if (res.ok) {
      const body: ApiResponse<SupportConfig> = await res.json();
      if (body.success && body.data) {
        supportPhone.value = body.data.supportPhone || null;
        supportWhatsApp.value = body.data.supportWhatsApp || null;
      }
    }
  } catch {
    // Graceful fallback: maintain existing signals or null
  } finally {
    isConfigLoading.value = false;
  }
}
