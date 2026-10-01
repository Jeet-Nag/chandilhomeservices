import { useEffect } from 'preact/hooks';
import { currentLanguage, t } from '../state/language';
import { categories, fetchCategories } from '../state/categories';
import {
  providersList,
  isProvidersLoading,
  providersError,
  providerSearchQuery,
  providerStatusFilter,
  providerCategoryFilter,
  filteredProviders,
  isAddModalOpen,
  isEditModalOpen,
  editingProvider,
  isFormSubmitting,
  formError,
  formSuccessMessage,
  deactivatingProvider,
  isDeactivating,
  deactivationError,
  statusTogglingId,
  addFullName,
  addPhone,
  addCategoryId,
  addPreferredLanguage,
  addServiceArea,
  editFullName,
  editCategoryId,
  editPreferredLanguage,
  editServiceArea,
  fetchAdminProviders,
  openAddModal,
  closeAddModal,
  submitAddProvider,
  openEditModal,
  closeEditModal,
  submitEditProvider,
  openDeactivateModal,
  closeDeactivateModal,
  confirmDeactivation,
  activateProvider,
  clearSuccessMessage,
} from '../state/admin-providers';
import {
  ToolIcon,
  SearchIcon,
  PlusIcon,
  EditIcon,
  SpinnerIcon,
  AlertCircleIcon,
  CheckIcon,
  RefreshIcon,
  XIcon,
  PhoneIcon,
} from './icons';

