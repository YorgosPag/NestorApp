'use client';

/**
 * ADR-750 Φάσεις 3+4 — **η μία διαδρομή από «πάτησε εντολή περιγράμματος» σε αλλαγμένο μοντέλο**.
 *
 * ## Γιατί παραμετρικό ως προς τα ΟΡΙΑ και όχι ως προς τον άξονα
 * Οι εντολές φτάνουν από **δύο** σημεία εισόδου: το mini toolbar των ζωνών δείκτη (Φ3, όπου ο
 * στόχος είναι ολόκληρη στήλη ή γραμμή) και το δεξί κλικ πάνω σε επιλογή κελιών (Φ4, όπου ο
 * στόχος είναι η επιλογή). Και οι δύο καταλήγουν σε **`TableCellRangeBounds`** — και από εκεί
 * και κάτω δεν υπάρχει καμία διαφορά.
 *
 * Δύο χειριστές, ένας ανά είσοδο, θα ήταν sibling clone (N.18) με **δύο** αντίγραφα της
 * ακολουθίας «ζωντανό μοντέλο → στυλ → μολύβι → πράξη → commit» — δηλαδή δύο σημεία που μπορούν
 * κάποτε να δώσουν διαφορετικό μολύβι στην ίδια εντολή, ανάλογα με το πού την πάτησες.
 *
 * ## Το μολύβι δεν ταξιδεύει, **παράγεται**
 * Η Α15 κλείδωσε ότι είναι παράμετρος και ποτέ store· η Α20 απαντά ποιος το δίνει: το ενεργό
 * στυλ του πίνακα, τη στιγμή της εντολής ({@link resolveTableBorderPencil}).
 *
 * ✅ **Φ5 (Α23)**: πάνω από το στυλ κάθεται η **επιλογή** του χρήστη, ανά πεδίο. Διαβάζεται
 * κι αυτή **τη στιγμή της εντολής** ({@link tableBorderPencilChoice}) και ποτέ ως στιγμιότυπο
 * απόδοσης — ο κανόνας #2 του ADR-040 ισχύει εδώ ακέραιος: το πάνελ μπορεί να άλλαξε πάχος
 * χωρίς αυτός ο χειριστής να ξαναποδοθεί, και ένα παγωμένο μολύβι θα εφάρμοζε το προηγούμενο.
 *
 * ## Καμία δεύτερη διαδρομή εγγραφής
 * `useTableModelCommit` — ένα `UpdateEntityCommand`, ένα `Ctrl+Z`, η ίδια διαδρομή με την
 * επεξεργασία κελιού, την επικόλληση και τη μορφοποίηση άξονα (ADR-739 §6.6).
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-border-actions
 * @see bim/table/table-range-border-ops.ts — οι καθαρές πράξεις (Φ2)
 * @see bim/table/table-border-pencil.ts — η προέλευση του μολυβιού (Α20)
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §18
 */

import { useMemo } from 'react';
import { resolveTableStyle } from '../../bim/table/table-entity-geometry';
import { resolveTableBorderPencil } from '../../bim/table/table-border-pencil';
import { tableBorderPencilChoice } from '../../state/table-border-pencil-store';
import {
  applyTableDiagonalCommand,
  hasTableRangeDiagonals,
  type TableDiagonalCommandId,
} from '../../bim/table/table-cell-diagonal-ops';
import {
  applyTableBorderCommand,
  clearTableRangeBorders,
  hasExplicitTableRangeBorders,
  type TableBorderCommandId,
} from '../../bim/table/table-range-border-ops';
import { useLiveTableMutation } from './use-table-model-commit';
import { useCommandHistory } from '../../core/commands';
import type { TableCellRangeBounds } from '../../bim/table/table-cell-range';
import type { TableBorderSpec } from '../../types/table-edges';
import type { PersistedTableModel } from '../../types/table';
import type { TableEntity } from '../../types/table-entity';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type {
  TableBorderDialogTarget,
} from '../components/table-format-toolbar/border-dialog/TableBorderDialog';

export interface UseTableBorderActionsParams {
  readonly levelManager: LevelManagerLike;
  /** Ο πίνακας **τη στιγμή της κλήσης** — ποτέ στιγμιότυπο απόδοσης (ADR-040 κανόνας #2). */
  readonly liveTable: () => TableEntity | null;
}

