/**
 * ADR-680 — Εφήμερο «Μέτρημα Απόστασης» (tape measure / DIST) store.
 *
 * In-memory ONLY scratch store for the ephemeral DIST tool: μετράς αποστάσεις/διαδρομές
 * στην οθόνη με ζωντανή ένδειξη, ΧΩΡΙΣ ποτέ να δημιουργείται scene entity ή εγγραφή σε
 * Firestore. Ένα reload τα σβήνει (Revit/AutoCAD measure parity). Καθρεφτίζει το πρότυπο
 * του public gallery `local-measurements-store.ts` (createExternalStore version-signal +
 * stable snapshots) αλλά editor-local, σε world/scene συντεταγμένες.
 *
 * SSoT: ΜΟΝΟΣ ιδιοκτήτης της DIST γεωμετρίας. Το εργαλείο ΠΟΤΕ δεν περνά από
 * `useUnifiedDrawing`/`completeEntity`/`CreateEntityCommand` — μηδέν scene/DB mutation.
 *
 * @module subapps/dxf-viewer/systems/measure/dist-ephemeral-store
 */

import type { Point2D } from '../../rendering/types/Types';
import { createExternalStore } from '../../stores/createExternalStore';

/** Αμετάβλητο snapshot της εφήμερης DIST κατάστασης. */
export interface DistSnapshot {
  /** Η διαδρομή που μετριέται τώρα (μεγαλώνει ανά κλικ· το τελευταίο σημείο είναι το ζωντανό). */
  readonly active: readonly Point2D[];
  /** Ολοκληρωμένες διαδρομές — μένουν ζωγραφισμένες μέχρι το clear. */
  readonly committed: readonly (readonly Point2D[])[];
  /** Αυξάνεται σε κάθε clear ώστε το leaf να μηδενίζει transient UI. */
  readonly clearToken: number;
}

const EMPTY: DistSnapshot = Object.freeze({
  active: Object.freeze([]),
  committed: Object.freeze([]),
  clearToken: 0,
});

const store = createExternalStore<DistSnapshot>(EMPTY);

/** Coincident-point epsilon (scene units) — dedupe του 2ου κλικ ενός double-click. */
const DEDUPE_EPSILON = 1e-6;

/** Subscribe σε κάθε αλλαγή· επιστρέφει unsubscribe. */
export function subscribeDist(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Σταθερή αναφορά snapshot όσο δεν αλλάζει (απαραίτητο για useSyncExternalStore). */
export function getDistSnapshot(): DistSnapshot {
  return store.get();
}

/** Προσθήκη σημείου στην ενεργή διαδρομή. Παραλείπει coincident επανάληψη (double-click). */
export function addDistPoint(point: Point2D): void {
  const prev = store.get();
  const last = prev.active[prev.active.length - 1];
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < DEDUPE_EPSILON) return;
  store.set({ ...prev, active: [...prev.active, { x: point.x, y: point.y }] });
}

/** Πάγωμα της ενεργής διαδρομής στο `committed` + έναρξη νέας ενεργής (Enter / double-click). */
export function finishDistPath(): void {
  const prev = store.get();
  if (prev.active.length < 2) {
    if (prev.active.length === 0) return; // τίποτα να παγώσω
    store.set({ ...prev, active: [] });   // μεμονωμένο σημείο → απόρριψη
    return;
  }
  store.set({ ...prev, committed: [...prev.committed, prev.active], active: [] });
}

/** Αφαίρεση του τελευταίου σημείου της ενεργής διαδρομής (Backspace). */
export function undoLastDistPoint(): void {
  const prev = store.get();
  if (prev.active.length === 0) return;
  store.set({ ...prev, active: prev.active.slice(0, -1) });
}

/** Καθαρισμός των πάντων + bump του clear token. */
export function clearDist(): void {
  const prev = store.get();
  store.set({ active: [], committed: [], clearToken: prev.clearToken + 1 });
}

/** Test-only reset. */
export function __resetDistForTest(): void {
  store.reset(EMPTY);
}
