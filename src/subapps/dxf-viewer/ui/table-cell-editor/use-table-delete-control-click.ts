'use client';

/**
 * 🔴 ADR-739 §42 — **ΤΟ ΠΑΤΗΜΑ ΤΟΥ ⊖**: μία διαγραφή γραμμών/στηλών, μία εντολή, ένα `Ctrl+Z`.
 *
 * ## 🔴 ΜΗΔΕΝ ΝΕΑ ΛΟΓΙΚΗ ΔΙΑΓΡΑΦΗΣ — και αυτό ήταν η προδιαγραφή, όχι το αποτέλεσμα
 * Το ⊖ είναι **ΧΕΙΡΙΣΤΗΡΙΟ, ΟΧΙ ΜΗΧΑΝΗ**: η διαγραφή δούλευε ήδη ολόκληρη από το δεξί κλικ
 * στη ζώνη (Φ.Δ βήμα 9 + §27.17). Αυτό το αρχείο δεν ξαναγράφει τίποτα από αυτά — προσθέτει
 * τον δρόμο **ανακάλυψης** που το δεξί κλικ δεν έχει. Κάθε κομμάτι υπήρχε:
 *
 * | ερώτηση | ποιος απαντά | πού γεννήθηκε |
 * |---|---|---|
 * | ποιους άξονες αφορά; | `resolveTableAxisActionTarget` (στο store, τη στιγμή του hover) | §27.17 |
 * | επιτρέπεται; | `canDeleteAxisTarget` | §42, κοινό με το μενού |
 * | τι κάνει; | `deleteAxisTarget` → `deleteTableRows/Columns` | Φ.Δ βήμα 9 |
 * | πώς γράφεται; | `useTableAxisActionApply` | §42, κοινό με το μενού |
 * | πώς πατιέται; | `useTableArmedControlClick` | §42, κοινό με το ⊕ |
 *
 * ## 🔴 ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΔΙΑΛΟΓΟΣ ΕΠΙΒΕΒΑΙΩΣΗΣ — και δεν είναι παράλειψη
 * Το subapp **έχει** μηχανισμό (`createConfirmStore`, 14 διάλογοι) και τον χρησιμοποιεί για
 * καταστροφικές πράξεις πίνακα (ADR-755: «θα κρατηθεί μόνο η επάνω αριστερή τιμή»). Εδώ δεν
 * μπαίνει, και ο λόγος είναι **ακριβώς ο λόγος που μπαίνει εκεί**:
 *
 * > Ο διάλογος της συγχώνευσης υπάρχει επειδή η συγχώνευση **δομικά δεν μπορεί να δείξει** τι
 * > θα χαθεί πριν γίνει. Η διαγραφή **μπορεί, και το δείχνει**: όσο το ⊖ είναι οπλισμένο,
 * > ολόκληρος ο άξονας που θα φύγει είναι βαμμένος κόκκινος.
 *
 * Δηλαδή η κόκκινη προεπισκόπηση **είναι** αυτό που ο διάλογος υπάρχει για να αναπληρώσει. Ένα
 * δεύτερο βήμα από πάνω της θα ήταν φόρος σε κάθε διαγραφή για πληροφορία που ο χρήστης έχει
 * ήδη μπροστά του — και είναι η στάση που ακολουθούν τα εργαλεία σχεδίασης με ισχυρό undo
 * (Figma: ένα κλικ, `Ctrl+Z`). Το undo εδώ είναι το **ίδιο** `UpdateEntityCommand` με κάθε
 * άλλη πράξη πίνακα.
 *
 * ⚠️ Αν αύριο το ⊖ αποκτήσει δρόμο **χωρίς** ορατή προεπισκόπηση (π.χ. συντόμευση
 * πληκτρολογίου), το επιχείρημα καταρρέει μαζί με την προεπισκόπηση — και **τότε** ο διάλογος
 * του ADR-755 είναι η σωστή απάντηση, όχι πριν.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-delete-control-click
 * @see ui/table-cell-editor/use-table-armed-control-click.ts — ΠΩΣ πατιέται (κοινό με το ⊕)
 * @see ui/table-cell-editor/use-table-axis-action-apply.ts — ΠΩΣ γράφεται (κοινό με το μενού)
 * @see state/table-delete-control-store.ts — ΤΙ ακριβώς θα φύγει (ο στόχος ταξιδεύει μαζί)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §42
 */

import { type RefObject } from 'react';
import { useCommandHistory } from '../../core/commands';
import {
  getTableDeleteControl,
  type TableDeleteControlState,
} from '../../state/table-delete-control-store';
import { deleteAxisTarget } from './table-header-axis-actions';
import { useTableArmedControlClick } from './use-table-armed-control-click';
import { useTableAxisActionApply } from './use-table-axis-action-apply';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

export interface UseTableDeleteControlClickParams {
  /** Το **ίδιο** `active` με τον hover: χωρίς πίνακα δεν υπάρχει τίποτα να πατηθεί. */
  readonly active: boolean;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly levelManager: LevelManagerLike;
}

/** Εκτελεί τη διαγραφή που υπόσχεται το οπλισμένο ⊖, όσο υπάρχει πίνακας στο προσκήνιο. */
export function useTableDeleteControlClick(params: UseTableDeleteControlClickParams): void {
  const { active, containerRef, levelManager } = params;
  const { execute } = useCommandHistory();
  const applyAxisAction = useTableAxisActionApply({ levelManager, execute });

  useTableArmedControlClick<TableDeleteControlState>({
    active,
    containerRef,
    levelManager,
    // Η φάση ελέγχεται **εδώ**: είναι γνώση του ⊖, όχι του ακροατή. Στη φάση `nearby` το συμβάν
    // περνά ανέγγιχτο και το κουτί του γράμματος ανήκει ακέραιο στη ζώνη (επιλογή άξονα).
    resolveArmed: () => {
      const state = getTableDeleteControl();
      return state && state.control.phase === 'armed' ? state : null;
    },
    // 🔑 **Ο στόχος δεν ξαναλύνεται εδώ.** Διαβάζεται από το store, δηλαδή είναι ακριβώς αυτός
    // που ζωγραφίστηκε κόκκινος τη στιγμή που ο χρήστης κοίταξε. Μια δεύτερη κλήση του
    // `resolveTableAxisActionTarget` θα έδινε το ίδιο **σχεδόν πάντα** — και το «σχεδόν» εδώ
    // σβήνει δεδομένα: αρκεί μια επέκταση επιλογής ανάμεσα στην κίνηση και το πάτημα.
    run: (live, state) => {
      const { mutate, pick } = deleteAxisTarget(state.target);
      applyAxisAction(live, mutate, pick);
    },
  });
}
