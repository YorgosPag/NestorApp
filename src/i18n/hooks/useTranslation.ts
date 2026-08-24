"use client";

import { useEffect, useState, useMemo } from 'react';
import { useTranslation as useI18nextTranslation } from 'react-i18next';
import type { TOptions } from 'i18next';
import { loadNamespace, type Namespace, type Language } from '../lazy-config';
import { remapLegacyTranslationKey, getCompatNamespaces, getExplicitNamespace } from '../namespace-compat';
import { getBundleState, isBundleComplete } from '../bundle-registry';
import { isUnresolvedTranslation } from '../unresolved-key';

import { createModuleLogger } from '@/lib/telemetry';
// ⚠️ ADR-777 §8.29 (Π9): διαγράφοντας το `changeLanguage` έφυγε και ο **μοναδικός**
// καταναλωτής του `safeSetItem` εδώ. Η εγγραφή στο `localStorage` ζει πλέον
// αποκλειστικά στο `useLanguagePreference` — ένα σημείο, όχι δύο.
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

// 🏢 ADR-798 §7 — ο έλεγχος «ανεπίλυτο κλειδί;» ζούσε εδώ ως ιδιωτική συνάρτηση.
// Απέκτησε **δεύτερο** καλούντα (`config.ts`, ο καθολικός compat μπαλωματής), οπότε
// μετακόμισε σε SSoT αντί να αντιγραφεί: δύο μηχανές για ένα ερώτημα είναι ADR-749.
// Το σώμα και τα δύο πληρωμένα σχόλια μετακόμισαν **αυτούσια**.
const isUnresolved = isUnresolvedTranslation;

/** Ένα προειδοποιητικό ανά κλειδί ανά session — ένα ωμό κλειδί μπορεί να ζωγραφιστεί σε κάθε frame. */
const warnedUnresolvedKeys = new Set<string>();

type RawTCall = (key: string, opts?: TOptions | string, ...rest: unknown[]) => string;

/**
 * 🔴 Ο ΠΙΝΑΚΑΣ NAMESPACES ΔΕΝ ΚΑΝΕΙ LOOKUP — ΜΟΝΟ ΦΟΡΤΩΣΗ.
 *
 * Το react-i18next δένει το `t` στο **πρώτο** namespace, όχι σε όλα:
 * `useTranslation.js:56` → `i18nOptions.nsMode === 'fallback' ? namespaces : namespaces[0]`.
 * Άρα το `useTranslation(['dxf-viewer', …, 'files-media'])` **φορτώνει** το `files-media`
 * αλλά δεν ψάχνει ΠΟΤΕ μέσα του. Μετρημένο 2026-07-31 (ADR-716 Φ5): το console έλεγε
 * `files-media=loaded` ενώ η οθόνη ζωγράφιζε `floorplanImport.drawingUnits.title`.
 * Μέχρι τότε το μόνο μονοπάτι προς μη-πρωτεύον ns ήταν το compat στρώμα του ADR-280 —
 * που καλύπτει μόνο όσες ρίζες έχει καταγεγραμμένες.
 *
 * Δίχτυ **τελευταίας γραμμής**: τρέχει ΜΟΝΟ αφού αποτύχουν και το primary και το compat,
 * δηλαδή ακριβώς εκεί που σήμερα ζωγραφιζόταν ωμό κλειδί. Ό,τι λύνεται σήμερα λύνεται
 * απαράλλαχτα — μηδενική επιφάνεια παλινδρόμησης by construction. Η σειρά του πίνακα
 * παραμένει η σειρά προτεραιότητας, όπως θα έκανε και το `nsMode: 'fallback'`.
 *
 * ⚠️ ΜΗΝ το μετατρέψεις σε καθολικό `nsMode: 'fallback'` στο init: εκείνο τρέχει **πριν**
 * το compat remap και μπορεί να αλλάξει την επίλυση κλειδιών που σήμερα δουλεύουν.
 */
function resolveAcrossNamespaces(
  rawTCall: RawTCall,
  key: string,
  namespaces: readonly string[],
  primaryNs: string,
  optionsOrDefault?: TOptions | string,
  rest: readonly unknown[] = [],
): string | undefined {
  // Κλειδί που φέρει ΗΔΗ πρόθεμα ns έχει δηλώσει πού ζει — δεν το ξανα-προθεματίζουμε.
  if (getExplicitNamespace(key).namespace) return undefined;

  for (const ns of namespaces) {
    if (ns === primaryNs) continue;
    const scopedKey = `${ns}:${key}`;
    const scoped = rawTCall(scopedKey, optionsOrDefault, ...rest);
    if (!isUnresolved(scoped, scopedKey)) return scoped;
  }
  return undefined;
}

/** Ελάχιστη όψη του i18next instance που χρειάζεται η διάγνωση (χωρίς `any`). */
interface BundleProbe {
  readonly language: string;
}

