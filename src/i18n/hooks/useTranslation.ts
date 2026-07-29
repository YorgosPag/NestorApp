"use client";

import { useEffect, useState, useMemo } from 'react';
import { useTranslation as useI18nextTranslation } from 'react-i18next';
import type { TOptions } from 'i18next';
import { loadNamespace, type Namespace, type Language } from '../lazy-config';
import { remapLegacyTranslationKey, getCompatNamespaces, getExplicitNamespace } from '../namespace-compat';

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
 * 🔴 ADR-635 Φ C.23 — ΠΟΤΕ ΔΕΝ ΤΟ ΞΑΝΑΓΡΑΨΕΙΣ ΩΣ `result !== key`.
 *
 * Όταν το i18next **αστοχεί** σε κλειδί με πρόθεμα namespace (`dxf-viewer:import.warnings.summary`)
 * επιστρέφει το κλειδί **χωρίς** το πρόθεμα (`import.warnings.summary`). Η παλιά σύγκριση
 * `result !== key` το έβλεπε ως **επιτυχία**, οπότε:
 *   1. το ωμό κλειδί ζωγραφιζόταν στην οθόνη σαν να ήταν μετάφραση, και
 *   2. το compat στρώμα του ADR-280 **δεν δοκιμαζόταν ΠΟΤΕ** για ολόκληρη τη σύμβαση `ns:key`
 *      — δηλαδή για όλα τα `NOTIFICATION_KEYS`.
 * Μετρημένο 2026-07-29: `import.warnings.summary` στην οθόνη ενώ η μετάφραση ΥΠΑΡΧΕΙ.
 */
function isUnresolved(result: unknown, key: string): boolean {
  if (typeof result !== 'string') return true;
  return result === key || result === getExplicitNamespace(key).bareKey;
}

/** Ένα προειδοποιητικό ανά κλειδί ανά session — ένα ωμό κλειδί μπορεί να ζωγραφιστεί σε κάθε frame. */
const warnedUnresolvedKeys = new Set<string>();

/** Ελάχιστη όψη του i18next instance που χρειάζεται η διάγνωση (χωρίς `any`). */
interface BundleProbe {
  readonly language: string;
  hasResourceBundle(language: string, namespace: string): boolean;
}

/**
 * Ένα ωμό κλειδί στην οθόνη δεν επιτρέπεται να είναι **σιωπηλό**: αφήνει ίχνος με το ΠΟΙΟ
 * κλειδί, σε ΠΟΙΑ γλώσσα, και **ποια namespaces ήταν όντως φορτωμένα** τη στιγμή της κλήσης —
 * που είναι ακριβώς η διαφορά ανάμεσα σε «λείπει η μετάφραση» και «δεν είχε φορτώσει ακόμα».
 */
function warnUnresolvedKey(fullKey: string, probe: BundleProbe, namespaces: readonly string[]): void {
  if (process.env.NODE_ENV === 'production') return;
  if (warnedUnresolvedKeys.has(fullKey)) return;
  warnedUnresolvedKeys.add(fullKey);

  const language = probe.language;
  const bundles = namespaces.map(
    (ns) => `${ns}=${probe.hasResourceBundle(language, ns) ? 'loaded' : 'MISSING'}`,
  );
  logger.warn(`i18n: raw key reached the UI → ${fullKey}`, { language, bundles });
}

/**
 * Custom translation hook with lazy loading support
 *
 * @param namespace - Translation namespace (e.g., 'dxf-viewer', 'forms')
 * @returns Translation function and i18n utilities
 */
export const useTranslation = (namespace?: string | readonly string[]) => {
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
      if (!isUnresolved(result, key)) {
        return result;
      }

      // If key wasn't found, try remapping via compat layer. Ένα κλειδί που φέρει ΗΔΗ πρόθεμα
      // namespace δεν ξανα-προθεματίζεται — το `dxf-viewer:dxf-viewer:import.…` δεν ταιριάζει
      // με κανέναν legacy κανόνα, άρα ακύρωνε σιωπηλά όλο το compat στρώμα του ADR-280.
      const fullKey = getExplicitNamespace(key).namespace ? key : `${primaryNs}:${key}`;
      const remapped = remapLegacyTranslationKey(fullKey, optionsOrDefault);
      if (remapped.key !== fullKey) {
        const remappedResult = rawTCall(remapped.key, remapped.options as TOptions, ...rest);
        if (!isUnresolved(remappedResult, remapped.key)) {
          return remappedResult;
        }
      }

      warnUnresolvedKey(fullKey, i18n, allNamespacesToLoad);
      return result;
    };
    return wrapped as unknown as typeof rawT;
  }, [rawT, primaryNs, namespaceLoaded, i18n, allNamespacesToLoad]);

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
