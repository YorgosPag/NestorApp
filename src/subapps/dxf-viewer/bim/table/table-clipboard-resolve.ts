/**
 * 🔴 ADR-739 §57 — **ΑΠΟ ΠΟΥ ΕΡΧΕΤΑΙ ΑΥΤΗ Η ΕΠΙΚΟΛΛΗΣΗ;** Ο ΕΝΑΣ κανόνας, καθαρός.
 *
 * Δέχεται τι λέει το πρόχειρο του **συστήματος**, τι κρατά το πρόχειρο της **εφαρμογής**, και τι
 * ζήτησε ο **χρήστης**. Απαντά με μία από πέντε **ρητές** καταστάσεις — καμία σιωπηλή προεπιλογή,
 * καμία περίπτωση όπου ο καλών πρέπει να μαντέψει τι σημαίνει `null`.
 *
 * ## 🔴 ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ `if` ΜΕΣΑ ΣΤΟΝ ΧΕΙΡΙΣΤΗ
 * Οι διαδρομές επικόλλησης είναι **τρεις**, όχι μία:
 * ```
 *   Ctrl+V           → ClipboardEvent, σύγχρονο, χωρίς άδεια   (use-table-range-actions)
 *   δεξί κλικ        → async Clipboard API                      (use-table-menu-clipboard)
 *   κουμπί κορδέλας  → async Clipboard API + «Επικόλληση Ειδική» (η ίδια, με request)
 * ```
 * Και οι τρεις κάνουν **την ίδια** ερώτηση. Γραμμένη τρεις φορές, θα ήταν το ακριβές σχήμα που
 * προειδοποιεί η κεφαλίδα του `use-table-paste-report.ts`: *«η μία διαδρομή θα μάθαινε κάποτε να
 * αναφέρει μια νέα απώλεια και η άλλη όχι — δηλαδή το ποντίκι σου έκρυψε αυτό που σου είπε το
 * πληκτρολόγιο»*. Εδώ το ανάλογο θα ήταν χειρότερο: το `Ctrl+V` θα επικολλούσε **γυμνές τιμές**
 * ενώ το κουμπί δίπλα του θα έφερνε τύπους και μορφή, από το **ίδιο** αντίγραφο.
 *
 * ## Το αποτύπωμα είναι το σήμα — όχι ρολόι, όχι ακροατής
 * Δες την κεφαλίδα του `table-clipboard-payload.ts`. Εδώ ο κανόνας είναι μία γραμμή:
 * `text === payload.text` ⇒ το πρόχειρο του συστήματος είναι **ακόμη το δικό μας**.
 *
 * @module subapps/dxf-viewer/bim/table/table-clipboard-resolve
 * @see bim/table/table-clipboard-payload.ts — τι είναι το αποτύπωμα
 * @see ui/table-cell-editor/use-table-paste-apply.ts — ο ΕΝΑΣ καταναλωτής των πέντε καταστάσεων
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §57
 */

import { clipboardTextToTableGrid } from './table-range-clipboard';
import type { TableClipboardPayload } from './table-clipboard-payload';
import type { TablePasteRequest } from './table-clipboard-paste';
import type { TsvGrid } from '@/lib/spreadsheet/tsv';

/**
 * Οι **πέντε** καταστάσεις. Κάθε μία έχει διαφορετική συνέπεια για τον χρήστη, γι' αυτό καμία
 * δεν συγχωνεύεται με άλλη: τρεις εφαρμόζουν κάτι, δύο εξηγούν γιατί δεν εφαρμόζεται τίποτα.
 */
export type TablePasteSource =
  /** Το φορτίο της εφαρμογής ισχύει — τύποι και μορφή ταξιδεύουν. */
  | {
      readonly kind: 'internal';
      readonly payload: TableClipboardPayload;
      /**
       * `true` όταν το πρόχειρο του συστήματος **δεν διαβάστηκε** (άρνηση άδειας, ανασφαλές
       * περιβάλλον, Firefox χωρίς χειρονομία επικόλλησης) και εμπιστευόμαστε το δικό μας φορτίο.
       *
       * 🔑 Είναι **η στιγμή που ο ΝΕΣΤΩΡ ξεπερνά το Google Sheets**, το οποίο εδώ απλώς αρνείται
       * («*these actions are unavailable via the edit menu*»). Αλλά **λέγεται**: ο χρήστης μπορεί
       * να έχει αντιγράψει κάτι άλλο στο μεταξύ και δεν έχουμε τρόπο να το ξέρουμε — μια σιωπηλή
       * επικόλληση «του τελευταίου που θυμάμαι» θα ήταν έκπληξη, όχι εξυπηρέτηση.
       */
      readonly blind: boolean;
    }
  /** Κείμενο από τον έξω κόσμο (Excel, σημειωματάριο) — μόνο τιμές, καμία μορφή. */
  | { readonly kind: 'external'; readonly grid: TsvGrid }
  /** Διαβάστηκε κείμενο, αλλά δεν περιέχει τίποτα επικολλήσιμο. */
  | { readonly kind: 'empty' }
  /** Ούτε πρόχειρο συστήματος, ούτε δικό μας φορτίο — δεν υπάρχει τίποτα να επικολληθεί. */
  | { readonly kind: 'denied' }
  /**
   * Ζητήθηκε **μόνο μορφοποίηση**, αλλά το πρόχειρο κρατά ξένο κείμενο.
   *
   * Ξεχωριστή κατάσταση και όχι «external»: η εξωτερική διαδρομή θα επικολλούσε **τιμές**, που
   * είναι ακριβώς ό,τι ο χρήστης ζήτησε να **μην** συμβεί. Ένα «Επικόλληση Μορφοποίησης» που
   * αντικαθιστά τα δεδομένα του στόχου είναι απώλεια, όχι παρανόηση.
   */
  | { readonly kind: 'needs-internal' };

/**
 * Ο κανόνας. `text === null` σημαίνει «το πρόχειρο του συστήματος **δεν διαβάστηκε**» — ποτέ
 * «είναι άδειο»: το δεύτερο είναι κενό αλφαριθμητικό και οδηγεί αλλού.
 */
export function resolveTablePasteSource(
  text: string | null,
  payload: TableClipboardPayload | null,
  request: TablePasteRequest,
): TablePasteSource {
  // 1. Το φορτίο μας, όταν το πρόχειρο του συστήματος **συμφωνεί** ότι είναι ακόμη δικό μας.
  if (payload !== null && text === payload.text) {
    return { kind: 'internal', payload, blind: false };
  }
  // 2. Δεν διαβάστηκε τίποτα. Το δικό μας φορτίο είναι ό,τι καλύτερο έχουμε — και το λέμε.
  if (text === null) {
    return payload === null ? { kind: 'denied' } : { kind: 'internal', payload, blind: true };
  }
  // 3. Ξένο κείμενο. Αν ζητήθηκε **αποκλειστικά** μορφή, δεν υπάρχει τίποτα να δώσει.
  if (request.content === 'none' && request.facets.size > 0) {
    return { kind: 'needs-internal' };
  }
  const grid = clipboardTextToTableGrid(text);
  return grid.length === 0 ? { kind: 'empty' } : { kind: 'external', grid };
}
