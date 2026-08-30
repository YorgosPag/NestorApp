'use client';

/**
 * 🔴 ADR-739 §69 — **Η ΜΕΤΑΒΑΣΗ ΑΠΟ ΤΟ ΠΛΑΙΣΙΟ ΟΝΟΜΑΤΟΣ**, ως μία αδιαίρετη πράξη.
 *
 * Ο χρήστης γράφει `B7` και πατά `Enter`. Φαίνεται σαν μία ενέργεια· είναι **τέσσερις**, με
 * **υποχρεωτική σειρά**, και κάθε λάθος σειρά είναι σιωπηλή απώλεια δουλειάς.
 *
 * ## 🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ
 *
 * | # | βήμα | γιατί ΕΔΩ και όχι αλλού |
 * |---|---|---|
 * | 1 | **δέσμευσε το πρόχειρο** | Ο χρήστης μπορεί να έγραφε μέσα σε κελί όταν έπιασε το πλαίσιο. Το `blur` του κελιού **δεν** δέσμευσε — είδε μέλος της ίδιας συνεδρίας (`table-cell-session-focus`) και σωστά δεν έκανε τίποτα. Αν ο δρομέας μετακινηθεί πρώτος, το `setTableCellCursor` **σβήνει το πρόχειρο** και η πληκτρολόγηση χάνεται χωρίς μήνυμα. |
 * | 2 | **μετακίνησε τον δρομέα** | — |
 * | 3 | **γράψε την περιοχή** | Το `setTableCellCursor` **διαλύει** κάθε περιοχή (τεκμηριωμένο στο store). Γραμμένη πριν, θα έσβηνε τη στιγμή που γεννιέται — ακριβώς ο λόγος που το `selectWholeAxis` τηρεί την ίδια σειρά. |
 * | 4 | **επίστρεψε το πληκτρολόγιο στο πλέγμα** | Αλλιώς ο χρήστης «πήγε» στο `B7` και τα βέλη του γράφουν ακόμα γράμματα στο πλαίσιο ονόματος. |
 *
 * Το βήμα 1 δεν είναι νέος κανόνας — είναι **ο ίδιος** που τηρούν ήδη το πληκτρολόγιο
 * (`use-table-cell-session-keys`, `case 'move'`: «πρώτα δεσμεύεται το πρόχειρο, μετά
 * μετακινείται ο δρομέας») και το ποντίκι (§26.15). Στο πλαίσιο ονόματος απλώς έλειπε, γιατί
 * το πλαίσιο ονόματος δεν μπορούσε να μετακινήσει τίποτα.
 *
 * ## 🔴 ΓΙΑΤΙ ΔΕΝ ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ ΤΟ `requestTableCellCursorCommit()`
 * Υπάρχει ήδη ακριβώς για «καλούντες που δεν μπορούν να δεσμεύσουν μόνοι τους» (ADR-763
 * Φ2.4.1) και ήταν ο πρώτος υποψήφιος. Είναι **σήμα**: ο εξυπηρετητής του τρέχει σε effect,
 * δηλαδή **ένα καρέ αργότερα**. Η μετακίνηση του δρομέα από κάτω θα προλάβαινε — και θα
 * έσβηνε το πρόχειρο πριν προλάβει κανείς να το δεσμεύσει. Είναι το σχήμα race condition που
 * απαγορεύει το N.7.2 #2, και η αποφυγή του είναι ο λόγος που αυτός ο δρομολογητής ζει μέσα
 * στη React, δίπλα στον ιδιοκτήτη της δέσμευσης, αντί να είναι δεύτερο σήμα.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-name-box-goto
 * @see bim/table/table-name-box-reference.ts — τι σημαίνει το κείμενο (καθαρό)
 * @see ui/table-cell-editor/TableNameBox.tsx — ποιος το καλεί
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §69
 */

import { useCallback } from 'react';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import { parseTableNameBoxReference } from '../../bim/table/table-name-box-reference';
import {
  restartTableCellCursorSession,
  setTableCellCursor,
  setTableCellSelection,
} from '../../state/table-cell-cursor-store';
import type { TableEntity } from '../../types/table-entity';
import { activeTableModel } from '../../bim/table/table-worksheet-resolve';

export interface UseTableNameBoxGotoParams {
  /** Η **ζωντανή** οντότητα του δρομέα· `null` όταν ο πίνακας χάθηκε από κάτω του. */
  readonly entity: TableEntity | null;
  /**
   * ADR-739 §26.15 — «δέσμευσε ό,τι γράφεται **τώρα**». No-op σε πλοήγηση και ιδεμποτής: ο
   * **ίδιος** χειριστής που ήδη τηρεί το ποντίκι, όχι δεύτερη διαδρομή εγγραφής.
   */
  readonly onCommitPending: () => void;
}

/**
 * `true` ⇒ η αναφορά λύθηκε και ο δρομέας μετακινήθηκε· `false` ⇒ **τίποτα δεν άλλαξε**.
 *
 * Η άρνηση είναι σιωπηλή επίτηδες: το κείμενο μπορεί να μην είναι διεύθυνση, να δείχνει εκτός
 * πλέγματος, ή να έχει τρία άκρα — και οι τρεις περιπτώσεις σημαίνουν το ίδιο για τον χρήστη
 * («δεν πάω εκεί») και για τον καλούντα (επαναφορά του πεδίου).
 */
export function useTableNameBoxGoto(params: UseTableNameBoxGotoParams): (text: string) => boolean {
  const { entity, onCommitPending } = params;

  return useCallback(
    (text: string): boolean => {
      if (!entity) return false;
      // Ο **ίδιος** απομνημονευμένος (WeakMap) δρόμος με τη γεωμετρία και τη γραμμή τύπων —
      // ίδιο persisted ⇒ ίδιο μοντέλο, καμία δεύτερη αποσειριοποίηση ανά πάτημα `Enter`.
      const target = parseTableNameBoxReference(resolveTableModel(activeTableModel(entity)), text);
      if (target === null) return false;

      onCommitPending();
      setTableCellCursor(entity, target.position, 'nav');
      // Μόνο όταν γράφτηκε εύρος: ένα σκέτο `B7` **δεν** μαρκάρει (§27.15, «καμία επιλογή ≠
      // επιλογή 1×1»). Το `setTableCellCursor` από πάνω έχει ήδη διαλύσει ό,τι υπήρχε.
      if (target.selection !== null) setTableCellSelection(target.selection);
      // Το `<input>`/`<textarea>` του κελιού ξαναστήνεται με καθαρό φρουρό δέσμευσης και
      // `autoFocus` — ο ΕΝΑΣ δρόμος επιστροφής του πληκτρολογίου στο πλέγμα, ο ίδιος που
      // περνά και το `handleBlur` της γραμμής τύπων όταν το κλικ πέφτει σε άλλο κελί.
      restartTableCellCursorSession();
      return true;
    },
    [entity, onCommitPending],
  );
}
