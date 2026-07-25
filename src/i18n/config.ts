/**
 * Main i18n configuration with lazy loading support
 * This config now uses lazy loading for better performance
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ICU from 'i18next-icu';
import { loadNamespace, CRITICAL_NAMESPACES, type Language, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './lazy-config';
import { remapLegacyTranslationKey } from './namespace-compat';
import { pseudoPostProcessor, PSEUDO_LANGUAGE } from './pseudo-post-processor';

import { createModuleLogger } from '@/lib/telemetry';
import { safeGetItem, STORAGE_KEYS } from '@/lib/storage';
const logger = createModuleLogger('i18n-config');

// Load essential translations for initial boot
import commonEl from './locales/el/common.json';
import commonEn from './locales/en/common.json';
import commonActionsEl from './locales/el/common-actions.json';
import commonActionsEn from './locales/en/common-actions.json';
import commonNavigationEl from './locales/el/common-navigation.json';
import commonNavigationEn from './locales/en/common-navigation.json';
import commonStatusEl from './locales/el/common-status.json';
import commonStatusEn from './locales/en/common-status.json';
import commonValidationEl from './locales/el/common-validation.json';
import commonValidationEn from './locales/en/common-validation.json';
import commonEmptyStatesEl from './locales/el/common-empty-states.json';
import commonEmptyStatesEn from './locales/en/common-empty-states.json';
// Pre-load landing for homepage
import landingEl from './locales/el/landing.json';
import landingEn from './locales/en/landing.json';
// 🏢 ENTERPRISE: Pre-load navigation (used on every page - prevents race condition warnings)
import navigationEl from './locales/el/navigation.json';
import navigationEn from './locales/en/navigation.json';
// 🏢 ENTERPRISE: Pre-load admin (used on admin pages - prevents hydration mismatch)
import adminEl from './locales/el/admin.json';
import adminEn from './locales/en/admin.json';

// Initial resources - common, landing, and navigation for immediate availability
const resources = {
  el: { common: commonEl, 'common-actions': commonActionsEl, 'common-navigation': commonNavigationEl, 'common-status': commonStatusEl, 'common-validation': commonValidationEl, 'common-empty-states': commonEmptyStatesEl, landing: landingEl, navigation: navigationEl, admin: adminEl },
  en: { common: commonEn, 'common-actions': commonActionsEn, 'common-navigation': commonNavigationEn, 'common-status': commonStatusEn, 'common-validation': commonValidationEn, 'common-empty-states': commonEmptyStatesEn, landing: landingEn, navigation: navigationEn, admin: adminEn },
};

// Detect preferred language
const getInitialLanguage = (): Language => {
  // Always start with default language to avoid SSR/CSR mismatch.
  return DEFAULT_LANGUAGE;
};

// Initialize i18n with minimal resources
i18n
  .use(ICU)
  .use(pseudoPostProcessor)
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    debug: false, // Disabled to reduce console noise

    // 🧪 ADR-666: το pseudo παράγεται runtime από το el — δεν έχει resource αρχεία
    postProcess: [PSEUDO_LANGUAGE],

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
    const saved = safeGetItem(STORAGE_KEYS.PREFERRED_LANGUAGE, '');
    const browser = navigator.language.split('-')[0];
    const preferred = (saved || browser) as Language;
    const validLang: Language = SUPPORTED_LANGUAGES.includes(preferred) ? preferred : DEFAULT_LANGUAGE;

    try {
      // 🏢 SSoT: CRITICAL_NAMESPACES lives in lazy-config.ts and is shared with
      // preloadCriticalNamespaces() (language switch). Do not restate it here.
      await Promise.all(
        CRITICAL_NAMESPACES.map(async (ns) => {
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
