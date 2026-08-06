'use client';

/**
 * 🔴 ADR-763 Φ2.4.1 — **ο ΕΝΑΣ εξυπηρετητής του «δέσμευσε και βγες»**.
 *
 * Ο δρομέας κρατά ένα αύξον αίτημα ({@link TableCellCursorState.commitRequest}) που το γράφει
 * όποιος **δεν μπορεί** να δεσμεύσει μόνος του — σήμερα το «OK» του διαλόγου ορισμάτων, που
 * ζει σε portal και δεν έχει ούτε σκηνή ούτε δίαυλο εντολών. Εδώ το αίτημα γίνεται πράξη,
 * μέσα από την **ίδια** διαδρομή που χρησιμοποιεί το `Enter`.
 *
 * ## Γιατί δικό του module και όχι δέκα γραμμές στον οδηγό
 * Ο `useTableCellDoubleClickEditor` είναι στις **474** γραμμές (N.7.1: 500) και έχει ήδη
 * εξάγει τέσσερα κομμάτια για τον ίδιο λόγο. Και το όριο δεν είναι το μόνο: εδώ ζει μια
 * **ερώτηση με δική της απάντηση** — «ποιο αίτημα έχω ήδη εξυπηρετήσει;» — που δεν αφορά
 * κανένα από τα υπόλοιπα του οδηγού.
 *
 * ## 🔴 Γιατί ΜΕΤΡΗΤΗΣ και όχι σημαία που «καταναλώνεται»
 * Μια σημαία `pendingCommit: boolean` θα έπρεπε να σβηστεί από τον εξυπηρετητή — δηλαδή
 * **δεύτερη γραφή στο store μέσα σε effect**, που ξαναπυροδοτεί τον ίδιο effect. Με αύξοντα
 * αριθμό, ο εξυπηρετητής θυμάται **τι είδε** και η απάντηση «το εξυπηρέτησα;» είναι σύγκριση,
 * όχι κατάσταση προς καθαρισμό. Ίδιο σχήμα με το `caretRevision` (ADR-754 §4), και για τον
 * ίδιο λόγο: **γεγονός**, όχι τιμή.
 *
 * ## Η σειρά ΕΙΝΑΙ το συμβόλαιο
 * Πρώτα η δέσμευση, μετά το κλείσιμο της συνεδρίας — ακριβώς όπως στο `case 'move'` του
 * πληκτρολογίου («πρώτα δεσμεύεται το πρόχειρο, μετά μετακινείται ο δρομέας»). Ανάποδα, το
 * `cancelTableCellCursorSession` θα είχε ήδη **σβήσει το πρόχειρο** και η δέσμευση θα έγραφε
 * κενό — δηλαδή το «OK» θα **άδειαζε** το κελί που μόλις γέμισε.
 *
 * ⚠️ **Το `cancelTableCellCursorSession` εδώ ΔΕΝ ακυρώνει τίποτα.** Είναι ο ΕΝΑΣ τρόπος να
 * κλείσει μια συνεδρία γραφής στο **ίδιο** κελί (`nav` + καθαρό πρόχειρο + νέο `sessionId` ⇒
 * το `<textarea>` ξεφορτώνεται). Ό,τι θα «ακύρωνε» έχει ήδη γραφτεί, μία γραμμή πιο πάνω. Ένα
 * δεύτερο, «δικό μας» κλείσιμο θα ήταν τρίτος ορισμός του τι σημαίνει «έληξε η γραφή».
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-cell-commit-request
 * @see state/table-cell-cursor-store.ts — το σήμα και ο λόγος που είναι σήμα
 * @see ui/dialogs/TableFunctionArgumentsDialog.tsx — ο μοναδικός αιτών σήμερα
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §21.6
 */

import { useEffect, useRef } from 'react';
import { cancelTableCellCursorSession } from '../../state/table-cell-cursor-store';
import type { TableCellCursorState } from '../../state/table-cell-cursor-store';

/**
 * Εξυπηρετεί κάθε **νέο** αίτημα δέσμευσης του δρομέα.
 *
 * @param cursor ο ζωντανός δρομέας· `null` όταν δεν υπάρχει συνεδρία
 * @param commitText ο **ΕΝΑΣ** δεσμευτής κειμένου κελιού — ο ίδιος που καλεί το `Enter`
 */
export function useTableCellCommitRequest(
  cursor: TableCellCursorState | null,
  commitText: (nextText: string) => void,
): void {
  /**
   * Ο τελευταίος αριθμός που εξυπηρετήθηκε.
   *
   * Ξεκινά από `null` και **συγχρονίζεται με το πρώτο μοντάρισμα**: ένας δρομέας που υπάρχει
   * ήδη μπορεί να κουβαλά αίτημα από **προηγούμενη** συνεδρία, και μια αφετηρία `0` θα το
   * ξαναεκτελούσε — δηλαδή το ξαναστήσιμο του πίνακα θα δέσμευε κελί που κανείς δεν ζήτησε.
   */
  const served = useRef<number | null>(null);

  useEffect(() => {
    if (!cursor) return;
    if (served.current === null) {
      served.current = cursor.commitRequest;
      return;
    }
    if (cursor.commitRequest === served.current) return;
    served.current = cursor.commitRequest;
    // Η σειρά είναι το συμβόλαιο — δες την κεφαλίδα.
    commitText(cursor.draft);
    cancelTableCellCursorSession();
  }, [cursor, commitText]);
}
