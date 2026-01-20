"use client";

import { useEffect, useState } from 'react';
import { useTranslation as useI18nextTranslation } from 'react-i18next';
import type { TOptions } from 'i18next';
import { loadNamespace, type Namespace, type Language } from '../lazy-config';

/**
 * Custom translation hook with lazy loading support
 *
 * @param namespace - Translation namespace (e.g., 'dxf-viewer', 'forms')
 * @returns Translation function and i18n utilities
 */
export const useTranslation = (namespace?: string) => {
  const { t, i18n, ready } = useI18nextTranslation(namespace);

  // 🏢 ENTERPRISE: Track if this specific namespace is loaded
  const [namespaceLoaded, setNamespaceLoaded] = useState(() => {
    // Check if namespace is already loaded on mount
    if (!namespace || namespace === 'common') {
      return true;
    }
    return i18n.hasResourceBundle(i18n.language, namespace);
  });

  // Lazy load namespace if specified
  useEffect(() => {
    if (namespace && namespace !== 'common') {
      // Check if already loaded
      if (i18n.hasResourceBundle(i18n.language, namespace)) {
        setNamespaceLoaded(true);
        return;
      }

      // Load namespace asynchronously
      setNamespaceLoaded(false);
      loadNamespace(namespace as Namespace)
        .then(() => {
          setNamespaceLoaded(true);
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ [i18n] Namespace "${namespace}" loaded for language "${i18n.language}"`);
          }
        })
        .catch(error => {
          console.error(`Failed to load namespace: ${namespace}`, error);
          setNamespaceLoaded(true); // Mark as loaded to prevent infinite loading
        });
    }
  }, [namespace, i18n, i18n.language]);

  return {
    t,
    i18n,
    ready,
    // Helper function for dynamic key translations
    translate: (key: string, options?: TOptions) => t(key, options),
    // Current language
    currentLanguage: i18n.language,
    // Change language function with namespace loading
    changeLanguage: async (lng: string) => {
      try {
        // If we have a namespace, preload it for the new language
        if (namespace && namespace !== 'common') {
          await loadNamespace(namespace as Namespace, lng as Language);
        }
        
        await i18n.changeLanguage(lng);
        
        // Store preference
        if (typeof window !== 'undefined') {
          localStorage.setItem('preferred-language', lng);
        }
      } catch (error) {
        console.error('Failed to change language:', error);
      }
    },
    // 🏢 ENTERPRISE: Loading state for this specific namespace (not just ready)
    // This ensures re-render when lazy-loaded namespace becomes available
    isNamespaceReady: ready && namespaceLoaded,
  };
};

export default useTranslation;