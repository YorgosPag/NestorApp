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
  RANGE_SEPARATOR,
  tableCellReference,
  tableRangeReference,
  type TableCellAddress,
} from '../table-cell-reference';
import {
  cycleAbsoluteReference,
  rewriteAbsoluteReference,
  splitAbsoluteReference,
} from './table-formula-absolute';
import type { FormulaPointState } from './table-formula-point-state';
import { tableFormulaReferenceSpans } from './table-formula-reference-spans';

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

/**
 * 🔴 ADR-754 **Γ3** — **το `F4`**: κλειδώνει και ξεκλειδώνει την αναφορά όπου κάθεται ο
 * δρομέας, κυκλικά (`A1` → `$A$1` → `A$1` → `$A1` → `A1`).
 *
 * `null` όταν ο δρομέας δεν βρίσκεται πάνω σε αναφορά — και τότε ο καλών οφείλει να **μην
 * καταναλώσει** το πλήκτρο, ώστε το `F4` να συνεχίσει να σημαίνει ό,τι σήμαινε αλλού.
 *
 * ## 🔑 Ποια αναφορά «είναι» του δρομέα — και γιατί ΔΕΝ γράφτηκε νέος σαρωτής
 * Η ερώτηση «ποιες αναφορές περιέχει αυτό το κείμενο, και πού ακριβώς;» έχει **ήδη**
 * απάντηση: το `tableFormulaReferenceSpans` της Φάσης Β1, που τη δίνει με `start`/`end` σε
 * δείκτες του **πλήρους** προχείρου — δηλαδή στο σύστημα συντεταγμένων του `selectionStart`.
 * Γράφτηκε για τα χρωματιστά περιγράμματα και τα offsets ήταν «δώρο για το Β2»· εδώ
 * αποδεικνύεται ότι ήταν η **σωστή** μονάδα, γιατί ένα εύρος (`A1:B5`) επιστρέφεται ως **μία**
 * εγγραφή — και το `F4` οφείλει να το κλειδώσει **ολόκληρο**, όπως το Excel.
 *
 * Ένας δεύτερος «ελαφρύς» σαρωτής εδώ θα ήταν τρίτη γραμματική (N.18) και θα διαφωνούσε με τα
 * περιγράμματα που βλέπει ο χρήστης: θα κλείδωνε αναφορά **άλλη** από εκείνη που είναι
 * φωτισμένη μπροστά του.
 *
 * ## Ο δρομέας «πάνω» σημαίνει ΚΑΙ στο δεξί άκρο
 * Μόλις πληκτρολογηθεί ή μπει με υπόδειξη μια αναφορά, ο δρομέας κάθεται **αμέσως μετά** από
 * αυτήν (§4). Αν το `F4` απαιτούσε αυστηρά «μέσα», η συνηθέστερη χρήση όλων — γράφω `=A1` και
 * πατώ `F4` — δεν θα δούλευε. Γι' αυτό το διάστημα είναι **κλειστό** και στα δύο άκρα.
 */
export function toggleFormulaReferenceAbsolute(
  model: TableModel,
  draft: string,
  caretIndex: number,
): PointedReferenceEdit | null {
  const span = tableFormulaReferenceSpans(model, draft).find(
    (candidate) => caretIndex >= candidate.start && caretIndex <= candidate.end,
  );
  if (!span) return null;

  const rewritten = cycleReferenceText(draft.slice(span.start, span.end));
  if (rewritten === null) return null;

  return {
    draft: draft.slice(0, span.start) + rewritten + draft.slice(span.end),
    // Ο δρομέας μένει **στο τέλος** της αναφοράς: το μήκος της αλλάζει σε κάθε πάτημα, οπότε
    // μια «διατήρηση της θέσης» θα τον έριχνε άλλοτε μέσα στα δολάρια και άλλοτε έξω από τη
    // λέξη. Στο τέλος είναι η μία θέση που σημαίνει το ίδιο πράγμα και στις τέσσερις μορφές —
    // και είναι εκεί που ο χρήστης συνεχίζει να γράφει.
    caretIndex: span.start + rewritten.length,
  };
}

/**
 * Το κείμενο μιας αναφοράς με τα δολάρια στην **επόμενη** μορφή του κύκλου. `null` όταν δεν
 * είναι διεύθυνση.
 *
 * ⚠️ Ένα **εύρος** αλλάζει ως **ένα**: η μορφή διαβάζεται από το πρώτο άκρο και εφαρμόζεται σε
 * όλα. Έτσι το `F4` πάνω σε `A1:B5` δίνει `$A$1:$B$5` — ποτέ μισοκλειδωμένο εύρος, που θα
 * ήταν κατάσταση αδύνατη να παραχθεί με τα ίδια πατήματα στο Excel.
 */
function cycleReferenceText(text: string): string | null {
  const parts = text.split(RANGE_SEPARATOR);
  const head = splitAbsoluteReference(parts[0]);
  if (head === null) return null;

  const next = cycleAbsoluteReference(head);
  const rewritten = parts.map((part) => rewriteAbsoluteReference(part, next));
  return rewritten.every((part): part is string => part !== null)
    ? rewritten.join(RANGE_SEPARATOR)
    : null;
}
