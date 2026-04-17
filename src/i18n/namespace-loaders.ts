/**
 * Webpack-compatible namespace loaders per language
 * Extracted from lazy-config.ts for SRP (Google file size standards — ADR-280)
 *
 * Each loader function returns a dynamic import() for the given namespace.
 * Webpack requires explicit string literal paths for code-splitting.
 */

import type { Language, Namespace } from './lazy-config';

/** Translation data structure */
export type TranslationData = Record<string, string | Record<string, unknown>>;

type TranslationModule = { default?: TranslationData } & TranslationData;

type NamespaceLoader = () => Promise<TranslationModule>;

/**
 * Greek (el) namespace loaders
 */
function getElLoader(namespace: Namespace): NamespaceLoader | null {
  switch (namespace) {
    case 'common': return () => import('./locales/el/common.json');
    case 'common-actions': return () => import('./locales/el/common-actions.json');
    case 'common-navigation': return () => import('./locales/el/common-navigation.json');
    case 'common-status': return () => import('./locales/el/common-status.json');
    case 'common-validation': return () => import('./locales/el/common-validation.json');
    case 'common-empty-states': return () => import('./locales/el/common-empty-states.json');
    case 'common-sales': return () => import('./locales/el/common-sales.json');
    case 'common-account': return () => import('./locales/el/common-account.json');
    case 'common-photos': return () => import('./locales/el/common-photos.json');
    case 'common-shared': return () => import('./locales/el/common-shared.json');
    case 'filters': return () => import('./locales/el/filters.json');
    case 'dxf-viewer': return () => import('./locales/el/dxf-viewer.json');
    case 'dxf-viewer-shell': return () => import('./locales/el/dxf-viewer-shell.json');
    case 'dxf-viewer-panels': return () => import('./locales/el/dxf-viewer-panels.json');
    case 'dxf-viewer-settings': return () => import('./locales/el/dxf-viewer-settings.json');
    case 'dxf-viewer-wizard': return () => import('./locales/el/dxf-viewer-wizard.json');
    case 'dxf-viewer-guides': return () => import('./locales/el/dxf-viewer-guides.json');
    case 'geo-canvas': return () => import('./locales/el/geo-canvas.json');
    case 'geo-canvas-drawing': return () => import('./locales/el/geo-canvas-drawing.json');
    case 'forms': return () => import('./locales/el/forms.json');
    case 'toasts': return () => import('./locales/el/toasts.json');
    case 'errors': return () => import('./locales/el/errors.json');
    case 'properties': return () => import('./locales/el/properties.json');
    case 'properties-detail': return () => import('./locales/el/properties-detail.json');
    case 'properties-enums': return () => import('./locales/el/properties-enums.json');
    case 'properties-viewer': return () => import('./locales/el/properties-viewer.json');
    case 'crm': return () => import('./locales/el/crm.json');
    case 'crm-inbox': return () => import('./locales/el/crm-inbox.json');
    case 'navigation': return () => import('./locales/el/navigation.json');
    case 'navigation-entities': return () => import('./locales/el/navigation-entities.json');
    case 'auth': return () => import('./locales/el/auth.json');
    case 'dashboard': return () => import('./locales/el/dashboard.json');
    case 'projects': return () => import('./locales/el/projects.json');
    case 'projects-data': return () => import('./locales/el/projects-data.json');
    case 'projects-ika': return () => import('./locales/el/projects-ika.json');
    case 'obligations': return () => import('./locales/el/obligations.json');
    case 'toolbars': return () => import('./locales/el/toolbars.json');
    case 'compositions': return () => import('./locales/el/compositions.json');
    case 'tasks': return () => import('./locales/el/tasks.json');
    case 'users': return () => import('./locales/el/users.json');
    case 'building': return () => import('./locales/el/building.json');
    case 'building-storage': return () => import('./locales/el/building-storage.json');
    case 'building-address': return () => import('./locales/el/building-address.json');
    case 'building-filters': return () => import('./locales/el/building-filters.json');
    case 'building-timeline': return () => import('./locales/el/building-timeline.json');
    case 'building-tabs': return () => import('./locales/el/building-tabs.json');
    case 'communications': return () => import('./locales/el/communications.json');
    case 'contacts': return () => import('./locales/el/contacts.json');
    case 'contacts-core': return () => import('./locales/el/contacts-core.json');
    case 'contacts-form': return () => import('./locales/el/contacts-form.json');
    case 'contacts-relationships': return () => import('./locales/el/contacts-relationships.json');
    case 'contacts-banking': return () => import('./locales/el/contacts-banking.json');
    case 'contacts-lifecycle': return () => import('./locales/el/contacts-lifecycle.json');
    case 'landing': return () => import('./locales/el/landing.json');
    case 'telegram': return () => import('./locales/el/telegram.json');
    case 'files': return () => import('./locales/el/files.json');
    case 'files-media': return () => import('./locales/el/files-media.json');
    case 'storage': return () => import('./locales/el/storage.json');
    case 'parking': return () => import('./locales/el/parking.json');
    case 'admin': return () => import('./locales/el/admin.json');
    case 'tool-hints': return () => import('./locales/el/tool-hints.json');
    case 'accounting': return () => import('./locales/el/accounting.json');
    case 'accounting-setup': return () => import('./locales/el/accounting-setup.json');
    case 'accounting-tax-offices': return () => import('./locales/el/accounting-tax-offices.json');
    case 'banking': return () => import('./locales/el/banking.json');
    case 'addresses': return () => import('./locales/el/addresses.json');
    case 'payments': return () => import('./locales/el/payments.json');
    case 'payments-loans': return () => import('./locales/el/payments-loans.json');
    case 'payments-cost-calc': return () => import('./locales/el/payments-cost-calc.json');
    case 'attendance': return () => import('./locales/el/attendance.json');
    case 'legal': return () => import('./locales/el/legal.json');
    case 'reports': return () => import('./locales/el/reports.json');
    case 'reports-extended': return () => import('./locales/el/reports-extended.json');
    case 'cash-flow': return () => import('./locales/el/cash-flow.json');
    case 'procurement': return () => import('./locales/el/procurement.json');
    case 'report-builder': return () => import('./locales/el/report-builder.json');
    case 'report-builder-domains': return () => import('./locales/el/report-builder-domains.json');
    case 'saved-reports': return () => import('./locales/el/saved-reports.json');
    case 'trash': return () => import('./locales/el/trash.json');
    case 'showcase': return () => import('./locales/el/showcase.json');
    default: return null;
  }
}

