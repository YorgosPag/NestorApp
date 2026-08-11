'use client';

/**
 * 🔴 ADR-753 §28 — **ΠΟΙΟΣ ΓΡΑΦΕΙ ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ ΤΟΥ ΠΛΟΥΣΙΟΥ ΠΕΔΙΟΥ, ΚΑΙ ΠΟΤΕ.**
 *
 * ## Γιατί επιτακτικά και όχι με JSX παιδιά
 * Ένα `contenteditable` είναι το **μόνο** στοιχείο του DOM που ο **χρήστης** μεταβάλλει
 * κατευθείαν: πληκτρολογεί, και ο browser εισάγει χαρακτήρες μέσα στους κόμβους μας χωρίς να
 * περάσει από τον React. Ο συμβιβασμός των δύο («ελεγχόμενο» δέντρο πάνω σε DOM που αλλάζει
 * από κάτω) είναι το κλασικό σημείο όπου ο δρομέας πηδά στο τέλος σε κάθε πάτημα.
 *
 * Το ίδιο πρόβλημα το έχει λύσει ήδη αυτό το έργο, με την **ίδια** απάντηση, μία στρώση πιο
 * έξω: το `TextEditorAnchorLayer` αποδίδει το κουτί **μία** φορά και μετά το ενημερώνει
 * επιτακτικά σε κάθε tick (ADR-040). Εδώ ισχύει ό,τι κι εκεί — ο React γεννά το κουτί, οι
 * αλλαγές του περιεχομένου γίνονται με το χέρι.
 *
 * ## 🔴 Ο ΚΑΝΟΝΑΣ ΤΟΥ ΔΡΟΜΕΑ: διάβασε → γράψε → **επανάφερε**
 * Η ξαναγραφή του δέντρου καταστρέφει την επιλογή, γιατί οι κόμβοι στους οποίους δείχνει
 * παύουν να υπάρχουν. Η επιλογή όμως δεν είναι κόμβοι — είναι **δύο αριθμοί χαρακτήρων**, και
 * αυτοί επιβιώνουν κάθε ξαναγραφή. Άρα διαβάζονται πριν, ξαναδηλώνονται μετά, με τις **ίδιες**
 * πράξεις που χρησιμοποιεί όλη η υπόλοιπη συνεδρία (`table-text-field-ops`) — καμία δεύτερη
 * μηχανική δρομέα.
 *
 * Και γίνεται σε `useLayoutEffect`, για τον **ίδιο** λόγο που το κάνει το `useTableCellCaret`:
 * με `useEffect` υπάρχει ένα καρέ όπου ο χρήστης βλέπει τον δρομέα στο λάθος σημείο και, αν
 * πληκτρολογήσει μέσα σε αυτό, γράφει στο λάθος σημείο.
 *
 * ## 🔴 IME / ΕΛΛΗΝΙΚΟΙ ΤΟΝΟΙ: ΜΗΝ ΑΓΓΙΞΕΙΣ ΤΟ ΔΕΝΤΡΟ ΟΣΟ ΣΥΝΘΕΤΕΙ
 * Όσο διαρκεί μια σύνθεση (`compositionstart` → `compositionend`) ο browser κρατά **δικό του**
 * ενδιάμεσο κείμενο μέσα στον κόμβο και το αναθεωρεί σε κάθε πάτημα. Μια ξαναγραφή εκεί
 * ακυρώνει τη σύνθεση — δηλαδή σπάει ακριβώς ό,τι ο ADR-739 Φ.Δ βήμα 8 δηλώνει «κερδισμένο».
 * Ο συγχρονισμός αναβάλλεται· το `compositionend` γεννά `input`, άρα νέο πρόχειρο, άρα ο
 * επόμενος κύκλος τον κάνει ούτως ή άλλως.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-cell-rich-content
 * @see ui/table-cell-editor/table-cell-editor-spans.ts — **τι** πρέπει να δείχνει
 * @see ui/table-cell-editor/table-text-field-ops.ts — οι πράξεις επιλογής
 * @see docs/centralized-systems/reference/adrs/ADR-753-table-cell-rich-text.md §28
 */

import { useLayoutEffect, useRef, type RefObject } from 'react';
import {
  setTableTextFieldSelection,
  tableTextFieldSelection,
} from './table-text-field-ops';
import type { TableCellEditorSpan } from './table-cell-editor-spans';
import type { TableRichTextField } from '../components/table-text-menu/table-text-toolbar-types';

