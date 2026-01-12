import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ICU from 'i18next-icu';

/**
 * Lazy-loading i18n configuration
 * Loads translation files on demand for better performance
 */

// Available languages
export const SUPPORTED_LANGUAGES = ['el', 'en', 'pseudo'] as const;
export type Language = typeof SUPPORTED_LANGUAGES[number];

// Available namespaces
export const SUPPORTED_NAMESPACES = [
  'common',
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
  'toolbars',
  'compositions',
  'tasks',
  'users',
  'building',
  'contacts',
  'units',
  'landing'
] as const;
export type Namespace = typeof SUPPORTED_NAMESPACES[number];

/** Translation data structure */
type TranslationData = Record<string, string | Record<string, unknown>>;

// Cache for loaded translations
const translationCache = new Map<string, TranslationData>();

/**
 * Dynamic translation loader με webpack-compatible imports
 */
async function loadTranslations(language: Language, namespace: Namespace) {
  const cacheKey = `${language}:${namespace}`;

  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    // Webpack-compatible dynamic import με explicit paths
    let translations: { default?: TranslationData } & TranslationData;

    if (language === 'el') {
      switch (namespace) {
        case 'common':
          translations = await import('./locales/el/common.json');
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
        default:
          console.warn(`Namespace ${namespace} not found for language ${language}`);
          return {};
      }
    } else if (language === 'en') {
      // English translations - Full support for all namespaces
      switch (namespace) {
        case 'common':
          translations = await import('./locales/en/common.json');
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
        default:
          console.warn(`Namespace ${namespace} not found for language ${language}`);
          return {};
      }
    } else {
      // Other languages fallback to Greek
      return loadTranslations('el', namespace);
    }

    const data = translations.default || translations;
    translationCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.warn(`Failed to load translations for ${language}:${namespace}`, error);

    // Fallback to Greek if available and not already trying Greek
    if (language !== 'el') {
      try {
        return await loadTranslations('el', namespace);
      } catch (fallbackError) {
        console.error(`Fallback failed for ${namespace}`, fallbackError);
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
export async function loadNamespace(namespace: Namespace, language?: Language) {
  const currentLanguage = (language || i18n.language || 'el') as Language;
  
  // Check if already loaded
  if (i18n.hasResourceBundle(currentLanguage, namespace)) {
    return;
  }
  
  const translations = await loadTranslations(currentLanguage, namespace);
  
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
    'errors',
    'toasts',
    'auth',
    'building',      // Building management - core module
    'navigation',    // Navigation labels
    'projects',      // Projects module
    'contacts',      // Contacts module
    'units',         // Units module
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
  console.log('🗑️ Translation cache cleared');
}

export default i18n;