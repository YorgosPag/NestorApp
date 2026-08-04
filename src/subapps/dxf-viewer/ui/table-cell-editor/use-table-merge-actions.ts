'use client';

/**
 * ADR-755 — **η μία διαδρομή από «πάτησε συγχώνευση» σε αλλαγμένο μοντέλο**.
 *
 * Αδελφός του `use-table-border-actions.ts` και παραμετρικός ως προς τα **όρια** για τον ίδιο
 * λόγο: οι εντολές φτάνουν από **τρία** σημεία εισόδου — το mini toolbar των ζωνών δείκτη
 * (στόχος: ολόκληρη στήλη ή γραμμή), το mini toolbar πάνω από το δεξί κλικ σε κελιά, και τα
 * items του ίδιου μενού. Και τα τρία καταλήγουν σε **`TableCellRangeBounds`**· από εκεί και
 * κάτω δεν υπάρχει καμία διαφορά.
 *
 * ## 🔴 ΓΙΑΤΙ ΕΙΝΑΙ ΑΣΥΓΧΡΟΝΟ — και γιατί αυτό ΔΕΝ γεννά μπαγιάτικη ανάγνωση
 * Η συγχώνευση είναι η **μόνη** εντολή μορφοποίησης πίνακα που καταστρέφει δεδομένα, άρα
 * ρωτά πρώτα ({@link requestTableMergeDiscardConfirm}). Ανάμεσα στην ερώτηση και την απάντηση
 * ο πίνακας μπορεί να έχει αλλάξει — αλλά το {@link useLiveTableMutation} ξαναδιαβάζει το
 * **ζωντανό** μοντέλο τη στιγμή της εγγραφής, οπότε ο μετασχηματισμός εφαρμόζεται πάντα πάνω
 * σε ό,τι όντως υπάρχει. Ο ADR-040 κανόνας #2 («getter, ποτέ στιγμιότυπο») ισχύει εδώ
 * **δύο** φορές, όχι μία: και πριν το `await` και μετά.
 *
 * ## Η στοίχιση ΠΑΡΑΓΕΤΑΙ, δεν ταξιδεύει
 * Ακριβώς όπως το μολύβι των περιγραμμάτων (Α20/Α23): το «και κεντράρισμα» χρειάζεται τη
 * στοίχιση που **ισχύει τώρα** στην άγκυρα, και τη ρωτά τη στιγμή της εντολής πάνω στο μοντέλο
 * που θα γραφτεί. Παγωμένη στο render θα κρατούσε την κάθετη ζώνη που ίσχυε πριν ο χρήστης
 * αλλάξει στυλ γραμμής.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-merge-actions
 * @see bim/table/table-range-merge-ops.ts — οι καθαρές πράξεις
 * @see bim/table/table-merge-discard-confirm-store.ts — η χειραψία της ερώτησης
 * @see docs/centralized-systems/reference/adrs/ADR-755-table-cell-merge.md
 */

import { useMemo } from 'react';
import { resolveTableStyle } from '../../bim/table/table-entity-geometry';
import {
  applyTableMergeCommand,
  tableMergeAnchorAlign,
  tableMergeDiscardedCells,
  tableMergeState,
  type TableMergeCommandId,
  type TableMergeState,
} from '../../bim/table/table-range-merge-ops';
import { requestTableMergeDiscardConfirm } from '../../bim/table/table-merge-discard-confirm-store';
import { useLiveTableMutation } from './use-table-model-commit';
import { useCommandHistory } from '../../core/commands';
import type { TableCellRangeBounds } from '../../bim/table/table-cell-range';
import type { TableEntity } from '../../types/table-entity';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

export interface UseTableMergeActionsParams {
  readonly levelManager: LevelManagerLike;
  /** Ο πίνακας **τη στιγμή της κλήσης** — ποτέ στιγμιότυπο απόδοσης (ADR-040 κανόνας #2). */
  readonly liveTable: () => TableEntity | null;
}

export interface TableMergeActions {
  /**
   * Εκτελεί μία από τις τέσσερις. Ασύγχρονη **μόνο** όταν θα χαθεί περιεχόμενο — δες την
   * κεφαλίδα για το γιατί το `await` δεν κάνει την ανάγνωση μπαγιάτικη.
   */
  readonly applyCommand: (
    bounds: TableCellRangeBounds,
    commandId: TableMergeCommandId,
  ) => Promise<void>;
  /** Τι δείχνει το χειριστήριο. Απαντιέται **στο άνοιγμα** του μενού, όχι σε κάθε απόδοση. */
  readonly resolveState: (bounds: TableCellRangeBounds) => TableMergeState;
}

export function useTableMergeActions(params: UseTableMergeActionsParams): TableMergeActions {
  const { levelManager, liveTable } = params;
  const { execute } = useCommandHistory();
  // Η κοινή ουρά κάθε πράξης — **μία** υλοποίηση, κοινή με τη μορφοποίηση άξονα και τα
  // περιγράμματα (N.18). Ένα `UpdateEntityCommand`, ένα `Ctrl+Z`.
  const runOnLive = useLiveTableMutation({ levelManager, execute, liveTable });

  return useMemo<TableMergeActions>(
    () => ({
      applyCommand: async (bounds, commandId) => {
        const live = liveTable();
        if (!live) return;

        // Η ερώτηση μπαίνει **πριν** από κάθε εγγραφή και μόνο όταν έχει νόημα: με μηδέν κελιά
        // προς απώλεια η συγχώνευση εκτελείται σιωπηλά, ίδια σύμβαση με τη μεταφορά περιοχής.
        const discarded = tableMergeDiscardedCells(live.model, bounds, commandId);
        if (discarded > 0 && (await requestTableMergeDiscardConfirm(discarded)) !== 'merge') return;

        // Το **στυλ** διαβάζεται μία φορά (δεν εξαρτάται από το μοντέλο)· η **στοίχιση** μέσα
        // στον μετασχηματισμό, πάνω στο μοντέλο που όντως θα γραφτεί.
        const style = resolveTableStyle(live);
        runOnLive((model) =>
          applyTableMergeCommand(
            model,
            bounds,
            commandId,
            tableMergeAnchorAlign(model, style, bounds),
          ));
      },
      resolveState: (bounds) => {
        const live = liveTable();
        return live
          ? tableMergeState(live.model, bounds)
          : { merged: false, canMerge: false };
      },
    }),
    [liveTable, runOnLive],
  );
}