/**
 * Το **αποτύπωμα** ενός συνόλου τμημάτων: αν δεν άλλαξε, το DOM λέει ήδη ό,τι πρέπει.
 *
 * Είναι σκόπιμα το πλήρες περιεχόμενο (κείμενο **και** στυλ) και όχι μια σύνοψη: δύο
 * καταστάσεις με ίδιο αποτύπωμα πρέπει να είναι **η ίδια** κατάσταση, αλλιώς μια μορφοποίηση
 * που δεν αλλάζει το κείμενο (ακριβώς η περίπτωση του §16.5 — πατάς «κόκκινο») δεν θα
 * ζωγραφιζόταν ποτέ.
 */
function spansSignature(spans: readonly TableCellEditorSpan[]): string {
  return JSON.stringify(spans);
}

/** Το κείμενο που **θα έχει** το κουτί όταν γραφτούν αυτά τα τμήματα. */
function spansText(spans: readonly TableCellEditorSpan[]): string {
  let text = '';
  for (const span of spans) text += span.text;
  return text;
}

/** Ένα `span` του DOM με το στυλ του τμήματος. */
function buildSpan(span: TableCellEditorSpan): HTMLSpanElement {
  const el = document.createElement('span');
  Object.assign(el.style, span.style);
  // `textContent` και ποτέ `innerHTML`: το πρόχειρο είναι κείμενο του χρήστη, και μια
  // διαδρομή που το ερμηνεύει ως σήμανση είναι διαδρομή έγχυσης. Το `<` μέσα σε κελί
  // πίνακα σχεδίου είναι απολύτως συνηθισμένο (`<20mm`).
  el.textContent = span.text;
  return el;
}

/**
 * Κρατά το περιεχόμενο του πλούσιου πεδίου ίσο με τα {@link spans}, διατηρώντας τον δρομέα.
 *
 * @param composing `true` όσο βρίσκεται σε εξέλιξη σύνθεση IME — δες την κεφαλίδα.
 */
export function useTableCellRichContent(
  fieldRef: RefObject<TableRichTextField | null>,
  spans: readonly TableCellEditorSpan[],
  composing: RefObject<boolean>,
): void {
  const signature = spansSignature(spans);
  /**
   * Το αποτύπωμα που **γράφτηκε τελευταία φορά**, όχι αυτό που ζητήθηκε τελευταία φορά.
   *
   * Η διάκριση μετράει όταν ο συγχρονισμός αναβάλλεται λόγω σύνθεσης: αν καταγράφαμε το
   * ζητούμενο, ο επόμενος κύκλος θα το έβρισκε «ίδιο» και δεν θα έγραφε ποτέ.
   */
  const writtenRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field || composing.current) return;
    // Ο έλεγχος του **κειμένου** δίπλα στο αποτύπωμα δεν είναι πλεονασμός: ο browser γράφει
    // στο δέντρο χωρίς να περάσει από εδώ, οπότε το DOM μπορεί να έχει αποκλίνει ενώ τα
    // τμήματα που ζητούνται είναι ταυτόσημα με την προηγούμενη φορά (undo, επικόλληση που
    // ακυρώθηκε). Το αποτύπωμα μόνο του θα έλεγε «όλα εντάξει» πάνω σε λάθος οθόνη.
    if (writtenRef.current === signature && field.textContent === spansText(spans)) return;

    const selection = tableTextFieldSelection(field);
    field.replaceChildren(...spans.map(buildSpan));
    writtenRef.current = signature;
    // Η επαναφορά γίνεται **μόνο** όταν το πεδίο κατέχει το πληκτρολόγιο. Αλλιώς θα άρπαζε
    // την επιλογή του εγγράφου από εκεί όπου την πήγε ο χρήστης — και η μία περίπτωση όπου
    // αυτό συμβαίνει είναι ακριβώς η γραμμή εργαλείων, που έχει τη **δική** της επαναφορά
    // (`restoreTableTextSelection`) με την **παγωμένη** επιλογή, δηλαδή τη σωστή.
    if (document.activeElement === field) {
      setTableTextFieldSelection(field, selection.start, selection.end);
    }
  });
}
