import { signal, computed } from '@preact/signals';
import { ApiResponse, AdminProviderView } from '@shared';
import { authToken, handleSessionExpired } from './auth';
import { currentLanguage, t } from './language';

// Provider list state
export const providersList = signal<AdminProviderView[]>([]);
export const isProvidersLoading = signal<boolean>(false);
export const providersError = signal<string | null>(null);

// Search & Filter state
export const providerSearchQuery = signal<string>('');
export const providerStatusFilter = signal<'all' | 'active' | 'inactive'>('all');
export const providerCategoryFilter = signal<string>('all');

// Modals & Mutation state
export const isAddModalOpen = signal<boolean>(false);
export const isEditModalOpen = signal<boolean>(false);
export const editingProvider = signal<AdminProviderView | null>(null);
export const isFormSubmitting = signal<boolean>(false);
export const formError = signal<string | null>(null);
export const formSuccessMessage = signal<string | null>(null);

// Status toggling state
export const deactivatingProvider = signal<AdminProviderView | null>(null);
export const isDeactivating = signal<boolean>(false);
export const deactivationError = signal<string | null>(null);
export const statusTogglingId = signal<string | null>(null);

// Add form field signals
export const addFullName = signal<string>('');
export const addPhone = signal<string>('');
export const addCategoryId = signal<string>('');
export const addPreferredLanguage = signal<'hi' | 'en'>('hi');
export const addServiceArea = signal<string>('Chandil');

// Edit form field signals
export const editFullName = signal<string>('');
export const editCategoryId = signal<string>('');
export const editPreferredLanguage = signal<'hi' | 'en'>('hi');
export const editServiceArea = signal<string>('Chandil');

/**
 * Filtered providers based on status, category, and client-side immediate search.
 */
export const filteredProviders = computed(() => {
  const query = providerSearchQuery.value.trim().toLowerCase();
  const status = providerStatusFilter.value;
  const category = providerCategoryFilter.value;

  return providersList.value.filter((provider) => {
    // 1. Status Filter
    if (status === 'active' && !provider.isActive) return false;
    if (status === 'inactive' && provider.isActive) return false;

    // 2. Category Filter
    if (category !== 'all' && provider.categoryId !== category) return false;

    // 3. Search Query Filter (name or phone)
    if (query) {
      const nameMatch = (provider.fullName || '').toLowerCase().includes(query);
      const phoneMatch = provider.phone.includes(query);
      if (!nameMatch && !phoneMatch) return false;
    }

    return true;
  });
});

/**
 * Fetch all registered providers from GET /api/admin/providers.
 */
export async function fetchAdminProviders(categoryId?: string, isActive?: boolean): Promise<void> {
  const token = authToken.value;
  if (!token) return;

  isProvidersLoading.value = true;
  providersError.value = null;

  try {
    const params = new URLSearchParams();
    if (categoryId && categoryId !== 'all') {
      params.append('category_id', categoryId);
    }
    if (isActive !== undefined) {
      params.append('is_active', String(isActive));
    }

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/admin/providers${qs}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      handleSessionExpired();
      return;
    }

    const body: ApiResponse<{ providers: AdminProviderView[] }> = await res.json();

    if (!res.ok || !body.success || !body.data) {
      providersError.value =
        currentLanguage.value === 'hi'
          ? body.error?.messageHi || 'मिस्त्री लोड करने में असमर्थ।'
          : body.error?.messageEn || 'Unable to load providers.';
      return;
    }

    providersList.value = body.data.providers;
  } catch {
    providersError.value =
      currentLanguage.value === 'hi'
        ? 'इंटरनेट कनेक्शन जांचें।'
        : 'Network error. Please check your connection.';
  } finally {
    isProvidersLoading.value = false;
  }
}

/**
 * Open the Add Provider modal and reset form inputs.
 */
export function openAddModal(defaultCategoryId?: string): void {
  addFullName.value = '';
  addPhone.value = '';
  addCategoryId.value = defaultCategoryId || '';
  addPreferredLanguage.value = 'hi';
  addServiceArea.value = 'Chandil';
  formError.value = null;
  isAddModalOpen.value = true;
}

/**
 * Close Add Provider modal (guarded against in-flight submission).
 */
