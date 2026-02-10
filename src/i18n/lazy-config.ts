import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ICU from 'i18next-icu';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('i18n-lazy-config');

/**
 * Lazy-loading i18n configuration
 * Loads translation files on demand for better performance
 */

// Available languages
export const SUPPORTED_LANGUAGES = ['el', 'en', 'pseudo'] as const;
export type Language = typeof SUPPORTED_LANGUAGES[number];

// Default language (SSoT)
export const DEFAULT_LANGUAGE: Language = 'el';

// Available namespaces
export const SUPPORTED_NAMESPACES = [
  'common',
  'filters',   // 🏢 ENTERPRISE: Generic filter labels (domain separation - ADR-032)
  'dxf-viewer',
  'geo-canvas', // Added geo-canvas namespace
  'forms',
  'toasts',
  'errors',
  'properties',
  'crm',
  'navigation',
  'auth',
  'dashboard',
  'projects',
  'obligations', // ?? Obligations module (obligations/new, live preview, PDF export)
  'toolbars',
  'compositions',
  'tasks',
  'users',
  'building',
  'contacts',
  'units',
  'landing',
  'telegram',  // Telegram bot templates - PR1 centralization
  'files',     // File storage display names (ADR-031)
  'storage',   // 🏢 Storage management module
  'parking',   // 🏢 Parking management module - added 2026-01-24
  'admin',     // 🏢 Admin tools (units, claims repair)
  'tool-hints', // 🏢 DXF Viewer: Step-by-step tool hints (ADR-082)
  'accounting', // 🏢 Accounting subapp (invoices, journal, VAT, tax, assets, documents)
  'banking',    // 🏢 Banking module — bank accounts, IBAN, selectors (ADR-172)
  'addresses'   // 🏢 Shared address system — forms, cards, maps (ADR-172)
] as const;
export type Namespace = typeof SUPPORTED_NAMESPACES[number];

/** Translation data structure */
type TranslationData = Record<string, string | Record<string, unknown>>;

// Cache for loaded translations
const translationCache = new Map<string, TranslationData>();

/**
 * Dynamic translation loader με webpack-compatible imports
 */