export interface TableBorderActions {
  readonly applyCommand: (bounds: TableCellRangeBounds, commandId: TableBorderCommandId) => void;
  readonly resetBorders: (bounds: TableCellRangeBounds) => void;
  /** Απαντιέται **στο άνοιγμα** του μενού, όχι σε κάθε απόδοση — διατρέχει τις ακμές της περιοχής. */
  readonly canReset: (bounds: TableCellRangeBounds) => boolean;
  /**
   * ADR-750 Φ5 (Α2) — οι **διαγώνιοι**. Ξεχωριστή είσοδος και όχι 14η/15η εντολή του
   * `applyCommand`: το μοντέλο είναι άλλο (κελί, όχι ακμή) και άρα και το μητρώο — δες
   * `table-cell-diagonal-ops.ts`. Ίδιο **μολύβι** όμως, γιατί ο χρήστης έχει ένα μολύβι.
   */
  readonly applyDiagonal: (
    bounds: TableCellRangeBounds,
    commandId: TableDiagonalCommandId,
  ) => void;
  /** Υπάρχει διαγώνιος να σβηστεί; — το `canReset` της «Χωρίς διαγώνιες». */
  readonly canClearDiagonals: (bounds: TableCellRangeBounds) => boolean;
  /**
   * 🔑 Το μολύβι **που θα εφαρμοστεί τώρα** — για την προεπισκόπηση της ζώνης σχεδίασης.
   *
   * Συνάρτηση και όχι τιμή, γιατί ο ADR-040 κανόνας #2 ισχύει αυτούσιος: το πάνελ μπορεί να
   * άλλαξε πάχος χωρίς ο γονέας να ξαναποδοθεί, και ένα παγωμένο στιγμιότυπο θα έδειχνε το
   * προηγούμενο μολύβι — δηλαδή η προεπισκόπηση θα έλεγε ψέματα ακριβώς στο χειριστήριο που
   * μόλις πείραξε ο χρήστης.
   *
   * `null` όταν δεν υπάρχει ζωντανός πίνακας (μπαγιάτικο μενού μετά από undo).
   */
  readonly resolvePencil: () => TableBorderSpec | null;
  /**
   * ADR-750 Φ6 — η **αφετηρία του προσχεδίου** του διαλόγου «Περισσότερα περιγράμματα…»:
   * όρια + ζωντανό μοντέλο + ενεργό στυλ, σε μία ερώτηση.
   *
   * Ίδια σύμβαση με το {@link resolvePencil}: **συνάρτηση**, γιατί απαντιέται τη στιγμή που ο
   * χρήστης πατά (ADR-040 κανόνας #2). `null` χωρίς ζωντανό πίνακα ⇒ ο διάλογος δεν ανοίγει,
   * αντί να ανοίξει πάνω σε μοντέλο που δεν υπάρχει πια.
   */
  readonly resolveDialogTarget: (bounds: TableCellRangeBounds) => TableBorderDialogTarget | null;
  /**
   * ADR-750 Φ6 — το «ΟΚ» του διαλόγου: **ένα** έτοιμο μοντέλο, **ένα** commit.
   *
   * Δεν παίρνει μετασχηματιστή (όπως κάθε άλλη πράξη εδώ) επειδή η δουλειά έχει ήδη γίνει: ο
   * διάλογος κράτησε ολόκληρο το προσχέδιο. Περνά όμως από την **ίδια** ουρά, ώστε ο φύλακας
   * του no-op by-reference να ισχύει και εδώ — «άνοιξα, πείραξα, το ξαναέφερα όπως ήταν, ΟΚ»
   * δεν γεννά βήμα αναίρεσης.
   */
  readonly commitModel: (model: PersistedTableModel) => void;
}

export function useTableBorderActions(params: UseTableBorderActionsParams): TableBorderActions {
  const { levelManager, liveTable } = params;
  const { execute } = useCommandHistory();
  // Η κοινή ουρά κάθε πράξης — **μία** υλοποίηση, κοινή με τη μορφοποίηση άξονα (N.18).
  const runOnLive = useLiveTableMutation({ levelManager, execute, liveTable });

  return useMemo<TableBorderActions>(
    () => ({
      applyCommand: (bounds, commandId) => {
        const live = liveTable();
        if (!live) return;
        const pencil = resolveTableBorderPencil(resolveTableStyle(live), tableBorderPencilChoice());
        runOnLive((model) => applyTableBorderCommand(model, bounds, commandId, pencil));
      },
      resetBorders: (bounds) => {
        runOnLive((model) => clearTableRangeBorders(model, bounds));
      },
      canReset: (bounds) => {
        const live = liveTable();
        return live ? hasExplicitTableRangeBorders(live.model, bounds) : false;
      },
      applyDiagonal: (bounds, commandId) => {
        const live = liveTable();
        if (!live) return;
        // Το **ίδιο** μολύβι με τα περιγράμματα, από την ίδια συνάρτηση: μια δεύτερη ανάγνωση
        // στυλ+επιλογής εδώ θα ήταν δεύτερη απάντηση στο «με τι γράφω τώρα», και θα απέκλινε
        // την ημέρα που το μολύβι θα αποκτήσει πέμπτο πεδίο.
        const pencil = resolveTableBorderPencil(resolveTableStyle(live), tableBorderPencilChoice());
        runOnLive((model) => applyTableDiagonalCommand(model, bounds, commandId, pencil));
      },
      canClearDiagonals: (bounds) => {
        const live = liveTable();
        return live ? hasTableRangeDiagonals(live.model, bounds) : false;
      },
      resolvePencil: () => {
        const live = liveTable();
        if (!live) return null;
        return resolveTableBorderPencil(resolveTableStyle(live), tableBorderPencilChoice());
      },
      resolveDialogTarget: (bounds) => {
        const live = liveTable();
        if (!live) return null;
        return { bounds, model: live.model, style: resolveTableStyle(live) };
      },
      commitModel: (nextModel) => {
        runOnLive(() => nextModel);
      },
    }),
    [liveTable, runOnLive],
  );
}
