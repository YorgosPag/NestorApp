/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 2) — **το λεξιλόγιο της μεταφοράς περιοχής**. Καθαρό type module:
 * μηδέν runtime, μηδέν λογική.
 *
 * Ζει χωριστά για τον ίδιο λόγο με το `table-layout-types.ts`: το σχέδιο γεννιέται σε **δύο**
 * αρχεία — τη σκέτη απόθεση (`table-range-transfer-plan.ts`) και την ολίσθηση
 * (`table-range-shift-plan.ts`) — και το καταναλώνει ένα τρίτο (`table-range-transfer.ts`).
 * Αν το λεξιλόγιο ζούσε σε ένα από τα τρία, τα άλλα δύο θα εισήγαγαν **από** αυτό ενώ εκείνο θα
 * εισήγαγε από αυτά: **κύκλος εισαγωγών** που θα δούλευε (η ESM ανυψώνει τις δηλώσεις) και
 * γι' αυτό ακριβώς θα ήταν επικίνδυνος — η προειδοποίηση είναι ήδη γραμμένη στην κεφαλίδα του
 * `table-cell-content.ts`.
 *
 * @module subapps/dxf-viewer/bim/table/table-range-transfer-types
 * @see bim/table/table-range-transfer-plan.ts — ποιος τα παράγει
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36
 */

import type { CellSpan } from '../../types/table';
import type { TableCellRangeBounds, TableCellRef } from './table-cell-range';
import type { TableRangeDragIntent } from './table-range-move-zone';
import type { TableRangeShiftAxis } from './table-range-axis-view';

/**
 * Τι μπαίνει σε **ένα** κελί που αγγίζει η πράξη.
 *
 * `from === null` σημαίνει «αδειάζει» — και είναι **ρητή** κατάσταση, όχι απουσία εγγραφής: το
 * κελί που έμεινε πίσω από μια μετακίνηση **πρέπει** να καθαριστεί, και η σιωπή θα το άφηνε
 * διπλό.
 */
export interface TableCellFill {
  readonly at: TableCellRef;
  readonly from: TableCellRef | null;
}

/** Γιατί **δεν** γίνεται — κλειδιά, ποτέ ετικέτες (N.11· τα μηνύματα ανήκουν στη Φάση 4). */
export type TableRangeTransferRefusal =
  /** Η επιλογή ή ο προορισμός δείχνουν σε γραμμή/στήλη που δεν υπάρχει (μπαγιάτικα, μετά από undo). */
  | 'stale-range'
  /** Η περιοχή δεν προσγειώνεται **ακέραιη**: ο πίνακας δεν μεγαλώνει μόνος του. */
  | 'outside-grid'
  /** Ο προορισμός ταυτίζεται με την πηγή — καμία εντολή, κανένα βήμα undo για το τίποτα. */
  | 'no-movement'
  /** Ο στόχος τέμνει συγχώνευση που δεν ταξιδεύει μαζί (Excel: *«We can't do that to a merged cell»*). */
  | 'merged-target';

/** Η χειρονομία, όπως τη διαβάζει η καθαρή πράξη: πού, με ποια πρόθεση, προς ποια κατεύθυνση. */
export interface TableRangeTransferRequest {
  /** Η περιοχή που πιάστηκε από το περίγραμμά της (Φάση 1). */
  readonly source: TableCellRangeBounds;
  /** Το κελί όπου προσγειώνεται η **πάνω-αριστερή** γωνία της περιοχής. */
  readonly to: TableCellRef;
  /** `Ctrl` / `Shift` — δες {@link TableRangeDragIntent}. */
  readonly intent: TableRangeDragIntent;
  /** Προς τα πού σπρώχνονται τα υπάρχοντα όταν `intent.insert` — αδιάφορο αλλιώς. */
  readonly shiftAxis: TableRangeShiftAxis;
}

/**
 * Μια συγχώνευση που ταξιδεύει: το **αρχικό** εύρος και το μετατοπισμένο.
 *
 * Και τα δύο, γιατί ο εφαρμοστής χρειάζεται δύο διαφορετικά πράγματα: το `to` για να το
 * προσθέσει, και το `from` — **by-reference**, ώστε να το αφαιρέσει από τα υπάρχοντα χωρίς
 * δεύτερη σύγκριση ισότητας εύρους. Μια δεύτερη «είναι το ίδιο εύρος;» θα ήταν ακριβώς το είδος
 * κρίσης που αποκλίνει σιωπηλά.
 */
export interface TableMergeMove {
  readonly from: CellSpan;
  readonly to: CellSpan;
}

/**
 * Πού προσγειώνεται η περιοχή και τι γεμίζει — το κοινό παραδοτέο των **δύο** τρόπων απόθεσης
 * (σκέτη μετακίνηση/αντιγραφή · εισαγωγή & ολίσθηση).
 */
export interface TableRangeLanding {
  readonly destination: TableCellRangeBounds;
  readonly fills: readonly TableCellFill[];
}

/** Το εγκεκριμένο σχέδιο. Ό,τι χρειάζεται ο εφαρμοστής, και τίποτα που να μη μετρήθηκε. */
export interface TableRangeTransferPlan extends TableRangeLanding {
  readonly source: TableCellRangeBounds;
  /**
   * 🔴 Το {@link TableRangeLanding.destination} **δεν** είναι πάντα η αφελής μετατόπιση.
   *
   * Χωρίς `Shift` είναι. **Με** `Shift` όμως, όταν η ολίσθηση κλείνει την τρύπα της πηγής, οι
   * γραμμές **πάνω** από το σημείο απόθεσης λιγοστεύουν, οπότε η περιοχή κάθεται ψηλότερα από
   * εκεί που θα την τοποθετούσε η αφαίρεση δεικτών. Το φάντασμα της Φάσης 3 και οι ακμές
   * διαβάζουν **αυτό**, όχι το ενδιάμεσο — αλλιώς η προεπισκόπηση θα υποσχόταν μια θέση και το
   * drop θα παρέδιδε άλλη.
   */
  readonly intent: TableRangeDragIntent;
  /** Οι συγχωνεύσεις που ταξιδεύουν — **και οι δύο** όψεις τους (δες {@link TableMergeMove}). */
  readonly mergeMoves: readonly TableMergeMove[];
}

/** Ναι με σχέδιο, ή όχι με λόγο — **ποτέ** σιωπηλό `null` που ο καλών πρέπει να ερμηνεύσει. */
export type TableRangeTransferOutcome =
  | { readonly ok: true; readonly plan: TableRangeTransferPlan }
  | { readonly ok: false; readonly reason: TableRangeTransferRefusal };
