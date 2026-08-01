'use client';

/**
 * ADR-739 Φ.Δ βήμα 7 — **η ΜΙΑ καλωδίωση** της σημασιολογίας πλήκτρων σε πεδίο συνεδρίας
 * κελιού.
 *
 * ## Γιατί υπάρχει
 * Η σημασιολογία («ποιο πλήκτρο τι σημαίνει») ζει ήδη σε ένα σημείο:
 * {@link resolveTableCellKeyIntent}, καθαρή συνάρτηση, δοκιμασμένη σαν πίνακας
 * προδιαγραφής. Αυτό που **δεν** ζούσε σε ένα σημείο ήταν η **εκτέλεσή** της: το
 * `switch (intent.kind)` με τα `preventDefault` και τη σειρά «πρώτα commit, μετά move».
 * Μέχρι το βήμα 6 υπήρχε ένας καταναλωτής, οπότε ζούσε μέσα του.
 *
 * Το βήμα 7 προσθέτει **δεύτερο** πεδίο κειμένου στην ίδια συνεδρία (τη γραμμή τύπων). Ένα
 * αντιγραμμένο `switch` 30 γραμμών θα ήταν ακριβώς το sibling clone που πιάνει το CHECK
 * 3.28 (jscpd, N.18) — και, χειρότερα, ένα σημείο όπου η σειρά commit/move θα μπορούσε να
 * αποκλίνει σιωπηλά ανάμεσα στα δύο πεδία. Η σειρά **είναι** το συμβόλαιο: αντίστροφα, το
 * κείμενο γράφεται στο **επόμενο** κελί.
 *
 * ## Τι μένει έξω
 * Η **τιμή** και ο κύκλος ζωής της (πρόχειρο, φρουρός «μία φορά», escape-bus): αυτά ανήκουν
 * στον καταναλωτή. Το κελί έχει φρουρό μέσω `useInlineEditorKeys`· η γραμμή τύπων δεν
 * χρειάζεται δικό της, γιατί το commit είναι ιδεμποτές στο **μοντέλο**
 * (`buildTableCellEditCommand` επιστρέφει `null` όταν δεν άλλαξε τίποτα).
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-cell-session-keys
 * @see ui/table-cell-editor/table-cell-key-intent.ts — Η ΣΗΜΑΣΙΟΛΟΓΙΑ (καθαρή)
 */

import { useCallback, type KeyboardEvent } from 'react';
import { resolveTableCellKeyIntent } from './table-cell-key-intent';
import { setTableCellCursorMode, type TableCellCursorMode } from '../../state/table-cell-cursor-store';
import type { TableCursorMove } from '../../bim/table/table-cell-navigation';

export interface TableCellSessionKeyParams {
  readonly mode: TableCellCursorMode;
  /** Το **δεσμευμένο** κείμενο του κελιού — ο σπόρος του προχείρου όταν το `F2` ανοίγει γραφή. */
  readonly initialText: string;
  /** Δέσμευσε ό,τι γράφτηκε. Καλείται **πριν** από κάθε μετακίνηση — δες την κεφαλίδα. */
  readonly commit: () => void;
  readonly onMove: (move: TableCursorMove) => void;
  readonly onClear: () => void;
  readonly onHistory: (direction: 'undo' | 'redo') => void;
  /**
   * Τι γίνεται με ό,τι κανείς δεν διεκδίκησε. Απόν ⇒ τίποτα, που είναι το σωστό για ένα
   * πεδίο χωρίς δικό του κύκλο δέσμευσης: το συμβάν συνεχίζει τον φυσικό του δρόμο.
   */
  readonly onPassthrough?: (event: KeyboardEvent<HTMLElement>) => void;
}

/** Ο χειριστής `onKeyDown` κάθε πεδίου της συνεδρίας. */
export function useTableCellSessionKeys(
  params: TableCellSessionKeyParams,
): (event: KeyboardEvent<HTMLElement>) => void {
  const { mode, initialText, commit, onMove, onClear, onHistory, onPassthrough } = params;

  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const intent = resolveTableCellKeyIntent(event.key, event, mode);
      switch (intent.kind) {
        case 'move':
          event.preventDefault();
          // 🔴 Η σειρά είναι το συμβόλαιο: **πρώτα** δεσμεύεται το πρόχειρο, **μετά**
          // μετακινείται ο δρομέας. Αντίστροφα, το κείμενο θα γραφόταν στο νέο κελί.
          commit();
          onMove(intent.move);
          return;
        case 'mode':
          event.preventDefault();
          // `F2` από πλοήγηση: το πρόχειρο γεννιέται ΤΩΡΑ από το δεσμευμένο κείμενο του
          // κελιού· από γραφή αλλάζει μόνο ποιος κατέχει τα βέλη (το «διπλό F2» του Excel).
          setTableCellCursorMode(intent.to, mode === 'nav' ? initialText : undefined);
          return;
        case 'clear':
          event.preventDefault();
          onClear();
          return;
        case 'history':
          // `preventDefault` απαραίτητο: χωρίς αυτό ο browser θα έτρεχε **και** το δικό του
          // undo πάνω στο πεδίο — δύο ενέργειες για ένα πάτημα.
          event.preventDefault();
          onHistory(intent.direction);
          return;
        case 'suppress':
          // Πλήκτρο που το `<textarea>` **θα** εκτελούσε και δεν πρέπει (σήμερα: `Alt+Enter`).
          event.preventDefault();
          return;
        case 'passthrough':
          onPassthrough?.(event);
      }
    },
    [mode, initialText, commit, onMove, onClear, onHistory, onPassthrough],
  );
}
