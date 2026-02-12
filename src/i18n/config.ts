/**
 * Main i18n configuration with lazy loading support
 * This config now uses lazy loading for better performance
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ICU from 'i18next-icu';
import { loadNamespace, type Namespace, type Language, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './lazy-config';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('i18n-config');

// Load essential translations for initial boot
import commonEl from './locales/el/common.json';
import commonEn from './locales/en/common.json';
import commonPseudo from './locales/pseudo/common.json';
// Pre-load landing for homepage
import landingEl from './locales/el/landing.json';
import landingEn from './locales/en/landing.json';
import landingPseudo from './locales/pseudo/landing.json';
// 🏢 ENTERPRISE: Pre-load navigation (used on every page - prevents race condition warnings)
import navigationEl from './locales/el/navigation.json';
import navigationEn from './locales/en/navigation.json';
// 🏢 ENTERPRISE: Pre-load admin (used on admin pages - prevents hydration mismatch)
import adminEl from './locales/el/admin.json';
import adminEn from './locales/en/admin.json';
// Note: pseudo/navigation.json not needed - fallback to el

// Initial resources - common, landing, and navigation for immediate availability
const resources = {
  el: { common: commonEl, landing: landingEl, navigation: navigationEl, admin: adminEl },
  en: { common: commonEn, landing: landingEn, navigation: navigationEn, admin: adminEn },
  pseudo: { common: commonPseudo, landing: landingPseudo, navigation: navigationEl, admin: adminEl },
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
    ns: ['common', 'navigation', 'obligations'],
    
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
      'filters',       // 🏢 ENTERPRISE: Generic filter labels (domain separation)
      'auth',          // 🏢 Auth screens - critical for UX
      'forms',         // 🏢 ENTERPRISE: Form labels, sections, help texts (company-gemi, service forms)
      'admin',         // 🏢 ENTERPRISE: Admin pages (AI Inbox, RBAC) - prevents hydration mismatch
      'crm',           // 🏢 CRM module - tasks, opportunities, inbox
      'building',      // Building management - core module
      'projects',      // Projects module
      'contacts',      // Contacts module
      'units',         // Units module
      'storage',       // 🏢 Storage module - added 2026-01-24
      'parking',       // 🏢 Parking module - added 2026-01-24
      'properties',    // 🏢 Properties module - status labels used by DXF overlays
      'dxf-viewer',
      'geo-canvas',
      'accounting',    // 🏢 Accounting subapp - invoices, journal, VAT, tax, assets
      'obligations',   // 🏢 Obligations workspace translations
    ];

    const saved = localStorage.getItem('preferred-language');
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