async function loadTranslations(language: Language, namespace: Namespace, forceReload = false) {
  const cacheKey = `${language}:${namespace}`;

  if (!forceReload && translationCache.has(cacheKey)) {
    // Map.has() guarantees value exists, so we can safely assert non-undefined
    return translationCache.get(cacheKey) as TranslationData;
  }

  try {
    // Webpack-compatible dynamic import με explicit paths
    let translations: { default?: TranslationData } & TranslationData;

    if (language === 'el') {
      switch (namespace) {
        case 'common':
          translations = await import('./locales/el/common.json');
          break;
        case 'filters':
          translations = await import('./locales/el/filters.json');
          break;
        case 'dxf-viewer':
          translations = await import('./locales/el/dxf-viewer.json');
          break;
        case 'geo-canvas':
          translations = await import('./locales/el/geo-canvas.json');
          break;
        case 'forms':
          translations = await import('./locales/el/forms.json');
          break;
        case 'toasts':
          translations = await import('./locales/el/toasts.json');
          break;
        case 'errors':
          translations = await import('./locales/el/errors.json');
          break;
        case 'properties':
          translations = await import('./locales/el/properties.json');
          break;
        case 'crm':
          translations = await import('./locales/el/crm.json');
          break;
        case 'navigation':
          translations = await import('./locales/el/navigation.json');
          break;
        case 'auth':
          translations = await import('./locales/el/auth.json');
          break;
        case 'dashboard':
          translations = await import('./locales/el/dashboard.json');
          break;
        case 'projects':
          translations = await import('./locales/el/projects.json');
          break;
        case 'obligations':
          translations = await import('./locales/el/obligations.json');
          break;
        case 'toolbars':
          translations = await import('./locales/el/toolbars.json');
          break;
        case 'compositions':
          translations = await import('./locales/el/compositions.json');
          break;
        case 'tasks':
          translations = await import('./locales/el/tasks.json');
          break;
        case 'users':
          translations = await import('./locales/el/users.json');
          break;
        case 'building':
          translations = await import('./locales/el/building.json');
          break;
        case 'contacts':
          translations = await import('./locales/el/contacts.json');
          break;
        case 'units':
          translations = await import('./locales/el/units.json');
          break;
        case 'landing':
          translations = await import('./locales/el/landing.json');
          break;
        case 'telegram':
          translations = await import('./locales/el/telegram.json');
          break;
        case 'files':
          translations = await import('./locales/el/files.json');
          break;
        case 'storage':
          translations = await import('./locales/el/storage.json');
          break;
        case 'parking':
          translations = await import('./locales/el/parking.json');
          break;
        case 'admin':
          translations = await import('./locales/el/admin.json');
          break;
        case 'tool-hints':
          translations = await import('./locales/el/tool-hints.json');
          break;
        case 'accounting':
          translations = await import('./locales/el/accounting.json');
          break;
        case 'banking':
          translations = await import('./locales/el/banking.json');
          break;
        case 'addresses':
          translations = await import('./locales/el/addresses.json');
          break;
        default:
          logger.warn(`Namespace ${namespace} not found for language ${language}`);
          return {};
      }
    } else if (language === 'en') {
      // English translations - Full support for all namespaces
      switch (namespace) {
        case 'common':
          translations = await import('./locales/en/common.json');
          break;
        case 'filters':
          translations = await import('./locales/en/filters.json');
          break;
        case 'dxf-viewer':
          translations = await import('./locales/en/dxf-viewer.json');
          break;
        case 'geo-canvas':
          translations = await import('./locales/en/geo-canvas.json');
          break;
        case 'forms':
          translations = await import('./locales/en/forms.json');
          break;
        case 'toasts':
          translations = await import('./locales/en/toasts.json');
          break;
        case 'errors':
          translations = await import('./locales/en/errors.json');
          break;
        case 'properties':
          translations = await import('./locales/en/properties.json');
          break;
        case 'crm':
          translations = await import('./locales/en/crm.json');
          break;
        case 'navigation':
          translations = await import('./locales/en/navigation.json');
          break;
        case 'auth':
          translations = await import('./locales/en/auth.json');
          break;
        case 'dashboard':
          translations = await import('./locales/en/dashboard.json');
          break;
        case 'projects':
          translations = await import('./locales/en/projects.json');
          break;
        case 'obligations':
          translations = await import('./locales/en/obligations.json');
          break;
        case 'toolbars':
          translations = await import('./locales/en/toolbars.json');
          break;
        case 'compositions':
          translations = await import('./locales/en/compositions.json');
          break;
        case 'tasks':
          translations = await import('./locales/en/tasks.json');
          break;
        case 'users':
          translations = await import('./locales/en/users.json');
          break;
        case 'building':
          translations = await import('./locales/en/building.json');
          break;
        case 'contacts':
          translations = await import('./locales/en/contacts.json');
          break;
        case 'units':
          translations = await import('./locales/en/units.json');
          break;
        case 'landing':
          translations = await import('./locales/en/landing.json');
          break;
        case 'telegram':
          translations = await import('./locales/en/telegram.json');
          break;
        case 'files':
          translations = await import('./locales/en/files.json');
          break;
        case 'storage':
          translations = await import('./locales/en/storage.json');
          break;
        case 'parking':
          translations = await import('./locales/en/parking.json');
          break;
        case 'admin':
          translations = await import('./locales/en/admin.json');
          break;
        case 'tool-hints':
          translations = await import('./locales/en/tool-hints.json');
          break;
        case 'accounting':
          translations = await import('./locales/en/accounting.json');
          break;
        case 'banking':
          translations = await import('./locales/en/banking.json');
          break;
        case 'addresses':
          translations = await import('./locales/en/addresses.json');
          break;
        default:
          logger.warn(`Namespace ${namespace} not found for language ${language}`);
          return {};
      }
    } else {
      // Other languages fallback to Greek
      return loadTranslations('el', namespace);
    }

    const data = translations.default || translations;
    if (!forceReload) {
      translationCache.set(cacheKey, data);
    }
    return data;
  } catch (error) {
    logger.warn(`Failed to load translations for ${language}:${namespace}`, { error });

    // Fallback to Greek if available and not already trying Greek
    if (language !== 'el') {
      try {
        return await loadTranslations('el', namespace, forceReload);
      } catch (fallbackError) {
        logger.error(`Fallback failed for ${namespace}`, { error: fallbackError });
      }
    }

    return {};
  }
}

