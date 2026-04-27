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
  // Include ALL original namespaces + their compat splits.
  // Previously filtered out 'common', but that broke rawT lookups for
  // unsplit keys like audit.* that still live in the common namespace.
  return [...new Set([...namespaces, ...compatSplits])];
}

/**
 * Custom translation hook with lazy loading support
 *
 * @param namespace - Translation namespace (e.g., 'dxf-viewer', 'forms')
 * @returns Translation function and i18n utilities
 */
export const useTranslation = (namespace?: string | string[]) => {
  const namespaceKey = Array.isArray(namespace)
    ? namespace.join('|')
    : namespace || '';
  const namespaces = namespaceKey ? namespaceKey.split('|') : [];
  const primaryNs = namespaces[0] || 'common';

  // 🏢 ADR-280: Resolve compat splits once
  const allNamespacesToLoad = useMemo(() => resolveAllNamespaces(namespaces), [namespaceKey]);

  // 🏢 ADR-280 FIX: Pass ALL compat namespaces to rawT so it can find keys
  // in split namespaces directly (with proper interpolation)
  const effectiveNs = useMemo(
    () => allNamespacesToLoad.length > 0 ? allNamespacesToLoad : namespace,
    [allNamespacesToLoad, namespace],
  );
  const { t: rawT, i18n, ready } = useI18nextTranslation(effectiveNs);

  // 🏢 ENTERPRISE: Track if ALL required namespaces (explicit + compat) are loaded
  // Declared BEFORE `t` memo so namespaceLoaded can be a dep — forces `t` to be a new
  // reference when the namespace finishes loading, ensuring consumers' useMemo chains
  // (e.g. TradeSelector options) recompute and show the correct translated labels.
  const [namespaceLoaded, setNamespaceLoaded] = useState(() => {
    if (allNamespacesToLoad.length === 0) return true;
    return allNamespacesToLoad.every((ns) => i18n.hasResourceBundle(i18n.language, ns));
  });

  // Wrap t to apply compat remapping for split namespaces (ADR-280)
  const t = useMemo(() => {
    type RawTCall = (key: string, opts?: TOptions | string, ...rest: unknown[]) => string;
    const rawTCall = rawT as unknown as RawTCall;
    const wrapped = (key: string, optionsOrDefault?: TOptions | string, ...rest: unknown[]) => {
      // Try original namespace first
      const result = rawTCall(key, optionsOrDefault, ...rest);
      if (typeof result === 'string' && result !== key && !result.includes(':')) {
        return result;
      }

      // If key wasn't found, try remapping via compat layer
      const fullKey = `${primaryNs}:${key}`;
      const remapped = remapLegacyTranslationKey(fullKey, optionsOrDefault);
      if (remapped.key !== fullKey) {
        const remappedResult = rawTCall(remapped.key, remapped.options as TOptions, ...rest);
        if (typeof remappedResult === 'string' && remappedResult !== remapped.key) {
          return remappedResult;
        }
      }

      return result;
    };
    return wrapped as unknown as typeof rawT;
  }, [rawT, primaryNs, namespaceLoaded]);

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
