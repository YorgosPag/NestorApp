"use client";

import { useEffect, useState } from 'react';
import { useTranslation as useI18nextTranslation } from 'react-i18next';
import type { TOptions } from 'i18next';
import { loadNamespace, type Namespace, type Language } from '../lazy-config';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('useTranslation');

/**
 * Custom translation hook with lazy loading support
 *
 * @param namespace - Translation namespace (e.g., 'dxf-viewer', 'forms')
 * @returns Translation function and i18n utilities
 */
export const useTranslation = (namespace?: string | string[]) => {
  const { t, i18n, ready } = useI18nextTranslation(namespace);
  const namespaceKey = Array.isArray(namespace)
    ? namespace.join('|')
    : namespace || '';
  const namespaces = namespaceKey ? namespaceKey.split('|') : [];

  // 🏢 ENTERPRISE: Track if this specific namespace is loaded
  const [namespaceLoaded, setNamespaceLoaded] = useState(() => {
    // Check if namespace is already loaded on mount
    if (namespaces.length === 0 || namespaces.every((ns) => ns === 'common')) {
      return true;
    }
    return namespaces.every((ns) => ns === 'common' || i18n.hasResourceBundle(i18n.language, ns));
  });

  // Lazy load namespace if specified
  useEffect(() => {
    if (namespaces.length > 0 && !namespaces.every((ns) => ns === 'common')) {
      // Check if already loaded
      const shouldForceReload = process.env.NODE_ENV === 'development';
      const allLoaded = namespaces.every((ns) => ns === 'common' || i18n.hasResourceBundle(i18n.language, ns));
      if (!shouldForceReload && allLoaded) {
        setNamespaceLoaded(true);
        return;
      }

      // Load namespace asynchronously
      setNamespaceLoaded(false);
      const namespacesToLoad = namespaces.filter((ns) => ns !== 'common');
      Promise.all(
        namespacesToLoad.map((ns) => loadNamespace(ns as Namespace, i18n.language as Language, shouldForceReload))
      )
        .then(() => {
          setNamespaceLoaded(true);
          if (process.env.NODE_ENV === 'development') {
            logger.info(`[i18n] Namespace(s) "${namespacesToLoad.join(', ')}" loaded for language "${i18n.language}"`);
          }
        })
        .catch(error => {
          logger.error(`Failed to load namespace(s): ${namespacesToLoad.join(', ')}`, { error });
          setNamespaceLoaded(true); // Mark as loaded to prevent infinite loading
        });
    }
  }, [namespaceKey, i18n, i18n.language]);

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
        if (namespaces.length > 0 && !namespaces.every((ns) => ns === 'common')) {
          const namespacesToLoad = namespaces.filter((ns) => ns !== 'common');
          await Promise.all(
            namespacesToLoad.map((ns) => loadNamespace(ns as Namespace, lng as Language))
          );
        }
        
        await i18n.changeLanguage(lng);
        
        // Store preference
        if (typeof window !== 'undefined') {
          localStorage.setItem('preferred-language', lng);
        }
      } catch (error) {
        logger.error('Failed to change language', { error });
      }
    },
    // 🏢 ENTERPRISE: Loading state for this specific namespace (not just ready)
    // This ensures re-render when lazy-loaded namespace becomes available
    isNamespaceReady: ready && namespaceLoaded,
  };
};

export default useTranslation;
