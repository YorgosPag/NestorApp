'use client';

/**
 * @fileoverview **Τα κοινά hooks των οθονών του καταλόγου** — γλώσσα δεδομένων, ειδοποίηση αποτυχίας, δικαίωμα
 *   διαχείρισης (ADR-923 Φάση 1γ).
 * @module components/catalog/shared/catalog-ui-hooks
 *
 * 🔑 **Δύο γλώσσες, δύο μηχανισμοί**: το κείμενο της **οθόνης** περνά από το `t()` (locale JSON, N.11)· το κείμενο
 *    που **έγραψε ο χρήστης** (ετικέτα ιδιότητας) είναι δεδομένο `LocalizedText` και επιλύεται με το
 *    `resolveLocalizedText` στη γλώσσα του UI — με εφεδρεία, ποτέ κενό αν υπάρχει έστω μία γλώσσα.
 * 🔑 **Το δικαίωμα κρύβει, δεν προστατεύει** (ADR-801 PEP): ο γραφέας ξανακρίνει το `catalog:schema:manage`.
 */

import { useCallback } from 'react';

import { useCapability } from '@/auth/hooks/useCapability';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { CATALOG_NAMESPACES } from '@/i18n/namespace-bundles';
import { resolveHumanLanguage } from '@/i18n/languages';
import { resolveLocalizedText, type LocalizedText } from '@/i18n/localized-text';
import { useNotifications } from '@/providers/NotificationProvider';
import type { CatalogFailure } from '@/services/catalog/catalog-failure';
import { isGranted } from '@/types/capability-authority';
import { FAILURE_KEYS } from './catalog-labels';

/** `t` του namespace + επίλυση πολύγλωσσων δεδομένων στη γλώσσα του UI. */
export function useCatalogText() {
  const { t, i18n } = useTranslation(CATALOG_NAMESPACES);
  const language = resolveHumanLanguage(i18n.language);
  const text = useCallback(
    (value: LocalizedText | undefined, fallback = '') => resolveLocalizedText(value, language) || fallback,
    [language],
  );
  return { t, text, language };
}

/** Η μία ειδοποίηση αποτυχίας εγγραφής — ίδια λέξη για ίδιο είδος, σε κάθε οθόνη του καταλόγου. */
export function useCatalogFailureNotice(): (failure: CatalogFailure) => void {
  const { t } = useTranslation(CATALOG_NAMESPACES);
  const { error, warning } = useNotifications();
  return useCallback(
    (failure: CatalogFailure) => {
      const message = t(FAILURE_KEYS[failure.kind]);
      // Το «άλλαξε από άλλον» δεν είναι βλάβη: η οθόνη έχει ήδη τη νέα εκδοχή (ζωντανή ανάγνωση).
      if (failure.kind === 'revisionMismatch') warning(message);
      else error(message);
    },
    [t, error, warning],
  );
}

/** Οι δύο δικαιοδοσίες του καταλόγου — Akeneo «manage structure» ≠ «edit products» (προϊόντα · μέσα). */
export type CatalogAuthority = 'schema' | 'products';

const AUTHORITY_CAPABILITY = { schema: 'catalog:schema:manage', products: 'catalog:products:manage' } as const satisfies Record<CatalogAuthority, string>;

/**
 * Η ετυμηγορία **τριών** καταστάσεων: `pending` (η ταυτότητα δεν έφτασε — ούτε κουμπί ούτε «μόνο ανάγνωση») ·
 * `granted` · `denied`. Ζωντανά (ADR-923 §5.10.5): το boolean έχανε το `pending` ⇒ «μόνο ανάγνωση» σε όποιον **έχει** δικαίωμα.
 */
export function useCatalogAccess(authority: CatalogAuthority): 'pending' | 'granted' | 'denied' {
  const gate = useCapability(AUTHORITY_CAPABILITY[authority]);
  if (gate.pending) return 'pending';
  return isGranted(gate.verdict) ? 'granted' : 'denied';
}

/** Μπορεί αυτός ο άνθρωπος να **αλλάζει** το σχήμα; (`pending` ⇒ όχι ακόμη — ποτέ κουμπί πριν την ταυτότητα.) */
export function useCatalogCanManage(): boolean {
  return useCatalogAccess('schema') === 'granted';
}

/** Μπορεί αυτός ο άνθρωπος να **αλλάζει δεδομένα** (προϊόντα · μέσα); */
export function useCatalogCanManageProducts(): boolean {
  return useCatalogAccess('products') === 'granted';
}
