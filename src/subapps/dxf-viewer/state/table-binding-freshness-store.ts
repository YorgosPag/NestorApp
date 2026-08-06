'use client';

/**
 * 🔴 ADR-767 Δ4 — **ΤΙ ΕΙΠΕ Ο ΤΕΛΕΥΤΑΙΟΣ ΕΛΕΓΧΟΣ**, ανά δεμένο πίνακα.
 *
 * ## Γιατί «ο τελευταίος έλεγχος» και όχι «η αλήθεια»
 * Το Δ3 είναι δεσμευτικό: ο πίνακας **δεν ξαναγεμίζει ποτέ μόνος του**, και η απάντηση στο
 * «ποιος κηρύσσει *άλλαξα*;» είναι ρητά **κανείς ενεργά**. Άρα η εφαρμογή δεν έχει τρόπο να
 * γνωρίζει *συνεχώς* αν η πηγή κουνήθηκε — παρά μόνο ρωτώντας την, που κοστίζει επίλυση +
 * αποτύπωμα και δεν γίνεται ανά καρέ.
 *
 * Δύο δρόμοι, και ο ένας απορρίφθηκε:
 *
 * | δρόμος | γιατί όχι |
 * |---|---|
 * | Δημοσκόπηση της πηγής ανά καρέ | επίλυση + αποτύπωμα ×N πίνακες ×60 Hz· και θα ήταν **push** από την πίσω πόρτα, δηλαδή το Δ3 παρακαμμένο |
 * | Σημάδι που ισχυρίζεται ζωντανή αλήθεια | θα ήταν **ψέμα** τον περισσότερο χρόνο — και ένα ψέμα που ο χρήστης δεν μπορεί να ελέγξει είναι χειρότερο από σιωπή |
 *
 * Ό,τι μένει είναι το μοντέλο του **AutoCAD `DATALINKNOTIFY`**: μαθαίνεις όταν η εφαρμογή
 * **κοίταξε**, και κοιτάζει σε ρητές στιγμές — «Ανανέωση» και **απόπειρα εξαγωγής**. Η
 * δεύτερη είναι η σημαντική: μετά από έναν φραγμό που ακυρώθηκε, οι μπαγιάτικοι πίνακες
 * μένουν σημαδεμένοι στην οθόνη, δηλαδή ο χρήστης βλέπει **ποιους** πρέπει να ανανεώσει
 * αντί να ψάχνει.
 *
 * ## 🔴 Η ΑΠΟΥΣΙΑ ΔΕΝ ΕΙΝΑΙ «ΕΝΗΜΕΡΩΜΕΝΟΣ»
 * `null` = «κανείς δεν κοίταξε ακόμη». Ο ζωγράφος **δεν** το ζωγραφίζει ως «fresh»: δεν
 * ζωγραφίζει τίποτα. Η ισοπέδωση των δύο θα ήταν το ψεύτικο πράσινο που τα N.11/N.12
 * τεκμηριώνουν τέσσερις φορές, μεταφερμένο στην οθόνη.
 *
 * ## Γιατί store και όχι React state (ADR-040)
 * Ο **μόνος** αναγνώστης είναι ο `TableRenderer`, που δεν διαβάζει React state, και οι
 * γραφείς ζουν σε συμβάντα (πάτημα κουμπιού, υποβολή εξαγωγής). Ίδιο σχήμα με τα υπόλοιπα
 * stores του πίνακα: μηδέν React state, ανάγνωση με **getter τη στιγμή του καρέ**.
 *
 * ⚠️ **Δεν μπαίνει στο κλειδί του bitmap cache** — είναι κατάσταση **paint-time**. Το
 * καθιερωμένο συμβόλαιο γι' αυτό (~12 προηγούμενα) είναι *subscribe → `invalidate()`* στο
 * `useDxfCanvasCacheInvalidation`, ακριβώς όπως το LayerStore και το LWDISPLAY.
 *
 * @module subapps/dxf-viewer/state/table-binding-freshness-store
 * @see bim/table/binding/table-binding-state.ts — `assessTableFreshness`, η κρίση
 * @see canvas-v2/dxf-canvas/useDxfCanvasCacheInvalidation.ts — η ακύρωση του raster
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ4
 */

