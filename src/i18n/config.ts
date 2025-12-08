/**
 * Main i18n configuration with lazy loading support
 * This config now uses lazy loading for better performance
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ICU from 'i18next-icu';
import { loadNamespace } from './lazy-config';

// Load essential translations for initial boot
import commonEl from './locales/el/common.json';
import commonEn from './locales/en/common.json';
import commonPseudo from './locales/pseudo/common.json';
// Pre-load landing for homepage
import landingEl from './locales/el/landing.json';
import landingEn from './locales/en/landing.json';
import landingPseudo from './locales/pseudo/landing.json';

// Initial resources - common and landing for homepage
const resources = {
  el: { common: commonEl, landing: landingEl },
  en: { common: commonEn, landing: landingEn },
  pseudo: { common: commonPseudo, landing: landingPseudo },
};

// Detect preferred language
const getInitialLanguage = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('preferred-language');
    if (saved) return saved;
    
    const browser = navigator.language.split('-')[0];
    return browser === 'en' ? 'en' : 'el';
  }
  return 'el';
};

// Initialize i18n with minimal resources
i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'el',
    debug: false, // Disabled to reduce console noise
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    // Start with only common namespace
    defaultNS: 'common',
    ns: ['common'],
    
    react: {
      useSuspense: false, // Better for lazy loading
    },
  });

// Preload critical namespaces after initialization
if (typeof window !== 'undefined') {
  // Client-side only
  setTimeout(async () => {
    const criticalNamespaces = ['errors', 'toasts', 'navigation', 'dxf-viewer', 'geo-canvas'];
    const currentLang = i18n.language;
    
    // console.log('🚀 Preloading critical namespaces...');

    try {
      await Promise.all(
        criticalNamespaces.map(async (ns) => {
          await loadNamespace(ns as any, currentLang as any);
        })
      );

      // console.log('✅ Critical namespaces preloaded');
    } catch (error) {
      console.error('❌ Failed to preload namespaces:', error);
    }
  }, 100);
}

export default i18n;