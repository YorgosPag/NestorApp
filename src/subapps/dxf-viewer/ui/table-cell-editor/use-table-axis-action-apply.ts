'use client';

/**
 * 🔴 ADR-739 §42 — **Η ΜΙΑ ΔΙΑΔΡΟΜΗ ΜΙΑΣ ΔΟΜΙΚΗΣ ΠΡΑΞΗΣ ΑΞΟΝΑ**: καθαρή μεταβολή → μία εντολή →
 * δρομέας σε κελί που **υπάρχει**.
 *
 * Δύο καταναλωτές, η ίδια ακολουθία: το **μενού ζωνών** (δεξί κλικ, §27.17) και το **⊖ της
 * διαγραφής** (§42).
 *
 * ## 🔴 Η ΤΕΛΕΥΤΑΙΑ ΚΙΝΗΣΗ ΕΙΝΑΙ ΠΟΥ ΚΑΝΕΙ ΤΗ ΔΙΑΔΡΟΜΗ ΜΗ ΠΡΟΦΑΝΗ
 * Χωρίς την τοποθέτηση του δρομέα, μια **διαγραφή** αφήνει τον δρομέα πάνω σε σβησμένη γραμμή:
 * ο επεξεργαστής ξεμοντάρει (`target` → `null`) και η συνεδρία γίνεται αδρανής — **ζωντανή στο
 * store, κουφή στην οθόνη**. Ο χρήστης βλέπει πίνακα ανοιχτό που δεν δέχεται πληκτρολόγιο, και
 * τίποτα δεν δηλώνει γιατί.
 *
 * Γι' αυτό η εξαγωγή έγινε **πριν** γραφτεί ο δεύτερος καταναλωτής και όχι μετά: ένα αντίγραφο
 * που ξεχνά αυτή τη γραμμή δεν σπάει τίποτα ορατό τη στιγμή που γράφεται — σπάει την **επόμενη**
 * πληκτρολόγηση του χρήστη.
 *
 * ## Γιατί ο δρομέας διαβάζεται με getter
 * ADR-040 κανόνας #2: ο δρομέας μπορεί να έχει μετακινηθεί ανάμεσα στο τελευταίο render και τη
 * στιγμή της πράξης (πλήκτρα, undo). Ένα στιγμιότυπο θα υπολόγιζε τον επιζώντα δρομέα από
 * **παλιά** θέση, δηλαδή θα πετούσε τον χρήστη σε άσχετο κελί μετά από κάθε διαγραφή.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-axis-action-apply
 * @see ui/table-cell-editor/table-header-axis-actions.ts — ΤΙ κάνει η πράξη (καθαρό, ήδη υπάρχον)
 * @see bim/table/table-axis-action-target.ts — ΠΟΙΟΥΣ άξονες αφορά (§27.17)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §27.17, §42
 */

import { useCallback } from 'react';
import { getTableCellCursor, setTableCellCursor } from '../../state/table-cell-cursor-store';
import { survivingCursor, type SurvivorPick } from './table-header-axis-actions';
import { useTableModelCommit } from './use-table-model-commit';
import type { TableEntity } from '../../types/table-entity';
import type { PersistedTableModel } from '../../types/table';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { ICommand } from '../../core/commands';
import { activeTableModel } from '../../bim/table/table-worksheet-resolve';

export interface UseTableAxisActionApplyParams {
  readonly levelManager: LevelManagerLike;
  /** Το ΙΔΙΟ σχήμα με το {@link useTableModelCommit} — καμία δεύτερη έννοια «εκτελεστή». */
  readonly execute: (command: ICommand) => void;
}

/** Εφαρμόζει μια δομική πράξη άξονα· `false` όταν δεν έγινε τίποτα (no-op ή αποτυχία commit). */
export type TableAxisActionApply = (
  live: TableEntity,
  mutate: (model: PersistedTableModel) => PersistedTableModel,
  pick: SurvivorPick,
) => boolean;

/** Δες την κεφαλίδα: καθαρή πράξη → ένα `UpdateEntityCommand` → επιζών δρομέας. */
export function useTableAxisActionApply(
  params: UseTableAxisActionApplyParams,
): TableAxisActionApply {
  const { levelManager, execute } = params;
  // Η ΙΔΙΑ διαδρομή commit με την επεξεργασία κελιού και την επικόλληση: ένα
  // `UpdateEntityCommand`, ένα `Ctrl+Z`, καμία δεύτερη διαδρομή εγγραφής (§6.6).
  const commitModel = useTableModelCommit({ levelManager, execute });

  return useCallback<TableAxisActionApply>(
    (live, mutate, pick) => {
      const cursor = getTableCellCursor();
      if (!cursor) return false;
      const nextModel = mutate(activeTableModel(live));
      // Ταυτότητα κατά αναφορά = η σύμβαση no-op ολόκληρου του `table-row-column-ops`: το
      // φράγμα πλήθους απάντησε «όχι» ⇒ καμία εντολή, κανένα βήμα undo που δεν αναιρεί τίποτα.
      if (nextModel === activeTableModel(live)) return false;
      if (!commitModel(live, nextModel)) return false;
      const position = survivingCursor(nextModel, cursor.position, pick);
      if (position) setTableCellCursor(live, position, 'nav');
      return true;
    },
    [commitModel],
  );
}
