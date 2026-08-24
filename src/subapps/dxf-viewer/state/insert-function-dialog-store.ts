'use client';

/**
 * ADR-763 §8 — **η χειραψία του διαλόγου «Εισαγωγή συνάρτησης»**: ανοιχτός/κλειστός, και η
 * **θέση κέρσορα τη στιγμή του ανοίγματος**.
 *
 * ## 🔴 Γιατί ο κέρσορας ταξιδεύει ΜΕΣΑ στην κατάσταση του διαλόγου
 * Η θέση του κέρσορα δεν είναι state — την κατέχει το DOM, και ο ADR-754 §3 το τεκμηριώνει
 * ρητά: ρωτιέται **τη στιγμή του συμβάντος** με `activeTableCellSessionCaret()`, ποτέ με
 * στιγμιότυπο. Εδώ όμως συμβαίνει το ένα πράγμα που ακυρώνει αυτόν τον κανόνα: **ο διάλογος
 * παίρνει ο ίδιος την εστίαση**. Τη στιγμή που πατιέται το «OK», ο εστιασμένος είναι το πεδίο
 * αναζήτησης του διαλόγου — η ερώτηση «πού είναι ο κέρσορας του τύπου;» δεν έχει πια απάντηση
 * στο DOM.
 *
 * Άρα η μόνη στιγμή που η απάντηση υπάρχει είναι το **κλικ στο `fx`**, και μαζεύεται εκεί.
 * Δεν είναι εξαίρεση στον κανόνα του §754: είναι ο ίδιος κανόνας — ανάγνωση **τη στιγμή του
 * συμβάντος** — απλώς το συμβάν είναι το άνοιγμα και όχι η δέσμευση.
 *
 * ⚠️ Το `undefined` είναι έγκυρη τιμή και σημαίνει «κανένα πεδίο της συνεδρίας δεν είχε την
 * εστίαση» (π.χ. το `fx` πατήθηκε σε λειτουργία πλοήγησης). Ο καταναλωτής το διαβάζει ως
 * «τέλος του προχείρου» — δες `insertFunctionCall`.
 *
 * @module subapps/dxf-viewer/state/insert-function-dialog-store
 * @see bim/table/formula/catalog/formula-insert-text.ts — τι γίνεται με αυτόν τον δείκτη
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §8
 */

import { createExternalStore } from '../stores/createExternalStore';

export interface InsertFunctionDialogState {
  readonly open: boolean;
  /** Πού ήταν ο κέρσορας όταν άνοιξε ο διάλογος· `undefined` = τέλος του προχείρου. */
  readonly caretIndex: number | undefined;
}

const CLOSED: InsertFunctionDialogState = { open: false, caretIndex: undefined };

const store = createExternalStore<InsertFunctionDialogState>(CLOSED);

/** Η κατάσταση τη στιγμή της κλήσης — και το snapshot του server (πάντα κλειστός). */
export function getInsertFunctionDialogState(): InsertFunctionDialogState {
  return store.get();
}

export function subscribeInsertFunctionDialog(listener: () => void): () => void {
  return store.subscribe(listener);
}

/**
 * Άνοιξε τον διάλογο, κρατώντας τη θέση κέρσορα του **τρέχοντος** πεδίου συνεδρίας.
 *
 * Ιδεμποτής: δεύτερο άνοιγμα ενώ είναι ήδη ανοιχτός δεν ξαναγράφει τον δείκτη — αλλιώς ένα
 * διπλό κλικ στο `fx` θα κατέγραφε τη θέση κέρσορα του **πεδίου αναζήτησης του διαλόγου**.
 */
export function openInsertFunctionDialog(caretIndex: number | undefined): void {
  if (store.get().open) return;
  store.set({ open: true, caretIndex });
}

export function closeInsertFunctionDialog(): void {
  if (!store.get().open) return;
  store.set(CLOSED);
}

// ADR-700 §4 (2026-08-24): test helper ΧΩΡΙΣ ΚΑΝΕΝΑ test — διαγράφηκε (ίδιο σχήμα με
// ADR-364 §10.5). Speculative: γράφτηκε «ίδιο μοτίβο με τα αδελφά stores», ποτέ δεν κλήθηκε.
