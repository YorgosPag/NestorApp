/**
 * 🔴 ADR-764 — **ζει ακόμη αυτή η ταυτότητα;** και **τι αξίζει τώρα;** Δύο ερωτήσεις, ένα
 * σπίτι, καμία δεύτερη απάντηση. Καθαρές συναρτήσεις: μηδέν React, μηδέν DOM, μηδέν store.
 *
 * ## Η ερώτηση που γέννησε το αρχείο
 * Ο χάρτης κελιών είναι **αραιός** (`table-model-helpers.ts`): απόν κελί σημαίνει **κενό**.
 * Άρα το `getCell(...)?.value ?? ''` απαντούσε το ίδιο πράγμα σε δύο τελείως διαφορετικές
 * καταστάσεις — «αυτό το κελί είναι άδειο» και «αυτή η γραμμή δεν υπάρχει πια». Μετρημένο:
 * μετά τη διαγραφή της γραμμής 3, το `=CONCATENATE(A2;" ";A3)` θα έδινε `«20 »` αντί για
 * `#REF!`. Δηλαδή **φρέσκο λάθος νούμερο** — που είναι χειρότερο από μπαγιάτικο, γιατί
 * μοιάζει υπολογισμένο.
 *
 * ## 🔑 Γιατί εδώ και όχι στο `getCell`
 * Το `getCell` είναι **αποθήκευση**, και για την αποθήκευση «απόν ≡ κενό» είναι το ίδιο το
 * σχήμα (δες `setPersistedCellText`, τέταρτη εγγύηση). Πάνω από 40 καλούντες το θεωρούν
 * δεδομένο. Η ερώτηση «τι αξίζει αυτή η **αναφορά**;» ανήκει στον αξιολογητή — στην ίδια ραφή
 * που αποφασίζει ήδη «φρέσκο αποτέλεσμα ή αποθηκευμένη τιμή».
 *
 * ## Ο εκτυπωτής και ο αξιολογητής ρωτούν ΤΟ ΙΔΙΟ κατηγόρημα
 * Ο εκτυπωτής έλυνε ήδη τη νεκρή ταυτότητα σε `#REF!`, με **δικό του** κριτήριο (κενό γράμμα
 * στήλης / μηδενικός αριθμός γραμμής). Δύο ανεξάρτητοι ορισμοί του «υπάρχει» είναι δύο
 * ευκαιρίες να διαφωνήσουν — και η μέρα που θα διαφωνούσαν θα ήταν η μέρα που η γραμμή τύπων
 * γράφει `#REF!` ενώ το κελί δείχνει αριθμό, δηλαδή **το σφάλμα του ADR-764 ανάποδα**.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-ref-scope
 * @see bim/table/formula/table-formula-recalc.ts — ο ένας καταναλωτής: ο επαναϋπολογισμός
 * @see bim/table/formula/table-formula-print.ts — ο άλλος: η γραμμή τύπων
 * @see docs/centralized-systems/reference/adrs/ADR-764-structural-ops-formula-recalc.md §2
 */

import type { TableModel } from '../../../types/table';
import type { TableFormulaCellRef } from '../../../types/table-formula';
import { getCell, indexById } from '../table-model-helpers';
import { FORMULA_ERROR, type TableFormulaValue } from './table-formula-value';

/**
 * `true` όταν **και οι δύο** ταυτότητες της αναφοράς υπάρχουν ακόμη στο πλέγμα.
 *
 * Ρωτά το `indexById` — τον **φθηνό** τρόπο (WeakMap ανά πίνακα, ADR-739 §36), τον ίδιο που
 * χρησιμοποιεί ήδη το `expandRangeShape`. Καμία σάρωση, καμία δεύτερη δομή.
 */
export function isLiveCellRef(model: TableModel, ref: TableFormulaCellRef): boolean {
  return indexById(model.rows).has(ref.rowId) && indexById(model.columns).has(ref.colId);
}

/**
 * Η τιμή μιας αναφοράς **όπως τη βλέπει ο αξιολογητής**: `#REF!` για ταυτότητα που έσβησε,
 * αλλιώς η αποθηκευμένη τιμή — και `''` για κελί που απλώς είναι κενό.
 *
 * Η διάκριση των δύο `undefined` γίνεται **εδώ και μόνο εδώ**. Ο κωδικός επιστρέφεται ως
 * **τιμή**, όχι ως εξαίρεση: από εκεί και πέρα τον διαδίδει ο υπάρχων μηχανισμός
 * (`firstError` / `isFormulaError`), οπότε ένα `=B1*2` πάνω σε `#REF!` δίνει `#REF!` και όχι
 * `0` — χωρίς να χρειαστεί ούτε μία γραμμή σε καμία συνάρτηση.
 */
export function readCellRefValue(model: TableModel, ref: TableFormulaCellRef): TableFormulaValue {
  if (!isLiveCellRef(model, ref)) return FORMULA_ERROR.reference;
  // Κελί που δεν υπάρχει στον αραιό χάρτη **είναι** κενό — δες `setPersistedCellText`.
  return getCell(model, ref.rowId, ref.colId)?.value ?? '';
}
