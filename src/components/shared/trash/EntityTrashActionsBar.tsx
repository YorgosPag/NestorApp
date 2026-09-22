'use client';

/**
 * 🗑️ EntityTrashActionsBar — η μπάρα κάδου μιας οντότητας που επαναφέρει **μόνη της** (επαφές, ακίνητα).
 *
 * Ένας κανόνας για «σε ποια ids δρω» (τα επιλεγμένα, αλλιώς το ενεργό στο πάνελ), μία ροή επαναφοράς
 * (`useTrashBarRestore`), μία διάταξη (`TrashActionsBar`). Η οντότητα δίνει **μόνο** ό,τι διαφέρει: την υπηρεσία και
 * τα κείμενα του namespace της — τίποτα από τομέα δεν εισάγεται εδώ.
 *
 * Γέννηση (ADR-867 2026-09-22 · N.0.2): οι επαφές και τα ακίνητα είχαν δίδυμη ολόκληρη τη μπάρα (διάταξη **και** ροή).
 *
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-584 — Anti-Duplication
 */

import { TrashActionsBar } from '@/components/shared/trash/TrashActionsBar';
import { useTrashBarRestore } from '@/components/shared/trash/useTrashBarRestore';

/** Τα κείμενα ανά οντότητα — ήδη μεταφρασμένα, από το namespace της. */
export interface EntityTrashText {
  readonly back: string;
  readonly warning: string;
  readonly restoreSuccess: (count: number) => string;
  readonly restoreFailed: string;
}

export interface EntityTrashActionsBarProps {
  readonly selectedIds: string[];
  /** Το στοιχείο του πάνελ λεπτομερειών — ο στόχος όταν δεν υπάρχει πολλαπλή επιλογή. */
  readonly activeId?: string | null;
  readonly onBack: () => void;
  /** Ανανέωση λίστας + καθαρισμός επιλογής — μετά από **κάθε** επαναφορά, και αποτυχημένη. */
  readonly onRefresh: () => void;
  readonly onPermanentDelete: (ids?: string[]) => void;
  readonly trashCount: number;
  readonly entity: string;
  readonly restore: (ids: string[]) => Promise<unknown>;
  readonly text: EntityTrashText;
}

/** Σε ποια ids δρα η μπάρα: τα επιλεγμένα, αλλιώς το ενεργό, αλλιώς κανένα. */
export function effectiveTrashIds(selectedIds: string[], activeId: string | null | undefined): string[] {
  if (selectedIds.length > 0) return selectedIds;
  return activeId ? [activeId] : [];
}

export function EntityTrashActionsBar({
  selectedIds,
  activeId,
  onBack,
  onRefresh,
  onPermanentDelete,
  trashCount,
  entity,
  restore,
  text,
}: EntityTrashActionsBarProps) {
  const runRestore = useTrashBarRestore({
    entity,
    restore,
    successMessage: text.restoreSuccess,
    failureMessage: text.restoreFailed,
    onSettled: onRefresh,
  });

  return (
    <TrashActionsBar
      selectedIds={effectiveTrashIds(selectedIds, activeId)}
      onBack={onBack}
      onRestore={(ids) => void runRestore(ids)}
      onPermanentDelete={(ids) => onPermanentDelete(ids)}
      trashCount={trashCount}
      labels={{ back: text.back, warning: text.warning }}
    />
  );
}
