/**
 * ADR-739 §49 — **η εξήγηση**: γιατί ο χρήστης δεν βρήκε τη συνάρτηση που πληκτρολόγησε.
 * Καθαρή συνάρτηση· μηδέν React, μηδέν i18n (το κείμενο ανήκει στον καταναλωτή).
 *
 * ## Το πρόβλημα που λύνει
 * Η αποθηκευμένη τιμή για `=TODAY()` είναι `#NAME?` — **σωστά**: αυτό ακριβώς γράφει το Excel
 * για συνάρτηση που δεν υπάρχει, και είναι κωδικός που ταξιδεύει σε DXF, σε πρόχειρο και σε
 * εκτύπωση χωρίς να ξενίζει κανέναν. Ένας επινοημένος κωδικός (`#VOLATILE!`) θα φαινόταν
 * **ξένη λέξη μέσα σε παραδοτέο** όταν το αρχείο ανοίξει σε AutoCAD ή Excel.
 *
 * Αλλά το `#NAME?` μόνο του λέει «δεν την ξέρω», που ο χρήστης διαβάζει ως «δεν την
 * υλοποιήσαμε» — και ξαναδοκιμάζει. Η αλήθεια είναι διαφορετική και είναι **απόφαση**: η
 * συνάρτηση αποκλείστηκε επίτηδες, και υπάρχει λόγος. Το αρχείο μένει πιστό στο Excel, ο
 * άνθρωπος παίρνει τον λόγο — σε δύο διαφορετικά επίπεδα, χωρίς να συγκρούονται.
 *
 * ## Χρησιμοποιεί τον ΕΝΑΝ λεξικογράφο
 * Ένας «ελαφρύς» σαρωτής ονομάτων εδώ θα ήταν δεύτερη γραμματική που αποκλίνει την πρώτη φορά
 * που η πρώτη αλλάξει — ακριβώς αυτό που απαγορεύει η κεφαλίδα του `table-formula-lex.ts`.
 *
 * @module subapps/dxf-viewer/bim/table/formula/library/formula-library-hint
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §49
 */

import { formulaBodyStart, tokenizeFormula } from '../table-formula-lex';
import { EXPLAINED_REFUSAL_BY_EXCEL_NAME } from './formula-library-manifest';
import type { FormulaLibraryRejection } from './formula-library-taxonomy';

/** Η **πρώτη** αποκλεισμένη συνάρτηση που περιέχει ένα πρόχειρο, με τον λόγο αποκλεισμού. */
export interface FormulaRefusalHint {
  /** Το όνομα όπως το αναγνωρίζει το μητρώο (κεφαλαία). */
  readonly name: string;
  readonly reason: FormulaLibraryRejection;
}

/**
 * Η εξήγηση για ένα πρόχειρο κελιού, ή `null` όταν δεν χρειάζεται καμία.
 *
 * Επιστρέφει την **πρώτη** που βρίσκει και όχι όλες: ο χρήστης διορθώνει μία τη φορά, και μια
 * λίστα εξηγήσεων πάνω από τη γραμμή τύπων θα ήταν θόρυβος τη στιγμή που πληκτρολογεί.
 */
export function findFormulaRefusal(draft: string): FormulaRefusalHint | null {
  const bodyStart = formulaBodyStart(draft);
  if (bodyStart === null) return null;

  const tokens = tokenizeFormula(draft.slice(bodyStart));
  if (tokens === null) return null;

  for (let at = 0; at < tokens.length - 1; at += 1) {
    const token = tokens[at];
    const next = tokens[at + 1];
    // Όνομα **ακολουθούμενο από παρένθεση** είναι κλήση· χωρίς αυτήν είναι διεύθυνση κελιού,
    // και μια στήλη με ταυτότητα `NOW` δεν έχει καμία σχέση με τη συνάρτηση `NOW()`.
    if (token.kind !== 'name' || next.kind !== 'punct' || next.value !== '(') continue;

    const name = token.value.toUpperCase();
    const reason = EXPLAINED_REFUSAL_BY_EXCEL_NAME.get(name);
    if (reason !== undefined) return { name, reason };
  }
  return null;
}
