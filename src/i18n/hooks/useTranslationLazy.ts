import { useTranslation as useI18nextTranslation } from 'react-i18next';
import type { TOptions } from 'i18next';
import { useEffect, useState } from 'react';
import { loadNamespace, type Namespace, type Language } from '../lazy-config';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('useTranslationLazy');

/**
 * Enhanced translation hook with lazy loading support
 */
export const useTranslationLazy = (namespace?: Namespace) => {
  const { t, i18n, ready } = useI18nextTranslation(namespace);
  const [isNamespaceLoaded, setIsNamespaceLoaded] = useState(false);

  useEffect(() => {
    if (!namespace) {
      setIsNamespaceLoaded(true);
      return;
    }

    // Check if namespace is already loaded
    if (i18n.hasResourceBundle(i18n.language, namespace)) {
      setIsNamespaceLoaded(true);
      return;
    }

    // Load namespace asynchronously
    loadNamespace(namespace, i18n.language as Language)
      .then(() => {
        setIsNamespaceLoaded(true);
      })
      .catch((error) => {
        logger.error(`Failed to load namespace ${namespace}`, { error });
        setIsNamespaceLoaded(true); // Still mark as loaded to prevent infinite loading
      });
  }, [namespace, i18n.language, i18n]);

  return {
    t,
    i18n,
    ready: ready && isNamespaceLoaded,
    isLoading: !isNamespaceLoaded,
    // Helper function for dynamic key translations
    translate: (key: string, options?: TOptions) => t(key, options),
    // Current language
    currentLanguage: i18n.language,
    // Change language function with namespace preloading
    changeLanguage: async (lng: string) => {
      if (namespace) {
        await loadNamespace(namespace, lng as Language);
      }
      return i18n.changeLanguage(lng);
    },
  };
};

export default useTranslationLazy;