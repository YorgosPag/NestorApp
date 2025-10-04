// Generated TypeScript types for i18n translation keys
// This ensures type safety when using translation keys

export type TranslationNamespace = 
  | 'common'
  | 'dxf-viewer'
  | 'forms'
  | 'toasts'
  | 'errors'
  | 'navigation'
  | 'auth'
  | 'dashboard'
  | 'crm'
  | 'properties';

// Common namespace keys
export type CommonKeys = 
  | 'buttons.save'
  | 'buttons.cancel'
  | 'buttons.delete'
  | 'buttons.edit'
  | 'buttons.add'
  | 'buttons.search'
  | 'buttons.export'
  | 'buttons.import'
  | 'buttons.refresh'
  | 'buttons.close'
  | 'status.loading'
  | 'status.error'
  | 'status.success'
  | 'status.pending'
  | 'status.completed'
  | 'placeholders.search'
  | 'placeholders.selectOption'
  | 'placeholders.enterText';

// Auth namespace keys
export type AuthKeys = 
  | 'login.title'
  | 'login.subtitle'
  | 'login.email.label'
  | 'login.email.placeholder'
  | 'login.password.label'
  | 'login.password.placeholder'
  | 'login.rememberMe'
  | 'login.forgotPassword'
  | 'login.submit'
  | 'login.loading'
  | 'login.errors.invalidCredentials'
  | 'login.errors.emailRequired'
  | 'login.errors.passwordRequired';

// Navigation namespace keys
export type NavigationKeys = 
  | 'menu.main'
  | 'menu.dashboard'
  | 'menu.contacts'
  | 'menu.properties'
  | 'menu.buildings'
  | 'menu.crm'
  | 'menu.settings'
  | 'breadcrumbs.home'
  | 'breadcrumbs.contacts'
  | 'breadcrumbs.properties'
  | 'breadcrumbs.buildings'
  | 'breadcrumbs.crm';

// Dashboard namespace keys
export type DashboardKeys = 
  | 'welcome.title'
  | 'welcome.subtitle'
  | 'welcome.actions.newContact'
  | 'welcome.actions.search'
  | 'stats.totalContacts'
  | 'stats.newContacts'
  | 'stats.favorites'
  | 'stats.activeToday'
  | 'stats.periods.lastMonth'
  | 'stats.periods.thisMonth'
  | 'stats.periods.last24h'
  | 'stats.quickAccess'
  | 'quickActions.title'
  | 'quickActions.subtitle'
  | 'quickActions.individual.title'
  | 'quickActions.individual.description'
  | 'quickActions.company.title'
  | 'quickActions.company.description'
  | 'quickActions.service.title'
  | 'quickActions.service.description';

// CRM namespace keys
export type CrmKeys = 
  | 'overview.stats.newLeads'
  | 'overview.stats.activeOpportunities'
  | 'overview.stats.scheduledViewings'
  | 'overview.stats.pendingTasks';

// Properties namespace keys  
export type PropertiesKeys = 
  | 'toolbar.actions.new'
  | 'toolbar.actions.edit'
  | 'toolbar.actions.delete'
  | 'dialog.deleteConfirmation.title'
  | 'dialog.deleteConfirmation.message'
  | 'dialog.deleteConfirmation.warning'
  | 'dialog.cancel'
  | 'dialog.delete'
  | 'building.toolbar.actions.new'
  | 'building.toolbar.actions.edit'
  | 'building.toolbar.actions.delete'
  | 'building.toolbar.actions.export'
  | 'building.toolbar.filters.active'
  | 'building.toolbar.filters.clearAll'
  | 'building.toolbar.export.title'
  | 'building.toolbar.export.pdf'
  | 'building.toolbar.export.stats'
  | 'building.toolbar.export.timeline'
  | 'building.storage.types.storage'
  | 'building.storage.types.parking'
  | 'building.storage.status.available'
  | 'building.storage.status.reserved'
  | 'building.storage.status.sold'
  | 'building.storage.status.owner'
  | 'units.types.studio'
  | 'units.types.apartment_1br'
  | 'units.types.apartment_2br'
  | 'units.types.apartment_3br'
  | 'units.types.maisonette'
  | 'units.types.shop'
  | 'units.types.storage'
  | 'search.results.found'
  | 'search.results.error'
  | 'search.terms.thousands'
  | 'search.terms.available'
  | 'search.terms.sold'
  | 'search.terms.reserved'
  | 'search.terms.apartment'
  | 'search.terms.maisonette'
  | 'search.terms.shop'
  | 'search.terms.parking'
  | 'search.terms.storage';

