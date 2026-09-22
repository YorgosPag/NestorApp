'use client';

/**
 * ♻️ useTrashBarRestore — η ροή «Επαναφορά» της μπάρας κάδου, ΜΙΑ φορά.
 *
 * Οι επαφές και τα ακίνητα την έγραφαν η καθεμιά μόνη της (jscpd: δίδυμοι 20 γραμμών, ADR-867 2026-09-22):
 * log → κλήση υπηρεσίας → ειδοποίηση επιτυχίας ή αποτυχίας → ανανέωση **και στις δύο περιπτώσεις** (ένα 409 σημαίνει
 * «ήδη επανήλθε αλλού» — η λίστα πρέπει να το δείξει). Κάθε οντότητα δίνει μόνο ό,τι πραγματικά διαφέρει: την υπηρεσία
 * (οι επαφές περνούν από πολιτική, τα ακίνητα από το `TrashService`) και τα μηνύματα του namespace της.
 *
 * ⚠️ Το ADR-281 έχει ήδη τη μηχανή `useEntityTrashState` (κτίρια, parking, έργα, αποθήκες). Επαφές και ακίνητα δεν
 * έχουν μεταφερθεί ακόμη σε αυτή — εκκρεμότητα στο `.claude-rules/pending-ratchet-work.md`· με τη μεταφορά, αυτό το hook
 * απορροφάται από τη μηχανή.
 *
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-584 — Anti-Duplication
 */

import { useCallback } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { useNotifications } from '@/providers/NotificationProvider';

const logger = createModuleLogger('useTrashBarRestore');

export interface TrashBarRestoreSpec {
  /** Όνομα για τα logs (π.χ. `contacts`). */
  readonly entity: string;
  /** Η υπηρεσία επαναφοράς της οντότητας. */
  readonly restore: (ids: string[]) => Promise<unknown>;
  /** Μήνυμα επιτυχίας — ο πληθυντικός ζει στο locale (ICU), όχι εδώ. */
  readonly successMessage: (count: number) => string;
  readonly failureMessage: string;
  /** Ανανέωση λίστας + καθαρισμός επιλογής — τρέχει **πάντα**, και σε αποτυχία. */
  readonly onSettled: () => void;
}

export function useTrashBarRestore(spec: TrashBarRestoreSpec): (ids: string[]) => Promise<void> {
  const { notify } = useNotifications();
  const { entity, restore, successMessage, failureMessage, onSettled } = spec;

  return useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    logger.info('Restoring from trash', { entity, ids });
    try {
      await restore(ids);
      logger.info('Restore succeeded', { entity, ids });
      notify(successMessage(ids.length), { type: 'success' });
    } catch (error) {
      logger.error('Restore failed', { entity, ids, error });
      notify(failureMessage, { type: 'error' });
    }
    onSettled();
  }, [entity, restore, successMessage, failureMessage, onSettled, notify]);
}
