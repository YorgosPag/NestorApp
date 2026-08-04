/**
 * ADR-754 — **τι κάνει το κλικ** αφού το `table-formula-point-state.ts` απάντησε τι σημαίνει.
 *
 * Δύο πράξεις, καμία γνώση: *εισαγωγή* όταν η γραμματική περιμένει τελεστέο, *αντικατάσταση*
 * όταν η προηγούμενη αναφορά είναι ακόμη ζωντανή. Ο διαχωρισμός δεν είναι κομψότητα — είναι
 * η συμπεριφορά που περιμένει ο χρήστης του Excel: κλικ, κλικ, κλικ χωρίς ενδιάμεσο τελεστή
 * **διορθώνει** την επιλογή, δεν συσσωρεύει `=E4E3E7`.
 *
 * ## Καθαρό επίτηδες
 * Μηδέν React, μηδέν DOM, μηδέν store: μπαίνει κείμενο και θέση δρομέα, βγαίνει κείμενο και
 * θέση δρομέα. Ο λόγος είναι ότι οι **δύο** επεξεργαστές του πίνακα — το κελί και η γραμμή
 * τύπων — οφείλουν να συμπεριφέρονται ίδια· ο,τιδήποτε εδώ ήξερε από `<textarea>` θα
 * ανάγκαζε τον δεύτερο να ξαναγράψει τον κανόνα (N.18, το ίδιο δίδυμο που ο ADR-739 §15
 * ονομάζει «τέταρτη μηχανή πίνακα»).
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-reference-edit
 * @see table-formula-point-state.ts — η ερώτηση που προηγείται
 * @see ../table-cell-reference.ts — η **μία** μετάφραση ταυτότητας → `E4`
 * @see docs/centralized-systems/reference/adrs/ADR-754-table-point-mode.md §2
 */

import type { TableModel } from '../../../types/table';
import {
  tableCellReference,
  tableRangeReference,
  type TableCellAddress,
} from '../table-cell-reference';
import type { FormulaPointState } from './table-formula-point-state';

/** Το κείμενο του επεξεργαστή μετά την υπόδειξη, μαζί με το πού πρέπει να πάει ο δρομέας. */
export interface PointedReferenceEdit {
  readonly draft: string;
  /** **Μετά** την αναφορά που μόλις μπήκε — ώστε ο επόμενος τελεστής να γράφεται κατευθείαν. */
  readonly caretIndex: number;
}

/**
 * Το κείμενο μιας αναφοράς προς **ένα** κελί, όπως πρέπει να μπει σε τύπο.
 *
 * 🔑 Επιστρέφει την **άγκυρα** (`B3`) και όχι το εύρος συγχώνευσης (`B3:C4`) που δείχνει η
 * γραμμή τύπων: μια συγχώνευση κρατά **ένα** περιεχόμενο, στην άγκυρα. Ένα `=B3:C4` θα
 * ήταν εύρος τεσσάρων κελιών εκ των οποίων τρία άδεια — δηλαδή ο μέσος όρος θα άλλαζε
 * επειδή ο χρήστης έτυχε να κάνει κλικ σε συγχωνευμένο κελί.
 */
export function pointedCellReference(model: TableModel, cell: TableCellAddress): string | null {
  return tableCellReference(model, cell.rowId, cell.colId)?.anchorA1 ?? null;
}

/**
 * Το κείμενο μιας αναφοράς προς **ορθογώνιο** (σύρσιμο): `'A1:B5'`, ή σκέτο `'A1'` όταν το
 * σύρσιμο δεν βγήκε από το κελί εκκίνησης.
 */
export function pointedRangeReference(
  model: TableModel,
  from: TableCellAddress,
  to: TableCellAddress,
): string | null {
  return tableRangeReference(model, from, to);
}

/**
 * Η μία μεταβολή κειμένου. `null` όταν η κατάσταση είναι `off` — δηλαδή όταν το κλικ **δεν**
 * ανήκει στην υπόδειξη και ο καλών οφείλει να αφήσει τη σημερινή συμπεριφορά να τρέξει.
 *
 * Το `null` είναι σημασιολογικό, όχι σφάλμα: η άρνηση εδώ **είναι** η απόφαση «αυτό το κλικ
 * σημαίνει δέσμευση και μετακίνηση», και ο φρουρός του δείκτη τη διαβάζει έτσι.
 */
export function applyPointedReference(
  draft: string,
  state: FormulaPointState,
  reference: string,
): PointedReferenceEdit | null {
  if (state.kind === 'off') return null;

  const from = state.kind === 'armed' ? state.at : state.from;
  const to = state.kind === 'armed' ? state.at : state.to;

  return {
    draft: draft.slice(0, from) + reference + draft.slice(to),
    caretIndex: from + reference.length,
  };
}