// Forms namespace keys
export type FormsKeys = 
  | 'validation.required'
  | 'validation.email'
  | 'validation.minLength'
  | 'validation.maxLength'
  | 'validation.phone'
  | 'validation.url'
  | 'validation.number'
  | 'validation.positive'
  | 'validation.integer'
  | 'validation.decimal'
  | 'validation.date'
  | 'validation.time'
  | 'validation.dateTime'
  | 'validation.future'
  | 'validation.past'
  | 'validation.confirm'
  | 'validation.unique'
  | 'validation.exists'
  | 'validation.strongPassword'
  | 'validation.weakPassword'
  | 'labels.firstName'
  | 'labels.lastName'
  | 'labels.fullName'
  | 'labels.email'
  | 'labels.phone'
  | 'labels.mobile'
  | 'labels.address'
  | 'labels.city'
  | 'labels.postalCode'
  | 'labels.country'
  | 'labels.notes'
  | 'labels.description'
  | 'labels.category'
  | 'labels.status'
  | 'labels.priority'
  | 'labels.date'
  | 'labels.time'
  | 'labels.dateTime'
  | 'labels.price'
  | 'labels.amount'
  | 'labels.quantity'
  | 'labels.percentage'
  | 'labels.website'
  | 'labels.socialMedia'
  | 'labels.company'
  | 'labels.position'
  | 'labels.department'
  | 'labels.tags'
  | 'labels.avatar'
  | 'labels.image'
  | 'labels.file'
  | 'labels.attachment'
  | 'placeholders.firstName'
  | 'placeholders.lastName'
  | 'placeholders.email'
  | 'placeholders.phone'
  | 'placeholders.address'
  | 'placeholders.city'
  | 'placeholders.notes'
  | 'placeholders.search'
  | 'placeholders.website'
  | 'placeholders.company'
  | 'placeholders.position'
  | 'placeholders.selectDate'
  | 'placeholders.selectTime'
  | 'placeholders.enterAmount'
  | 'placeholders.enterPercentage'
  | 'placeholders.selectFile'
  | 'placeholders.dragDropFile';

// Union type for all translation keys by namespace
export type TranslationKeys<T extends TranslationNamespace> = 
  T extends 'common' ? CommonKeys :
  T extends 'auth' ? AuthKeys :
  T extends 'navigation' ? NavigationKeys :
  T extends 'dashboard' ? DashboardKeys :
  T extends 'crm' ? CrmKeys :
  T extends 'properties' ? PropertiesKeys :
  T extends 'forms' ? FormsKeys :
  string; // Fallback for other namespaces not yet typed

// Helper type for translation function
export type TFunction<T extends TranslationNamespace = 'common'> = (
  key: TranslationKeys<T>,
  options?: {
    count?: number;
    [key: string]: any;
  }
) => string;

// Augment the react-i18next module to provide type safety
declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: Record<CommonKeys, string>;
      auth: Record<AuthKeys, string>;
      navigation: Record<NavigationKeys, string>;
      dashboard: Record<DashboardKeys, string>;
      crm: Record<CrmKeys, string>;
      properties: Record<PropertiesKeys, string>;
      forms: Record<FormsKeys, string>;
    };
  }
}