/**
 * English (en) namespace loaders
 */
function getEnLoader(namespace: Namespace): NamespaceLoader | null {
  switch (namespace) {
    case 'common': return () => import('./locales/en/common.json');
    case 'common-actions': return () => import('./locales/en/common-actions.json');
    case 'common-navigation': return () => import('./locales/en/common-navigation.json');
    case 'common-status': return () => import('./locales/en/common-status.json');
    case 'common-validation': return () => import('./locales/en/common-validation.json');
    case 'common-empty-states': return () => import('./locales/en/common-empty-states.json');
    case 'common-sales': return () => import('./locales/en/common-sales.json');
    case 'common-account': return () => import('./locales/en/common-account.json');
    case 'common-photos': return () => import('./locales/en/common-photos.json');
    case 'common-shared': return () => import('./locales/en/common-shared.json');
    case 'filters': return () => import('./locales/en/filters.json');
    case 'dxf-viewer': return () => import('./locales/en/dxf-viewer.json');
    case 'dxf-viewer-shell': return () => import('./locales/en/dxf-viewer-shell.json');
    case 'dxf-viewer-panels': return () => import('./locales/en/dxf-viewer-panels.json');
    case 'dxf-viewer-settings': return () => import('./locales/en/dxf-viewer-settings.json');
    case 'dxf-viewer-wizard': return () => import('./locales/en/dxf-viewer-wizard.json');
    case 'dxf-viewer-guides': return () => import('./locales/en/dxf-viewer-guides.json');
    case 'geo-canvas': return () => import('./locales/en/geo-canvas.json');
    case 'geo-canvas-drawing': return () => import('./locales/en/geo-canvas-drawing.json');
    case 'forms': return () => import('./locales/en/forms.json');
    case 'toasts': return () => import('./locales/en/toasts.json');
    case 'errors': return () => import('./locales/en/errors.json');
    case 'properties': return () => import('./locales/en/properties.json');
    case 'properties-detail': return () => import('./locales/en/properties-detail.json');
    case 'properties-enums': return () => import('./locales/en/properties-enums.json');
    case 'properties-viewer': return () => import('./locales/en/properties-viewer.json');
    case 'crm': return () => import('./locales/en/crm.json');
    case 'crm-inbox': return () => import('./locales/en/crm-inbox.json');
    case 'navigation': return () => import('./locales/en/navigation.json');
    case 'navigation-entities': return () => import('./locales/en/navigation-entities.json');
    case 'auth': return () => import('./locales/en/auth.json');
    case 'dashboard': return () => import('./locales/en/dashboard.json');
    case 'projects': return () => import('./locales/en/projects.json');
    case 'projects-data': return () => import('./locales/en/projects-data.json');
    case 'projects-ika': return () => import('./locales/en/projects-ika.json');
    case 'obligations': return () => import('./locales/en/obligations.json');
    case 'toolbars': return () => import('./locales/en/toolbars.json');
    case 'compositions': return () => import('./locales/en/compositions.json');
    case 'tasks': return () => import('./locales/en/tasks.json');
    case 'users': return () => import('./locales/en/users.json');
    case 'building': return () => import('./locales/en/building.json');
    case 'building-storage': return () => import('./locales/en/building-storage.json');
    case 'building-address': return () => import('./locales/en/building-address.json');
    case 'building-filters': return () => import('./locales/en/building-filters.json');
    case 'building-timeline': return () => import('./locales/en/building-timeline.json');
    case 'building-tabs': return () => import('./locales/en/building-tabs.json');
    case 'communications': return () => import('./locales/en/communications.json');
    case 'contacts': return () => import('./locales/en/contacts.json');
    case 'contacts-core': return () => import('./locales/en/contacts-core.json');
    case 'contacts-form': return () => import('./locales/en/contacts-form.json');
    case 'contacts-relationships': return () => import('./locales/en/contacts-relationships.json');
    case 'contacts-banking': return () => import('./locales/en/contacts-banking.json');
    case 'contacts-lifecycle': return () => import('./locales/en/contacts-lifecycle.json');
    case 'landing': return () => import('./locales/en/landing.json');
    case 'telegram': return () => import('./locales/en/telegram.json');
    case 'files': return () => import('./locales/en/files.json');
    case 'files-media': return () => import('./locales/en/files-media.json');
    case 'storage': return () => import('./locales/en/storage.json');
    case 'parking': return () => import('./locales/en/parking.json');
    case 'admin': return () => import('./locales/en/admin.json');
    case 'tool-hints': return () => import('./locales/en/tool-hints.json');
    case 'accounting': return () => import('./locales/en/accounting.json');
    case 'accounting-setup': return () => import('./locales/en/accounting-setup.json');
    case 'accounting-tax-offices': return () => import('./locales/en/accounting-tax-offices.json');
    case 'banking': return () => import('./locales/en/banking.json');
    case 'addresses': return () => import('./locales/en/addresses.json');
    case 'payments': return () => import('./locales/en/payments.json');
    case 'payments-loans': return () => import('./locales/en/payments-loans.json');
    case 'payments-cost-calc': return () => import('./locales/en/payments-cost-calc.json');
    case 'attendance': return () => import('./locales/en/attendance.json');
    case 'legal': return () => import('./locales/en/legal.json');
    case 'reports': return () => import('./locales/en/reports.json');
    case 'reports-extended': return () => import('./locales/en/reports-extended.json');
    case 'cash-flow': return () => import('./locales/en/cash-flow.json');
    case 'procurement': return () => import('./locales/en/procurement.json');
    case 'report-builder': return () => import('./locales/en/report-builder.json');
    case 'report-builder-domains': return () => import('./locales/en/report-builder-domains.json');
    case 'saved-reports': return () => import('./locales/en/saved-reports.json');
    case 'trash': return () => import('./locales/en/trash.json');
    case 'showcase': return () => import('./locales/en/showcase.json');
    default: return null;
  }
}

/**
 * Get the namespace loader for a given language and namespace.
 * Returns null if namespace not found for the language.
 */
export function getNamespaceLoader(language: Language, namespace: Namespace): NamespaceLoader | null {
  if (language === 'el') return getElLoader(namespace);
  if (language === 'en') return getEnLoader(namespace);
  return null;
}