/**
 * Ένα ωμό κλειδί στην οθόνη δεν επιτρέπεται να είναι **σιωπηλό**: αφήνει ίχνος με το ΠΟΙΟ
 * κλειδί, σε ΠΟΙΑ γλώσσα, και **σε ποια κατάσταση ήταν κάθε bundle** τη στιγμή της κλήσης.
 *
 * 🔴 ADR-744 §11 — εδώ έγραφε `hasResourceBundle(…) ? 'loaded' : 'MISSING'`, δηλαδή **δύο**
 * καταστάσεις εκεί που υπάρχουν **τρεις**. Το κρίσιμο ενδιάμεσο — bundle που υπάρχει αλλά
 * είναι **κομμένο** από το shell slice — αναφερόταν ως `loaded`, οπότε το ίχνος του
 * `/projects` έλεγε κατά λέξη «projects=loaded» ενώ το bundle είχε 1 από 49 κλειδιά. Το
 * μόνο όργανο που θα μπορούσε να δείξει την αιτία **έδειχνε το αντίθετο της αιτίας**.
 */
function warnUnresolvedKey(fullKey: string, probe: BundleProbe, namespaces: readonly string[]): void {
  if (process.env.NODE_ENV === 'production') return;
  if (warnedUnresolvedKeys.has(fullKey)) return;
  warnedUnresolvedKeys.add(fullKey);

  const language = probe.language;
  const bundles = namespaces.map((ns) => `${ns}=${getBundleState(language, ns)}`);
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
  // 🔴 ADR-744 §11 — `isBundleComplete`, ΟΧΙ `hasResourceBundle`: ένα κομμένο shell-slice
  // bundle υπάρχει αλλά δεν αρκεί. Βλ. `src/i18n/bundle-registry.ts`.
  const [namespaceLoaded, setNamespaceLoaded] = useState(() => {
    if (allNamespacesToLoad.length === 0) return true;
    return allNamespacesToLoad.every((ns) => isBundleComplete(i18n.language, ns));
  });

  // Wrap t to apply compat remapping for split namespaces (ADR-280)
  const t = useMemo(() => {
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

      // Τελευταία γραμμή: τα υπόλοιπα namespaces του πίνακα είναι ΦΟΡΤΩΜΕΝΑ αλλά το
      // react-i18next δεν κοιτάζει μέσα τους — ρώτα τα ρητά πριν παραδοθεί ωμό κλειδί.
      const crossNs = resolveAcrossNamespaces(
        rawTCall, key, allNamespacesToLoad, primaryNs, optionsOrDefault, rest,
      );
      if (crossNs !== undefined) return crossNs;

      warnUnresolvedKey(fullKey, i18n, allNamespacesToLoad);
      return result;
    };
    return wrapped as unknown as typeof rawT;
  }, [rawT, primaryNs, namespaceLoaded, i18n, allNamespacesToLoad]);

  // Lazy load namespace + its compat split namespaces (ADR-280)
  useEffect(() => {
    if (allNamespacesToLoad.length === 0) return;

    const shouldForceReload = process.env.NODE_ENV === 'development';
    // 🔴 ADR-744 §11 — το δεύτερο από τα δύο σημεία που ρωτούσαν «υπάρχει κάτι;» αντί για
    // «υπάρχει ΟΛΟ;». Στην παραγωγή αυτό ακριβώς το `return` άφηνε μόνιμα ωμό το
    // `page.loadingMessage` στο /projects: το slice είχε γράψει `projects` (1/49 κλειδιά),
    // άρα «όλα φορτωμένα», άρα ο loader δεν καλούνταν ποτέ.
    const allLoaded = allNamespacesToLoad.every((ns) => isBundleComplete(i18n.language, ns));
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
    // 🌐 ADR-777 §8.29 — **το `changeLanguage` ΔΙΑΓΡΑΦΗΚΕ από εδώ. Χρησιμοποίησε
    //    το `useLanguagePreference`.**
    //
    // Έκανε προφόρτωση namespaces → `i18n.changeLanguage` → `localStorage`, και
    // **σταματούσε εκεί**: η επιλογή δεν έφτανε ποτέ στη βάση, άρα ο διακομιστής
    // (cron) έγραφε τα αυτόματα email πάντα στα ελληνικά. Μετά τη μεταφορά του
    // μοναδικού καλούντα (`PreferencesPageContent`) στον ιδιοκτήτη, έμεινε με
    // **μηδέν καλούντες** — μετρημένο.
    //
    // ⚠️ **Δεν διαγράφηκε επειδή ήταν νεκρό· διαγράφηκε επειδή ήταν ΛΑΘΟΣ και
    // βολικό.** Ένας νεκρός δρόμος που φαίνεται σωστός είναι χειρότερος από
    // απουσία: ο επόμενος θα το έβρισκε με συμπλήρωση κώδικα, θα το καλούσε, και
    // θα ξαναγεννούσε το ίδιο μισό ελάττωμα — με όλα τα tests πράσινα, γιατί η
    // οθόνη **όντως** αλλάζει γλώσσα.
    // 🏢 ENTERPRISE: Loading state for this specific namespace (not just ready)
    // This ensures re-render when lazy-loaded namespace becomes available
    isNamespaceReady: ready && namespaceLoaded,
  };
};

export default useTranslation;
