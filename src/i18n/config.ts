/**
 * Main i18n configuration with lazy loading support
 * This config now uses lazy loading for better performance
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ICU from 'i18next-icu';
import { loadNamespace, type Namespace, type Language, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './lazy-config';
import { remapLegacyTranslationKey } from './namespace-compat';

import { createModuleLogger } from '@/lib/telemetry';
import { safeGetItem, STORAGE_KEYS } from '@/lib/storage';
const logger = createModuleLogger('i18n-config');

// Load essential translations for initial boot
import commonEl from './locales/el/common.json';
import commonEn from './locales/en/common.json';
import commonPseudo from './locales/pseudo/common.json';
import commonActionsEl from './locales/el/common-actions.json';
import commonActionsEn from './locales/en/common-actions.json';
import commonActionsPseudo from './locales/pseudo/common-actions.json';
import commonNavigationEl from './locales/el/common-navigation.json';
import commonNavigationEn from './locales/en/common-navigation.json';
import commonNavigationPseudo from './locales/pseudo/common-navigation.json';
import commonStatusEl from './locales/el/common-status.json';
import commonStatusEn from './locales/en/common-status.json';
import commonStatusPseudo from './locales/pseudo/common-status.json';
import commonValidationEl from './locales/el/common-validation.json';
import commonValidationEn from './locales/en/common-validation.json';
import commonValidationPseudo from './locales/pseudo/common-validation.json';
import commonEmptyStatesEl from './locales/el/common-empty-states.json';
import commonEmptyStatesEn from './locales/en/common-empty-states.json';
import commonEmptyStatesPseudo from './locales/pseudo/common-empty-states.json';
// Pre-load landing for homepage
import landingEl from './locales/el/landing.json';
import landingEn from './locales/en/landing.json';
import landingPseudo from './locales/pseudo/landing.json';
// 🏢 ENTERPRISE: Pre-load navigation (used on every page - prevents race condition warnings)
import navigationEl from './locales/el/navigation.json';
import navigationEn from './locales/en/navigation.json';
import navigationPseudo from './locales/pseudo/navigation.json';
// 🏢 ENTERPRISE: Pre-load admin (used on admin pages - prevents hydration mismatch)
import adminEl from './locales/el/admin.json';
import adminEn from './locales/en/admin.json';
import adminPseudo from './locales/pseudo/admin.json';

// Initial resources - common, landing, and navigation for immediate availability
const resources = {
  el: { common: commonEl, 'common-actions': commonActionsEl, 'common-navigation': commonNavigationEl, 'common-status': commonStatusEl, 'common-validation': commonValidationEl, 'common-empty-states': commonEmptyStatesEl, landing: landingEl, navigation: navigationEl, admin: adminEl },
  en: { common: commonEn, 'common-actions': commonActionsEn, 'common-navigation': commonNavigationEn, 'common-status': commonStatusEn, 'common-validation': commonValidationEn, 'common-empty-states': commonEmptyStatesEn, landing: landingEn, navigation: navigationEn, admin: adminEn },
  pseudo: { common: commonPseudo, 'common-actions': commonActionsPseudo, 'common-navigation': commonNavigationPseudo, 'common-status': commonStatusPseudo, 'common-validation': commonValidationPseudo, 'common-empty-states': commonEmptyStatesPseudo, landing: landingPseudo, navigation: navigationPseudo, admin: adminPseudo },
};

// Detect preferred language
const getInitialLanguage = (): Language => {
  // Always start with default language to avoid SSR/CSR mismatch.
  return DEFAULT_LANGUAGE;
};

// Initialize i18n with minimal resources
i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    debug: false, // Disabled to reduce console noise
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    // 🏢 ENTERPRISE: Start with common + navigation (both pre-loaded sync)
    defaultNS: 'common',
    ns: ['common', 'common-actions', 'common-navigation', 'common-status', 'common-validation', 'common-empty-states', 'navigation', 'obligations'],
    
    react: {
      useSuspense: false, // Better for lazy loading
    },
  });

// Preload critical namespaces after initialization
if (typeof window !== 'undefined') {
  // Client-side only - 🏢 ENTERPRISE: Immediate preload (no delay)
  (async () => {
    // 🏢 ENTERPRISE: Core namespaces - loaded at startup (SAP/Salesforce pattern)
    const criticalNamespaces: Namespace[] = [
      'errors',
      'toasts',
      'navigation',
      'navigation-entities',  // 🏢 Split from navigation (ADR-280)
      'filters',       // 🏢 ENTERPRISE: Generic filter labels (domain separation)
      'auth',          // 🏢 Auth screens - critical for UX
      'forms',         // 🏢 ENTERPRISE: Form labels, sections, help texts (company-gemi, service forms)
      'admin',         // 🏢 ENTERPRISE: Admin pages (AI Inbox, RBAC) - prevents hydration mismatch
      'crm',           // 🏢 CRM module - tasks, opportunities, inbox
      'crm-inbox',     // 🏢 Split from crm (ADR-280)
      'building',      // Building management - core module
      'building-storage',   // 🏢 Split from building (ADR-280)
      'building-address',   // 🏢 Split from building (ADR-280)
      'building-filters',   // 🏢 Split from building (ADR-280)
      'building-timeline',  // 🏢 Split from building (ADR-280)
      'building-tabs',      // 🏢 Split from building (ADR-280)
      'projects',      // Projects module
      'projects-data',      // 🏢 Split from projects (ADR-280)
      'projects-ika',       // 🏢 Split from projects (ADR-280)
      'contacts',      // Contacts module
      'contacts-core',      // 🏢 Split from contacts (ADR-280)
      'contacts-form',      // 🏢 Split from contacts (ADR-280)
      'contacts-relationships', // 🏢 Split from contacts (ADR-280)
      'contacts-banking',   // 🏢 Split from contacts (ADR-280)
      'contacts-lifecycle', // 🏢 Split from contacts (ADR-280)
      'properties',    // 🏢 Properties module (renamed from units — ADR-269)
      'properties-detail', // 🏢 Read/detail surface split from properties SSOT
      'properties-enums', // 🏢 Domain vocabulary split from properties SSOT
      'properties-viewer', // 🏢 Floorplan/viewer surface split from properties SSOT
      'storage',       // 🏢 Storage module - added 2026-01-24
      'parking',       // 🏢 Parking module - added 2026-01-24
      'dxf-viewer',
      'dxf-viewer-shell',   // 🏢 Split from dxf-viewer (ADR-280)
      'dxf-viewer-panels',  // 🏢 Split from dxf-viewer (ADR-280)
      'dxf-viewer-settings', // 🏢 Split from dxf-viewer (ADR-280)
      'dxf-viewer-wizard',  // 🏢 Split from dxf-viewer (ADR-280)
      'dxf-viewer-guides',  // 🏢 Split from dxf-viewer (ADR-280)
      'geo-canvas',
      'geo-canvas-drawing', // 🏢 Split from geo-canvas (ADR-280)
      'accounting',    // 🏢 Accounting subapp - invoices, journal, VAT, tax, assets
      'accounting-setup',   // 🏢 Split from accounting (ADR-280)
      'obligations',   // 🏢 Obligations workspace translations
      'payments',      // 🏢 Payments module
      'payments-loans',     // 🏢 Split from payments (ADR-280)
      'payments-cost-calc', // 🏢 Split from payments (ADR-280)
      'reports',       // 🏢 Enterprise Reports System (ADR-265)
      'reports-extended',   // 🏢 Split from reports (ADR-280)
      'files',         // 🏢 File management
      'files-media',        // 🏢 Split from files (ADR-280)
      'procurement',   // 🏢 Procurement module (ADR-267)
      'common-sales',       // 🏢 Split from common (ADR-280)
      'common-account',     // 🏢 Split from common (ADR-280)
      'common-photos',      // 🏢 Split from common (ADR-280)
      'common-shared',      // 🏢 Split from common (ADR-280)
    ];

    const saved = safeGetItem(STORAGE_KEYS.PREFERRED_LANGUAGE, '');
    const browser = navigator.language.split('-')[0];
    const preferred = (saved || browser) as Language;
    const validLang: Language = SUPPORTED_LANGUAGES.includes(preferred) ? preferred : DEFAULT_LANGUAGE;

    try {
      await Promise.all(
        criticalNamespaces.map(async (ns) => {
          await loadNamespace(ns, validLang);
        })
      );

      if (validLang !== i18n.language) {
        await i18n.changeLanguage(validLang);
      }
    } catch (error) {
      logger.error('Failed to preload namespaces', { error });
    }
  })();
}

export default i18n;


const originalTranslate = i18n.t.bind(i18n);
type TranslateAdapter = (...args: readonly unknown[]) => unknown;

const compatibleTranslate = ((...args: readonly unknown[]) => {
  const [key, arg2, arg3] = args;
  const translate = originalTranslate as unknown as TranslateAdapter;

  if (typeof key !== 'string') {
    return arg3 === undefined
      ? translate(key, arg2)
      : translate(key, arg2, arg3);
  }

  const remapped = remapLegacyTranslationKey(key, arg2);
  return arg3 === undefined
    ? translate(remapped.key, remapped.options)
    : translate(remapped.key, remapped.options, arg3);
}) as unknown as typeof i18n.t;

i18n.t = compatibleTranslate;
