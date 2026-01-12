"use client";

import { useEffect } from 'react';
import { useTranslation as useI18nextTranslation, TOptions } from 'react-i18next';
import { loadNamespace, type Namespace, type Language } from '../lazy-config';

/**
 * Custom translation hook with lazy loading support
 * 
 * @param namespace - Translation namespace (e.g., 'dxf-viewer', 'forms')
 * @returns Translation function and i18n utilities
 */
export const useTranslation = (namespace?: string) => {
  const { t, i18n, ready } = useI18nextTranslation(namespace);

  // Lazy load namespace if specified
  useEffect(() => {
    if (namespace && namespace !== 'common') {
      loadNamespace(namespace as Namespace).catch(error => {
        console.error(`Failed to load namespace: ${namespace}`, error);
      });
    }
  }, [namespace]);

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
    // Loading state for namespace
    isNamespaceReady: ready,
  };
};

export default useTranslation;