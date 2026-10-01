"use client";

/**
 * @fileoverview **ΕΙΝΑΙ ΠΛΗΡΗ ΤΑ ΔΙΚΑ ΜΟΥ BUNDLES — ΑΠΟ ΟΠΟΙΟΔΗΠΟΤΕ ΜΟΝΟΠΑΤΙ;** — ADR-744 §25.
 * @related `useTranslation.ts` (μοναδικός καταναλωτής) · `../bundle-registry.ts` (η αυθεντία)
 *
 * 🔴 Ο hook μετάφρασης ξαναζωγράφιζε **μόνο** όταν τελείωνε η **δική του** φόρτωση.
 * Αν το namespace το ολοκλήρωνε άλλο μονοπάτι (boot preload, άλλο mount, ανάκτηση
 * μετά από `failed`), ένα ωμό κλειδί που είχε ήδη ζωγραφιστεί έμενε στην οθόνη.
 *
 * 🔑 Το στιγμιότυπο είναι **boolean**: το `useSyncExternalStore` το συγκρίνει με
 * `Object.is`, άρα ο καταναλωτής ξαναζωγραφίζει **μόνο** όταν αλλάξει η απάντηση
 * για τα δικά του namespaces — όχι σε κάθε φόρτωση άσχετου bundle.
 */

import { useCallback, useSyncExternalStore } from 'react';

import { isBundleComplete, subscribeBundleRegistry } from '../bundle-registry';

export function useBundlesComplete(language: string, namespaces: readonly string[]): boolean {
  const snapshot = useCallback(
    () => namespaces.every((namespace) => isBundleComplete(language, namespace)),
    [language, namespaces],
  );
  return useSyncExternalStore(subscribeBundleRegistry, snapshot, snapshot);
}
