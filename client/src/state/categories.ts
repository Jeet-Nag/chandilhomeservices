import { signal } from '@preact/signals';
import { ServiceCategory, ApiResponse } from '@shared';
import { authToken, handleSessionExpired } from './auth';
import { currentLanguage } from './language';

export const categories = signal<ServiceCategory[]>([]);
export const selectedCategory = signal<ServiceCategory | null>(null);
export const categoriesLoading = signal<boolean>(false);
export const categoriesError = signal<string | null>(null);
export const isSelectingCategory = signal<boolean>(false);

export async function fetchCategories(): Promise<void> {
  const token = authToken.value;
  if (!token) {
    return;
  }

  categoriesLoading.value = true;
  categoriesError.value = null;

  try {
    const res = await fetch('/api/categories', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      handleSessionExpired();
      return;
    }

    const body: ApiResponse<ServiceCategory[]> = await res.json();

    if (!res.ok || !body.success || !body.data) {
      categoriesError.value = currentLanguage.value === 'hi'
        ? (body.error?.messageHi || 'सेवा श्रेणियां लोड करने में असमर्थ।')
        : (body.error?.messageEn || 'Unable to load service categories.');
      return;
    }

    categories.value = body.data;
  } catch {
    categoriesError.value = currentLanguage.value === 'hi'
      ? 'इंटरनेट धीमा है। कृपया कनेक्शन जांचें।'
      : 'Weak network. Please check your connection.';
  } finally {
    categoriesLoading.value = false;
  }
}

/**
 * Handles category selection with strict double-tap prevention
 * and inactive category rejection.
 */
export function selectCategory(category: ServiceCategory): void {
  // Reject if category is inactive
  if (!category.isActive) {
    return;
  }

  // Double-tap debounce protection
  if (isSelectingCategory.value) {
    return;
  }

  isSelectingCategory.value = true;
  selectedCategory.value = category;

  // Release selection lock after debounce window
  setTimeout(() => {
    isSelectingCategory.value = false;
  }, 400);
}

export function clearCategorySelection(): void {
  selectedCategory.value = null;
}