/**
 * Initialize i18n with lazy loading
 */
export async function initI18n(defaultLanguage: Language = 'el') {
  // Load initial translations for default language
  const initialResources: Record<string, Record<string, TranslationData>> = {};
  
  // Load common namespace first (required for app boot)
  initialResources[defaultLanguage] = {
    common: await loadTranslations(defaultLanguage, 'common'),
  };

  await i18n
    .use(ICU)
    .use(initReactI18next)
    .init({
      resources: initialResources,
      lng: defaultLanguage,
      fallbackLng: 'el',
      debug: process.env.NODE_ENV === 'development',
      
      // Lazy loading configuration
      ns: ['common'], // Start with only common namespace
      defaultNS: 'common',
      
      interpolation: {
        escapeValue: false,
      },
      
      // Resource loading config
      partialBundledLanguages: true,
      
      react: {
        useSuspense: false, // Disable suspense for lazy loading
      },
    });

  return i18n;
}

/**
 * Load namespace on demand
 */
export async function loadNamespace(namespace: Namespace, language?: Language, forceReload = false) {
  const currentLanguage = (language || i18n.language || 'el') as Language;
  
  // Check if already loaded
  if (!forceReload && i18n.hasResourceBundle(currentLanguage, namespace)) {
    return;
  }
  
  const translations = await loadTranslations(currentLanguage, namespace, forceReload);
  
  // Add to i18n instance
  i18n.addResourceBundle(currentLanguage, namespace, translations, true, true);
  
  // console.log(`✅ Loaded namespace: ${namespace} for language: ${currentLanguage}`);
}

/**
 * Preload critical namespaces
 * 🏢 ENTERPRISE: These namespaces are loaded at app startup for instant availability
 */
export async function preloadCriticalNamespaces(language: Language = 'el') {
  // 🏢 ENTERPRISE: Core namespaces loaded at startup (SAP/Salesforce pattern)
  const critical: Namespace[] = [
    'common',
    'filters',       // 🏢 ENTERPRISE: Generic filter labels (domain separation)
    'errors',
    'toasts',
    'auth',
    'forms',         // 🏢 ENTERPRISE: Form labels, help texts, sections (company-gemi, service forms)
    'building',      // Building management - core module
    'navigation',    // Navigation labels
    'projects',      // Projects module
    'contacts',      // Contacts module
    'units',         // Units module
    'storage',       // 🏢 Storage management module - added 2026-01-24
    'parking',       // 🏢 Parking management module - added 2026-01-24
    'dxf-viewer',    // ?? DXF viewer UI - avoids fallback-to-keys after language switch
    'accounting',    // 🏢 Accounting subapp - all financial modules
    // Note: 'crm' loads on-demand via useTranslation('crm')
  ];

  await Promise.all(
    critical.map(namespace => loadNamespace(namespace, language))
  );
}

/**
 * Change language with automatic namespace loading
 */
export async function changeLanguage(language: Language) {
  // Load critical namespaces for new language
  await preloadCriticalNamespaces(language);
  
  // Change language
  await i18n.changeLanguage(language);
  
  // console.log(`🌍 Language changed to: ${language}`);
}

/**
 * Get language display name
 */
export function getLanguageDisplayName(language: Language): string {
  const names: Record<Language, string> = {
    el: 'Ελληνικά',
    en: 'English', 
    pseudo: 'Pseudo (Dev)',
  };
  
  return names[language] || language;
}

/**
 * Clear translation cache (for development)
 */
export function clearTranslationCache() {
  translationCache.clear();
  logger.info('Translation cache cleared');
}

export default i18n;