export function AdminProvidersView() {
  const lang = currentLanguage.value || 'en';
  const list = filteredProviders.value;
  const totalCount = providersList.value.length;
  const loading = isProvidersLoading.value;
  const error = providersError.value;
  const successMsg = formSuccessMessage.value;
  const cats = categories.value;

  useEffect(() => {
    fetchAdminProviders();
    if (cats.length === 0) {
      fetchCategories();
    }
  }, []);

  const handleClearFilters = () => {
    providerSearchQuery.value = '';
    providerStatusFilter.value = 'all';
    providerCategoryFilter.value = 'all';
  };

  return (
    <div class="space-y-6">
      {/* Top Header Section */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 class="text-xl md:text-2xl font-bold text-text-main">
            {t('admin.providers_title')}
          </h2>
          <p class="text-sm text-text-sub mt-0.5">
            {t('admin.providers_subtitle')}
          </p>
        </div>

        {/* Add Provider Button */}
        <div>
          <button
            onClick={() => openAddModal(cats[0]?.id)}
            class="min-h-[48px] px-4 py-2.5 bg-action hover:bg-action-active text-white font-semibold rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
            aria-label={t('admin.add_provider')}
          >
            <PlusIcon size={18} />
            <span>{t('admin.add_provider')}</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div class="p-4 rounded-lg bg-green-50 border border-green-200 flex items-center justify-between gap-3 text-action shadow-xs animate-fadeIn">
          <div class="flex items-center gap-2.5">
            <div class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <CheckIcon size={16} />
            </div>
            <span class="text-sm font-semibold">{successMsg}</span>
          </div>
          <button
            onClick={clearSuccessMessage}
            class="min-h-[44px] min-w-[44px] p-2 text-action/70 hover:text-action rounded-lg flex items-center justify-center"
            aria-label="Dismiss"
          >
            <XIcon size={16} />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && !loading && (
        <div class="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start justify-between gap-3 text-danger shadow-xs">
          <div class="flex items-start gap-2.5">
            <AlertCircleIcon size={20} class="shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-semibold">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchAdminProviders()}
            class="min-h-[44px] px-3 py-1.5 bg-white border border-border rounded text-xs font-semibold text-text-main hover:bg-background flex items-center gap-1.5 shrink-0"
          >
            <RefreshIcon size={14} />
            <span>{t('admin.retry')}</span>
          </button>
        </div>
      )}

      {/* Controls Bar: Search & Filters */}
      <div class="bg-surface border border-border rounded-lg p-4 shadow-xs space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div class="md:col-span-6 relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-sub">
              <SearchIcon size={18} />
            </div>
            <input
              type="text"
              value={providerSearchQuery.value}
              onInput={(e) => {
                providerSearchQuery.value = (e.target as HTMLInputElement).value;
              }}
              placeholder={t('admin.search_placeholder')}
              class="w-full min-h-[48px] pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-text-main placeholder-text-sub/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
            />
          </div>

          {/* Status Filter */}
          <div class="md:col-span-3">
            <select
              value={providerStatusFilter.value}
              onChange={(e) => {
                providerStatusFilter.value = (e.target as HTMLSelectElement).value as any;
              }}
              class="w-full min-h-[48px] px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
              aria-label="Filter by status"
            >
              <option value="all">{t('admin.filter_all')}</option>
              <option value="active">{t('admin.filter_active')}</option>
              <option value="inactive">{t('admin.filter_inactive')}</option>
            </select>
          </div>

          {/* Category Filter */}
          <div class="md:col-span-3">
            <select
              value={providerCategoryFilter.value}
              onChange={(e) => {
                providerCategoryFilter.value = (e.target as HTMLSelectElement).value;
              }}
              class="w-full min-h-[48px] px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
              aria-label="Filter by category"
            >
              <option value="all">{t('admin.filter_category_all')}</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {lang === 'hi' ? c.titleHi : c.titleEn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div class="bg-surface border border-border rounded-lg p-12 text-center shadow-xs">
          <div class="flex flex-col items-center justify-center gap-3">
            <SpinnerIcon size={32} class="text-brand animate-spin" />
            <p class="text-sm font-medium text-text-sub">{t('admin.loading')}</p>
          </div>
        </div>
      )}

      {/* Empty State: Zero registered providers */}
      {!loading && totalCount === 0 && (
        <div class="bg-surface border border-border rounded-lg p-10 text-center shadow-xs">
          <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center text-text-sub">
            <ToolIcon size={28} />
          </div>
          <h3 class="text-base font-bold text-text-main mb-1">
            {t('admin.no_providers_registered')}
          </h3>
          <p class="text-sm text-text-sub max-w-md mx-auto mb-6">
            {t('admin.no_providers_registered_desc')}
          </p>
          <button
            onClick={() => openAddModal(cats[0]?.id)}
            class="min-h-[48px] px-5 py-2.5 bg-action hover:bg-action-active text-white font-semibold rounded-lg shadow-xs inline-flex items-center gap-2 transition-colors"
          >
            <PlusIcon size={18} />
            <span>{t('admin.add_provider')}</span>
          </button>
        </div>
      )}

      {/* Empty State: Search/Filter produced zero results */}
      {!loading && totalCount > 0 && list.length === 0 && (
        <div class="bg-surface border border-border rounded-lg p-8 text-center shadow-xs">
          <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center text-text-sub">
            <SearchIcon size={24} />
          </div>
          <h3 class="text-base font-semibold text-text-main mb-1">
            {t('admin.no_providers_match')}
          </h3>
          <p class="text-xs text-text-sub mb-4">
            {t('admin.search_placeholder')}
          </p>
          <button
            onClick={handleClearFilters}
            class="min-h-[48px] px-4 py-2 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors"
          >
            {t('admin.clear_filters')}
          </button>
        </div>
      )}

      {/* Provider List (Desktop Table View) */}
      {!loading && list.length > 0 && (
        <div class="hidden md:block bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-border text-xs font-bold text-text-sub uppercase tracking-wider">
                <th class="py-3.5 px-4">{t('admin.col_name')}</th>
                <th class="py-3.5 px-4">{t('admin.col_phone')}</th>
                <th class="py-3.5 px-4">{t('admin.col_category')}</th>
                <th class="py-3.5 px-4">{t('admin.col_area')}</th>
                <th class="py-3.5 px-4">{t('admin.col_status')}</th>
                <th class="py-3.5 px-4">{t('admin.col_availability')}</th>
                <th class="py-3.5 px-4 text-right">{t('admin.col_actions')}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border text-sm">
              {list.map((provider) => {
                const categoryTitle =
                  lang === 'hi' ? provider.categoryTitleHi : provider.categoryTitleEn;
                const isToggling = statusTogglingId.value === provider.id;

                return (
                  <tr key={provider.id} class="hover:bg-slate-50/75 transition-colors">
                    {/* Name */}
                    <td class="py-3.5 px-4 font-semibold text-text-main">
                      {provider.fullName || '—'}
                    </td>

                    {/* Phone */}
                    <td class="py-3.5 px-4 font-mono text-xs text-text-main">
                      {provider.phone}
                    </td>

                    {/* Category */}
                    <td class="py-3.5 px-4">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-brand border border-blue-200">
                        {categoryTitle}
                      </span>
                    </td>

                    {/* Service Area */}
                    <td class="py-3.5 px-4 text-text-sub text-xs">
                      {provider.serviceArea}
                    </td>

                    {/* Active / Inactive Status */}
                    <td class="py-3.5 px-4">
                      {provider.isActive ? (
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-action border border-green-200">
                          <span class="w-1.5 h-1.5 rounded-full bg-action inline-block"></span>
                          <span>{t('admin.status_active')}</span>
                        </span>
                      ) : (
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-danger border border-red-200">
                          <span class="w-1.5 h-1.5 rounded-full bg-danger inline-block"></span>
                          <span>{t('admin.status_inactive')}</span>
                        </span>
                      )}
                    </td>

                    {/* Availability */}
                    <td class="py-3.5 px-4">
                      {provider.isAvailable ? (
                        <span class="text-xs font-medium text-text-main">
                          {t('admin.available')}
                        </span>
                      ) : (
                        <span class="text-xs font-medium text-text-sub">
                          {t('admin.unavailable')}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td class="py-3.5 px-4 text-right">
                      <div class="flex items-center justify-end gap-2">
                        {/* Edit Button */}
                        <button
                          onClick={() => openEditModal(provider)}
                          class="min-h-[48px] px-3 py-2 bg-white border border-border hover:bg-background rounded-lg text-xs font-semibold text-text-main flex items-center gap-1.5 transition-colors"
                          title={t('admin.edit')}
                        >
                          <EditIcon size={14} />
                          <span>{t('admin.edit')}</span>
                        </button>

                        {/* Status Toggle Action */}
                        {provider.isActive ? (
                          <button
                            onClick={() => openDeactivateModal(provider)}
                            disabled={isToggling}
                            class="min-h-[48px] px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-danger rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            {isToggling ? (
                              <SpinnerIcon size={14} class="animate-spin inline" />
                            ) : (
                              <span>{t('admin.deactivate')}</span>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => activateProvider(provider)}
                            disabled={isToggling}
                            class="min-h-[48px] px-3 py-2 bg-green-50 hover:bg-green-100 border border-green-200 text-action rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            {isToggling ? (
                              <SpinnerIcon size={14} class="animate-spin inline" />
                            ) : (
                              <span>{t('admin.activate')}</span>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Provider List (Mobile Card View) */}
      {!loading && list.length > 0 && (
        <div class="block md:hidden space-y-3">
          {list.map((provider) => {
            const categoryTitle =
              lang === 'hi' ? provider.categoryTitleHi : provider.categoryTitleEn;
            const isToggling = statusTogglingId.value === provider.id;

            return (
              <div
                key={provider.id}
                class="bg-surface border border-border rounded-lg p-4 shadow-xs space-y-3"
              >
                {/* Header: Name and Status */}
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <h4 class="font-bold text-base text-text-main leading-tight">
                      {provider.fullName || '—'}
                    </h4>
                    <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded text-xs font-medium bg-blue-50 text-brand border border-blue-200">
                      {categoryTitle}
                    </span>
                  </div>

                  {provider.isActive ? (
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-action border border-green-200">
                      <span class="w-1.5 h-1.5 rounded-full bg-action inline-block"></span>
                      <span>{t('admin.status_active')}</span>
                    </span>
                  ) : (
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-danger border border-red-200">
                      <span class="w-1.5 h-1.5 rounded-full bg-danger inline-block"></span>
                      <span>{t('admin.status_inactive')}</span>
                    </span>
                  )}
                </div>

                {/* Info Grid */}
                <div class="grid grid-cols-2 gap-2 text-xs py-2 border-y border-border/60">
                  <div>
                    <span class="text-text-sub block">{t('admin.col_phone')}</span>
                    <span class="font-mono text-text-main font-medium">{provider.phone}</span>
                  </div>
                  <div>
                    <span class="text-text-sub block">{t('admin.col_area')}</span>
                    <span class="text-text-main font-medium">{provider.serviceArea}</span>
                  </div>
                </div>

                {/* Actions */}
                <div class="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => openEditModal(provider)}
                    class="min-h-[48px] px-3 py-2 bg-white border border-border rounded-lg text-xs font-semibold text-text-main hover:bg-background flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <EditIcon size={16} />
                    <span>{t('admin.edit')}</span>
                  </button>

                  {provider.isActive ? (
                    <button
                      onClick={() => openDeactivateModal(provider)}
                      disabled={isToggling}
                      class="min-h-[48px] px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-danger rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      {isToggling ? (
                        <SpinnerIcon size={16} class="animate-spin" />
                      ) : (
                        <span>{t('admin.deactivate')}</span>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => activateProvider(provider)}
                      disabled={isToggling}
                      class="min-h-[48px] px-3 py-2 bg-green-50 hover:bg-green-100 border border-green-200 text-action rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      {isToggling ? (
                        <SpinnerIcon size={16} class="animate-spin" />
                      ) : (
                        <span>{t('admin.activate')}</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================== */}
      {/* ADD PROVIDER MODAL                                 */}
      {/* ================================================== */}
      {isAddModalOpen.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div class="bg-surface border border-border rounded-xl w-full max-w-lg shadow-lg overflow-hidden my-8">
            {/* Modal Header */}
            <div class="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 class="text-base font-bold text-text-main">
                {t('admin.add_provider')}
              </h3>
              <button
                onClick={closeAddModal}
                disabled={isFormSubmitting.value}
                class="min-h-[44px] min-w-[44px] p-2 text-text-sub hover:text-text-main rounded-lg flex items-center justify-center disabled:opacity-50"
                aria-label="Close"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitAddProvider();
              }}
              class="p-6 space-y-4"
            >
              {/* Error Alert */}
              {formError.value && (
                <div class="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-danger text-xs font-medium">
                  <AlertCircleIcon size={18} class="shrink-0 mt-0.5" />
                  <span>{formError.value}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_full_name')} *
                </label>
                <input
                  type="text"
                  required
                  value={addFullName.value}
                  onInput={(e) => {
                    addFullName.value = (e.target as HTMLInputElement).value;
                  }}
                  placeholder={t('admin.field_full_name_placeholder')}
                  class="w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_phone')} *
                </label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-sub font-mono text-xs font-semibold">
                    +91
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={addPhone.value}
                    onInput={(e) => {
                      // Only allow digits
                      const val = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 10);
                      addPhone.value = val;
                    }}
                    placeholder={t('admin.field_phone_placeholder')}
                    class="w-full min-h-[48px] pl-12 pr-3.5 py-2.5 bg-background border border-border rounded-lg text-sm font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                </div>
              </div>

              {/* Service Category */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_category')} *
                </label>
                <select
                  required
                  value={addCategoryId.value}
                  onChange={(e) => {
                    addCategoryId.value = (e.target as HTMLSelectElement).value;
                  }}
                  class="w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  <option value="" disabled>
                    {t('admin.field_select_category')}
                  </option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {lang === 'hi' ? c.titleHi : c.titleEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preferred Language */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_preferred_language')}
                </label>
                <div class="grid grid-cols-2 gap-3">
                  <label class="min-h-[48px] flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer bg-background hover:bg-slate-50">
                    <input
                      type="radio"
                      name="add_lang"
                      value="hi"
                      checked={addPreferredLanguage.value === 'hi'}
                      onChange={() => {
                        addPreferredLanguage.value = 'hi';
                      }}
                      class="text-brand focus:ring-brand"
                    />
                    <span class="text-sm font-medium text-text-main">
                      {t('admin.lang_hindi')}
                    </span>
                  </label>
                  <label class="min-h-[48px] flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer bg-background hover:bg-slate-50">
                    <input
                      type="radio"
                      name="add_lang"
                      value="en"
                      checked={addPreferredLanguage.value === 'en'}
                      onChange={() => {
                        addPreferredLanguage.value = 'en';
                      }}
                      class="text-brand focus:ring-brand"
                    />
                    <span class="text-sm font-medium text-text-main">
                      {t('admin.lang_english')}
                    </span>
                  </label>
                </div>
              </div>

              {/* Service Area */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_service_area')}
                </label>
                <input
                  type="text"
                  value={addServiceArea.value}
                  onInput={(e) => {
                    addServiceArea.value = (e.target as HTMLInputElement).value;
                  }}
                  placeholder={t('admin.field_service_area_placeholder')}
                  class="w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              {/* Modal Actions */}
              <div class="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={isFormSubmitting.value}
                  class="min-h-[48px] px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors disabled:opacity-50"
                >
                  {t('admin.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isFormSubmitting.value}
                  class="min-h-[48px] px-5 py-2.5 bg-action hover:bg-action-active text-white font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isFormSubmitting.value ? (
                    <>
                      <SpinnerIcon size={18} class="animate-spin" />
                      <span>{t('admin.creating')}</span>
                    </>
                  ) : (
                    <span>{t('admin.add_provider')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* EDIT PROVIDER MODAL                                */}
      {/* ================================================== */}
      {isEditModalOpen.value && editingProvider.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div class="bg-surface border border-border rounded-xl w-full max-w-lg shadow-lg overflow-hidden my-8">
            {/* Modal Header */}
            <div class="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 class="text-base font-bold text-text-main">
                {t('admin.edit_provider')}
              </h3>
              <button
                onClick={closeEditModal}
                disabled={isFormSubmitting.value}
                class="min-h-[44px] min-w-[44px] p-2 text-text-sub hover:text-text-main rounded-lg flex items-center justify-center disabled:opacity-50"
                aria-label="Close"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitEditProvider();
              }}
              class="p-6 space-y-4"
            >
              {/* Error Alert */}
              {formError.value && (
                <div class="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-danger text-xs font-medium">
                  <AlertCircleIcon size={18} class="shrink-0 mt-0.5" />
                  <span>{formError.value}</span>
                </div>
              )}

              {/* Phone (READ-ONLY) */}
              <div>
                <label class="block text-xs font-bold text-text-sub uppercase tracking-wider mb-1.5">
                  {t('admin.field_phone')} ({t('admin.field_phone_readonly_hint')})
                </label>
                <input
                  type="text"
                  disabled
                  value={editingProvider.value.phone}
                  class="w-full min-h-[48px] px-3.5 py-2.5 bg-slate-100 border border-border rounded-lg text-sm font-mono text-text-sub cursor-not-allowed"
                />
              </div>

              {/* Full Name */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_full_name')} *
                </label>
                <input
                  type="text"
                  required
                  value={editFullName.value}
                  onInput={(e) => {
                    editFullName.value = (e.target as HTMLInputElement).value;
                  }}
                  placeholder={t('admin.field_full_name_placeholder')}
                  class="w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              {/* Service Category */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_category')} *
                </label>
                <select
                  required
                  value={editCategoryId.value}
                  onChange={(e) => {
                    editCategoryId.value = (e.target as HTMLSelectElement).value;
                  }}
                  class="w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {lang === 'hi' ? c.titleHi : c.titleEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preferred Language */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_preferred_language')}
                </label>
                <div class="grid grid-cols-2 gap-3">
                  <label class="min-h-[48px] flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer bg-background hover:bg-slate-50">
                    <input
                      type="radio"
                      name="edit_lang"
                      value="hi"
                      checked={editPreferredLanguage.value === 'hi'}
                      onChange={() => {
                        editPreferredLanguage.value = 'hi';
                      }}
                      class="text-brand focus:ring-brand"
                    />
                    <span class="text-sm font-medium text-text-main">
                      {t('admin.lang_hindi')}
                    </span>
                  </label>
                  <label class="min-h-[48px] flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer bg-background hover:bg-slate-50">
                    <input
                      type="radio"
                      name="edit_lang"
                      value="en"
                      checked={editPreferredLanguage.value === 'en'}
                      onChange={() => {
                        editPreferredLanguage.value = 'en';
                      }}
                      class="text-brand focus:ring-brand"
                    />
                    <span class="text-sm font-medium text-text-main">
                      {t('admin.lang_english')}
                    </span>
                  </label>
                </div>
              </div>

              {/* Service Area */}
              <div>
                <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  {t('admin.field_service_area')}
                </label>
                <input
                  type="text"
                  value={editServiceArea.value}
                  onInput={(e) => {
                    editServiceArea.value = (e.target as HTMLInputElement).value;
                  }}
                  placeholder={t('admin.field_service_area_placeholder')}
                  class="w-full min-h-[48px] px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              {/* Modal Actions */}
              <div class="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={isFormSubmitting.value}
                  class="min-h-[48px] px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors disabled:opacity-50"
                >
                  {t('admin.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isFormSubmitting.value}
                  class="min-h-[48px] px-5 py-2.5 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isFormSubmitting.value ? (
                    <>
                      <SpinnerIcon size={18} class="animate-spin" />
                      <span>{t('admin.saving')}</span>
                    </>
                  ) : (
                    <span>{t('admin.save')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* DEACTIVATE CONFIRMATION MODAL                      */}
      {/* ================================================== */}
      {deactivatingProvider.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div class="bg-surface border border-border rounded-xl w-full max-w-md shadow-lg overflow-hidden my-8">
            <div class="p-6">
              <div class="w-12 h-12 rounded-full bg-red-100 text-danger flex items-center justify-center mb-4">
                <AlertCircleIcon size={24} />
              </div>

              <h3 class="text-base font-bold text-text-main mb-2">
                {t('admin.deactivate_modal_title')}
              </h3>

              <p class="text-sm text-text-sub leading-relaxed mb-4">
                {t('admin.deactivate_confirm_desc', {
                  name:
                    deactivatingProvider.value.fullName ||
                    deactivatingProvider.value.phone,
                })}
              </p>

              {/* Error Alert (e.g. 409 ACTIVE_BOOKING_EXISTS) */}
              {deactivationError.value && (
                <div class="p-3 mb-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-danger text-xs font-medium">
                  <AlertCircleIcon size={18} class="shrink-0 mt-0.5" />
                  <span>{deactivationError.value}</span>
                </div>
              )}

              {/* Confirmation Actions */}
              <div class="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDeactivateModal}
                  disabled={isDeactivating.value}
                  class="min-h-[48px] px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-background transition-colors disabled:opacity-50"
                >
                  {t('admin.cancel')}
                </button>
                <button
                  type="button"
                  onClick={confirmDeactivation}
                  disabled={isDeactivating.value}
                  class="min-h-[48px] px-5 py-2.5 bg-danger hover:bg-red-800 text-white font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isDeactivating.value ? (
                    <>
                      <SpinnerIcon size={18} class="animate-spin" />
                      <span>{t('admin.deactivate')}...</span>
                    </>
                  ) : (
                    <span>{t('admin.confirm_deactivate_btn')}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
