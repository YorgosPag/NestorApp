"use client";

import { useEffect, useState, useMemo } from 'react';
import { useTranslation as useI18nextTranslation } from 'react-i18next';
import type { TOptions } from 'i18next';
import { loadNamespace, type Namespace, type Language } from '../lazy-config';
import { remapLegacyTranslationKey, getCompatNamespaces } from '../namespace-compat';

import { createModuleLogger } from '@/lib/telemetry';
import { safeSetItem, STORAGE_KEYS } from '@/lib/storage';
const logger = createModuleLogger('useTranslation');

/**
 * Compute all namespaces that must be loaded: explicit + ADR-280 compat splits.
 * E.g. ['common'] → ['common-shared', 'common-actions', ...]
 * E.g. ['properties'] → ['properties', 'properties-detail', 'properties-enums', ...]
 */
function resolveAllNamespaces(namespaces: string[]): string[] {
  const compatSplits = namespaces.flatMap((ns) => [...getCompatNamespaces(ns)]);
  const nonCommon = namespaces.filter((ns) => ns !== 'common');
  return [...new Set([...nonCommon, ...compatSplits])];
}

/**
 * Custom translation hook with lazy loading support
 *
 * @param namespace - Translation namespace (e.g., 'dxf-viewer', 'forms')
 * @returns Translation function and i18n utilities
 */
export const useTranslation = (namespace?: string | string[]) => {
  const { t: rawT, i18n, ready } = useI18nextTranslation(namespace);
  const namespaceKey = Array.isArray(namespace)
    ? namespace.join('|')
    : namespace || '';
  const namespaces = namespaceKey ? namespaceKey.split('|') : [];
  const primaryNs = namespaces[0] || 'common';

  // 🏢 ADR-280: Resolve compat splits once
  const allNamespacesToLoad = useMemo(() => resolveAllNamespaces(namespaces), [namespaceKey]);

  // Wrap t to apply compat remapping for split namespaces (ADR-280)
  const t = useMemo(() => {
    const wrapped = ((key: string, optionsOrDefault?: TOptions | string, ...rest: unknown[]) => {
      // Try original namespace first
      const result = rawT(key, optionsOrDefault as TOptions, ...rest);
      if (typeof result === 'string' && result !== key && !result.includes(':')) {
        return result;
      }

      // If key wasn't found, try remapping via compat layer
      const fullKey = `${primaryNs}:${key}`;
      const remapped = remapLegacyTranslationKey(fullKey, optionsOrDefault);
      if (remapped.key !== fullKey) {
        const remappedResult = rawT(remapped.key, remapped.options as TOptions, ...rest);
        if (typeof remappedResult === 'string' && remappedResult !== remapped.key) {
          return remappedResult;
        }
      }

      return result;
    }) as typeof rawT;
    return wrapped;
  }, [rawT, primaryNs]);

  // 🏢 ENTERPRISE: Track if ALL required namespaces (explicit + compat) are loaded
  const [namespaceLoaded, setNamespaceLoaded] = useState(() => {
    if (allNamespacesToLoad.length === 0) return true;
    return allNamespacesToLoad.every((ns) => i18n.hasResourceBundle(i18n.language, ns));
  });

  // Lazy load namespace + its compat split namespaces (ADR-280)
  useEffect(() => {
    if (allNamespacesToLoad.length === 0) return;

    const shouldForceReload = process.env.NODE_ENV === 'development';
    const allLoaded = allNamespacesToLoad.every((ns) => i18n.hasResourceBundle(i18n.language, ns));
    if (!shouldForceReload && allLoaded) {
      setNamespaceLoaded(true);
      return;
    }

    // Load all namespaces (explicit + compat splits) asynchronously
    setNamespaceLoaded(false);
    Promise.all(
      allNamespacesToLoad.map((ns) => loadNamespace(ns as Namespace, i18n.language as Language, shouldForceReload))
    )
      .then(() => {
        setNamespaceLoaded(true);
      })
      .catch(error => {
        logger.error(`Failed to load namespace(s): ${allNamespacesToLoad.join(', ')}`, { error });
        setNamespaceLoaded(true); // Mark as loaded to prevent infinite loading
      });
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
        if (allNamespacesToLoad.length > 0) {
          await Promise.all(
            allNamespacesToLoad.map((ns) => loadNamespace(ns as Namespace, lng as Language))
          );
        }

        await i18n.changeLanguage(lng);
        safeSetItem(STORAGE_KEYS.PREFERRED_LANGUAGE, lng);
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
