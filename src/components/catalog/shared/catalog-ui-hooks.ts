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
import { resolveHumanLanguage } from '@/i18n/languages';
import { resolveLocalizedText, type LocalizedText } from '@/i18n/localized-text';
import { useNotifications } from '@/providers/NotificationProvider';
import type { CatalogFailure } from '@/services/catalog/catalog-failure';
import { isGranted } from '@/types/capability-authority';
import { CATALOG_NS, FAILURE_KEYS } from './catalog-labels';

/** `t` του namespace + επίλυση πολύγλωσσων δεδομένων στη γλώσσα του UI. */
export function useCatalogText() {
  const { t, i18n } = useTranslation(CATALOG_NS);
  const language = resolveHumanLanguage(i18n.language);
  const text = useCallback(
    (value: LocalizedText | undefined, fallback = '') => resolveLocalizedText(value, language) || fallback,
    [language],
  );
  return { t, text, language };
}

/** Η μία ειδοποίηση αποτυχίας εγγραφής — ίδια λέξη για ίδιο είδος, σε κάθε οθόνη του καταλόγου. */
export function useCatalogFailureNotice(): (failure: CatalogFailure) => void {
  const { t } = useTranslation(CATALOG_NS);
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

/** Μπορεί αυτός ο άνθρωπος να **αλλάζει** το σχήμα; (`pending` ⇒ όχι ακόμη — ποτέ κουμπί πριν την ταυτότητα.) */
export function useCatalogCanManage(): boolean {
  const gate = useCapability('catalog:schema:manage');
  return !gate.pending && isGranted(gate.verdict);
}

/** Μπορεί αυτός ο άνθρωπος να **αλλάζει δεδομένα** (προϊόντα · μέσα); — Akeneo «edit products» ≠ «manage structure». */
export function useCatalogCanManageProducts(): boolean {
  const gate = useCapability('catalog:products:manage');
  return !gate.pending && isGranted(gate.verdict);
}