export function closeAddModal(): void {
  if (isFormSubmitting.value) return;
  isAddModalOpen.value = false;
  formError.value = null;
}

/**
 * Submit new provider registration via POST /api/admin/providers.
 */
export async function submitAddProvider(): Promise<boolean> {
  const token = authToken.value;
  if (!token || isFormSubmitting.value) return false;

  const fullName = addFullName.value.trim();
  const phone = addPhone.value.trim();
  const categoryId = addCategoryId.value.trim();
  const preferredLanguage = addPreferredLanguage.value;
  const serviceArea = addServiceArea.value.trim() || 'Chandil';

  // Client-side validation
  if (fullName.length < 2) {
    formError.value = t('admin.val_name_required');
    return false;
  }

  if (!/^[6-9]\d{9}$/.test(phone)) {
    formError.value = t('admin.val_phone_invalid');
    return false;
  }

  if (!categoryId) {
    formError.value = t('admin.val_category_required');
    return false;
  }

  isFormSubmitting.value = true;
  formError.value = null;

  try {
    const res = await fetch('/api/admin/providers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fullName,
        phone,
        categoryId,
        preferredLanguage,
        serviceArea,
      }),
    });

    if (res.status === 401) {
      handleSessionExpired();
      return false;
    }

    const body: ApiResponse<{ provider: AdminProviderView }> = await res.json();

    if (!res.ok || !body.success) {
      if (body.error?.code === 'PHONE_ALREADY_REGISTERED') {
        formError.value = t('admin.phone_already_registered');
      } else if (body.error?.code === 'CATEGORY_NOT_FOUND') {
        formError.value = t('admin.category_not_found');
      } else {
        formError.value =
          currentLanguage.value === 'hi'
            ? body.error?.messageHi || 'मिस्त्री जोड़ने में त्रुटि हुई।'
            : body.error?.messageEn || 'Error creating provider.';
      }
      return false;
    }

    // Success: close modal, set toast, refresh list
    isAddModalOpen.value = false;
    formSuccessMessage.value = t('admin.provider_created_success');
    await fetchAdminProviders();
    return true;
  } catch {
    formError.value =
      currentLanguage.value === 'hi'
        ? 'नेटवर्क त्रुटि। कृपया पुनः प्रयास करें।'
        : 'Network error. Please try again.';
    return false;
  } finally {
    isFormSubmitting.value = false;
  }
}

/**
 * Open the Edit Provider modal with prefilled data.
 */
export function openEditModal(provider: AdminProviderView): void {
  editingProvider.value = provider;
  editFullName.value = provider.fullName || '';
  editCategoryId.value = provider.categoryId;
  editPreferredLanguage.value = provider.preferredLanguage || 'hi';
  editServiceArea.value = provider.serviceArea || 'Chandil';
  formError.value = null;
  isEditModalOpen.value = true;
}

/**
 * Close Edit Provider modal (guarded against in-flight submission).
 */
export function closeEditModal(): void {
  if (isFormSubmitting.value) return;
  isEditModalOpen.value = false;
  editingProvider.value = null;
  formError.value = null;
}

/**
 * Submit updated provider details via PATCH /api/admin/providers/:id.
 * Note: Phone number is strictly read-only and NOT sent.
 */
