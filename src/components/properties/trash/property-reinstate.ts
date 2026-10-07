'use client';

/**
 * ♻️ property-reinstate — ο δρόμος επιστροφής ενός αποσυρμένου ακινήτου και τα λόγια του, ΜΙΑ φορά.
 *
 * Ζούσαν μέσα στις δύο μπάρες (`PropertyTrashActionsBar` · `PropertyArchiveActionsBar`). Εξήχθησαν όταν
 * απέκτησαν τρίτο καταναλωτή: την «Επαναφορά» **πάνω στην ίδια την εγγραφή** στη σελίδα
 * `/properties/[id]` (ADR-329 §3.9). Δεύτερη γραφή θα επέτρεπε η σελίδα να λέει «επαναφέρθηκε» εκεί
 * όπου η λίστα λέει «επαναφέρθηκε — μένει εκτός αγοράς».
 *
 * ⚠️ Ο δρόμος του αρχείου (`unarchiveProperties`) μένει στο `usePropertiesArchiveState`: τον ζητά και η
 * μηχανή της λίστας. Εδώ μόνο ξαναεξάγεται, ώστε οι καταναλωτές της επαναφοράς να έχουν μία πόρτα.
 *
 * @module components/properties/trash/property-reinstate
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-584 — Anti-Duplication
 */

import { useMemo } from 'react';

import type { EntityTrashText } from '@/components/shared/trash/EntityTrashActionsBar';
import { unarchiveProperties } from '@/hooks/usePropertiesArchiveState';
import { useTranslation } from '@/i18n';
import { TrashService } from '@/services/trash.service';
import type { LifecycleOutcome } from '@/types/soft-deletable';

export { unarchiveProperties };

/** Ο ΕΝΑΣ δρόμος επιστροφής από τον κάδο. */
export const restoreTrashedProperties = (ids: string[]): Promise<unknown> =>
  TrashService.bulkRestore('property', ids);

/** Τα λόγια της ροής επαναφοράς — ό,τι λέει η ειδοποίηση μετά το κλικ. */
type ReinstateFlowText<TResult> = Pick<EntityTrashText<TResult>, 'restoreSuccess' | 'restoreFailed'>;

/** Επαναφορά από τον **κάδο**: το ακίνητο γυρίζει όπως ήταν. */
export function useTrashedPropertyReinstateText(): ReinstateFlowText<unknown> {
  const { t } = useTranslation('properties-viewer');
  return useMemo(
    () => ({
      restoreSuccess: (count: number) => t('trash.restoreSuccess', { count }),
      restoreFailed: t('trash.restoreFailed'),
    }),
    [t],
  );
}

/**
 * Επαναφορά από το **αρχείο**: ο διακομιστής λέει αν κάποιο γύρισε εκτός αγοράς, και το μήνυμα το
 * λέει ρητά — ο άνθρωπος το διαβάζει στην ειδοποίηση, όχι σε επεξήγηση που ίσως δεν είδε.
 */
export function useArchivedPropertyReinstateText(): ReinstateFlowText<LifecycleOutcome[]> & { readonly restore: string } {
  const { t } = useTranslation('trash');
  return useMemo(
    () => ({
      restore: t('unarchive'),
      restoreSuccess: (count: number, outcomes: LifecycleOutcome[]) =>
        outcomes.includes('taken-off-market')
          ? t('unarchiveSuccessOffMarket', { count })
          : t('unarchiveSuccess', { count }),
      restoreFailed: t('unarchiveFailed'),
    }),
    [t],
  );
}
