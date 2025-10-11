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

// Cache for loaded translations
const translationCache = new Map<string, any>();

/**
 * Dynamic translation loader
 */
async function loadTranslations(language: Language, namespace: Namespace) {
  const cacheKey = `${language}:${namespace}`;
  
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    // Dynamic import based on language and namespace
    const translations = await import(`./locales/${language}/${namespace}.json`);
    const data = translations.default || translations;
    
    translationCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.warn(`Failed to load translations for ${language}:${namespace}`, error);
    
    // Fallback to Greek if available
    if (language !== 'el') {
      try {
        const fallback = await import(`./locales/el/${namespace}.json`);
        const data = fallback.default || fallback;
        translationCache.set(cacheKey, data);
        return data;
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
  const initialResources: Record<string, Record<string, any>> = {};
  
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
 */
export async function preloadCriticalNamespaces(language: Language = 'el') {
  const critical: Namespace[] = ['common', 'errors', 'toasts'];
  
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