export async function submitEditProvider(): Promise<boolean> {
  const token = authToken.value;
  const provider = editingProvider.value;
  if (!token || !provider || isFormSubmitting.value) return false;

  const fullName = editFullName.value.trim();
  const categoryId = editCategoryId.value.trim();
  const preferredLanguage = editPreferredLanguage.value;
  const serviceArea = editServiceArea.value.trim() || 'Chandil';

  // Client-side validation
  if (fullName.length < 2) {
    formError.value = t('admin.val_name_required');
    return false;
  }

  if (!categoryId) {
    formError.value = t('admin.val_category_required');
    return false;
  }

  isFormSubmitting.value = true;
  formError.value = null;

  try {
    const res = await fetch(`/api/admin/providers/${provider.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fullName,
        categoryId,
        preferredLanguage,
        serviceArea,
      }),
    });

    if (res.status === 401) {
      handleSessionExpired();
      return false;
    }

    const body: ApiResponse<{ provider: AdminProviderView }> = await res.json();

    if (!res.ok || !body.success) {
      if (body.error?.code === 'CATEGORY_NOT_FOUND') {
        formError.value = t('admin.category_not_found');
      } else {
        formError.value =
          currentLanguage.value === 'hi'
            ? body.error?.messageHi || 'विवरण अपडेट करने में त्रुटि हुई।'
            : body.error?.messageEn || 'Error updating provider.';
      }
      return false;
    }

    // Success: close modal, set toast, refresh list
    isEditModalOpen.value = false;
    editingProvider.value = null;
    formSuccessMessage.value = t('admin.provider_updated_success');
    await fetchAdminProviders();
    return true;
  } catch {
    formError.value =
      currentLanguage.value === 'hi'
        ? 'नेटवर्क त्रुटि। कृपया पुनः प्रयास करें।'
        : 'Network error. Please try again.';
    return false;
  } finally {
    isFormSubmitting.value = false;
  }
}

/**
 * Open Deactivation confirmation modal.
 */
export function openDeactivateModal(provider: AdminProviderView): void {
  deactivatingProvider.value = provider;
  deactivationError.value = null;
}

/**
 * Close Deactivation confirmation modal.
 */
export function closeDeactivateModal(): void {
  if (isDeactivating.value) return;
  deactivatingProvider.value = null;
  deactivationError.value = null;
}

/**
 * Confirm and execute provider deactivation via POST /api/admin/providers/:id/status.
 */
export async function confirmDeactivation(): Promise<boolean> {
  const token = authToken.value;
  const provider = deactivatingProvider.value;
  if (!token || !provider || isDeactivating.value) return false;

  isDeactivating.value = true;
  deactivationError.value = null;

  try {
    const res = await fetch(`/api/admin/providers/${provider.id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isActive: false }),
    });

    if (res.status === 401) {
      handleSessionExpired();
      return false;
    }

    const body: ApiResponse<{ provider: AdminProviderView }> = await res.json();

    if (!res.ok || !body.success) {
      if (res.status === 409 || body.error?.code === 'ACTIVE_BOOKING_EXISTS') {
        deactivationError.value = t('admin.deactivate_active_booking_error');
      } else {
        deactivationError.value =
          currentLanguage.value === 'hi'
            ? body.error?.messageHi || 'निष्क्रिय करने में त्रुटि हुई।'
            : body.error?.messageEn || 'Failed to deactivate provider.';
      }
      return false;
    }

    deactivatingProvider.value = null;
    formSuccessMessage.value = t('admin.provider_deactivated_success');
    await fetchAdminProviders();
    return true;
  } catch {
    deactivationError.value =
      currentLanguage.value === 'hi'
        ? 'नेटवर्क त्रुटि। कृपया पुनः प्रयास करें।'
        : 'Network error. Please try again.';
    return false;
  } finally {
    isDeactivating.value = false;
  }
}

/**
 * Reactivate an inactive provider directly via POST /api/admin/providers/:id/status.
 */
export async function activateProvider(provider: AdminProviderView): Promise<boolean> {
  const token = authToken.value;
  if (!token || statusTogglingId.value) return false;

  statusTogglingId.value = provider.id;

  try {
    const res = await fetch(`/api/admin/providers/${provider.id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isActive: true }),
    });

    if (res.status === 401) {
      handleSessionExpired();
      return false;
    }

    const body: ApiResponse<{ provider: AdminProviderView }> = await res.json();

    if (!res.ok || !body.success) {
      providersError.value =
        currentLanguage.value === 'hi'
          ? body.error?.messageHi || 'सक्रिय करने में त्रुटि हुई।'
          : body.error?.messageEn || 'Failed to activate provider.';
      return false;
    }

    formSuccessMessage.value = t('admin.provider_activated_success');
    await fetchAdminProviders();
    return true;
  } catch {
    providersError.value =
      currentLanguage.value === 'hi'
        ? 'नेटवर्क त्रुटि। कृपया पुनः प्रयास करें।'
        : 'Network error. Please try again.';
    return false;
  } finally {
    statusTogglingId.value = null;
  }
}

/**
 * Clear the temporary success message banner.
 */
export function clearSuccessMessage(): void {
  formSuccessMessage.value = null;
}