import { createExternalStore } from '../stores/createExternalStore';
import { markSystemsDirty } from '../rendering/core/frame-scheduler-api';
import type { TableFreshness } from '../bim/table/binding/table-binding-state';

/** Ίδιο σύστημα με κάθε άλλον δείκτη πίνακα — ένα καρέ ανά πραγματική αλλαγή. */
const DXF_CANVAS_SYSTEM_ID = 'dxf-canvas';

/**
 * Ο χάρτης είναι **αμετάβλητος**: κάθε γραφή γεννά νέο `Map`.
 *
 * Μεταλλαγή επί τόπου θα σήμαινε ότι το `useSyncExternalStore` βλέπει την **ίδια** αναφορά
 * μετά την αλλαγή και δεν ξανα-αποδίδει ποτέ — η κλασική σιωπηλή αστοχία των stores που
 * κρατούν συλλογές.
 */
const store = createExternalStore<ReadonlyMap<string, TableFreshness>>(new Map());

/** Ο **τελευταίος** έλεγχος αυτού του πίνακα, ή `null` αν δεν έγινε ποτέ. */
export function getTableBindingFreshness(entityId: string): TableFreshness | null {
  return store.get().get(entityId) ?? null;
}

/**
 * Ίδια ετυμηγορία; Σύγκριση **κατά περιεχόμενο**, ποτέ κατά αναφορά.
 *
 * Το `assessTableFreshness` παράγει **νέο** αντικείμενο σε κάθε κλήση, οπότε μια σύγκριση
 * αναφοράς θα δήλωνε «άλλαξε» σε κάθε έλεγχο και ο φύλακας θα ήταν διακοσμητικός — ακριβώς
 * το λάθος που το `table-indicator-hover-store` τεκμηριώνει για το hover.
 *
 * Το `freshRevision` **συμμετέχει**: ίδια κατάσταση με άλλο αποτύπωμα σημαίνει ότι η πηγή
 * ξανακουνήθηκε από την τελευταία φορά, και ο ζωγράφος οφείλει να το μάθει.
 */
function sameVerdict(a: TableFreshness | undefined, b: TableFreshness): boolean {
  if (a === undefined || a.status !== b.status) return false;
  if (a.status === 'stale' && b.status === 'stale') return a.freshRevision === b.freshRevision;
  if (a.status === 'unknown' && b.status === 'unknown') return a.reason === b.reason;
  return true;
}

/**
 * Καταγράφει το αποτέλεσμα ενός **ρητού** ελέγχου και ζητά καρέ — μόνο αν κάτι άλλαξε.
 *
 * Ο φύλακας ζει εδώ και όχι στους καλούντες: ο φραγμός εξαγωγής γράφει **όλους** τους
 * δεμένους πίνακες με μία χειρονομία, και σε έργο όπου τίποτα δεν άλλαξε αυτό θα ήταν N
 * καρέ για το τίποτα. Ένας δεύτερος γραφέας αύριο δεν μπορεί να τον ξεχάσει.
 */
export function setTableBindingFreshness(entityId: string, verdict: TableFreshness): void {
  const current = store.get();
  if (sameVerdict(current.get(entityId), verdict)) return;
  const next = new Map(current);
  next.set(entityId, verdict);
  store.set(next);
  markSystemsDirty([DXF_CANVAS_SYSTEM_ID]);
}

/**
 * Ο πίνακας έπαψε να είναι δεμένος (ή έφυγε από τη σκηνή) — η ετυμηγορία δεν αφορά κανέναν.
 *
 * Ιδεμποτής: καθαρισμός αγνώστου δεν ζητά καρέ, ώστε να μπορεί να κληθεί από διαδρομές
 * καθαρισμού χωρίς να χρειάζεται ο καλών να ελέγξει πρώτα.
 */
export function clearTableBindingFreshness(entityId: string): void {
  const current = store.get();
  if (!current.has(entityId)) return;
  const next = new Map(current);
  next.delete(entityId);
  store.set(next);
  markSystemsDirty([DXF_CANVAS_SYSTEM_ID]);
}

/** Συνδρομή — ο δρόμος με τον οποίο ακυρώνεται το bitmap cache (δες την κεφαλίδα). */
export function subscribeTableBindingFreshness(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα υπόλοιπα stores του subapp. */
export function __resetTableBindingFreshnessForTests(): void {
  store.reset(new Map());
}
