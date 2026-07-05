/**
 * ROOF EDGE SELECTION STORE — micro-leaf singleton (ADR-417 Φ-per-edge).
 *
 * SSoT για το «ΠΟΙΑ ακμή στέγης επεξεργάζεται το ribbon τώρα» (hybrid edge
 * picker: dropdown «Ακμή» + live highlight στο canvas). Mirrors `HoverStore`:
 * mutable singleton + optional React subscription via `useSyncExternalStore`
 * (zero React state — ADR-040 Phase E micro-leaf pattern).
 *
 * Γιατί ξεχωριστό store (ΟΧΙ grip-hot-state ή selection-set): είναι διακριτό
 * concern — η επιλογή υπο-στοιχείου ΓΙΑ ΕΠΕΞΕΡΓΑΣΙΑ ΠΑΡΑΜΕΤΡΟΥ, ανεξάρτητη από
 * το grip drag interaction. Το `RoofRenderer` το διαβάζει με getter at
 * render-time (event-time read, ΟΧΙ subscription) στο δυναμικό «selected» pass·
 * το redraw trigger ρέει μέσω `renderOptions` (ίδιο μοτίβο με `hoveredEntityId`).
 *
 * @see systems/hover/HoverStore.ts — το πρότυπο
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md
 */

import { createExternalStore } from '../../stores/createExternalStore';

export interface SelectedRoofEdge {
  readonly roofId: string;
  readonly edgeIndex: number;
}

type RoofEdgeListener = () => void;

function sameRoofEdge(a: SelectedRoofEdge | null, b: SelectedRoofEdge | null): boolean {
  return a?.roofId === b?.roofId && a?.edgeIndex === b?.edgeIndex;
}

// SSoT pub/sub plumbing via createExternalStore (WAVE 2.7). Custom `equals`
// reproduces the hand-rolled skip-if-unchanged roofId+edgeIndex guard.
const store = createExternalStore<SelectedRoofEdge | null>(null, { equals: sameRoofEdge });

// ─── Setters ─────────────────────────────────────────────────────────────────

/**
 * Set the currently-edited roof edge. Skip-if-unchanged optimization prevents
 * redundant notifications (and redundant canvas redraws).
 */
export function setSelectedRoofEdge(next: SelectedRoofEdge | null): void {
  store.set(next);
}

/** Clear the edge selection (roof deselected / tool closed). */
export function clearSelectedRoofEdge(): void {
  setSelectedRoofEdge(null);
}

// ─── Getter (snapshot-compatible for useSyncExternalStore) ───────────────────

export function getSelectedRoofEdge(): SelectedRoofEdge | null {
  return store.get();
}

// ─── Subscription (for useSyncExternalStore) ─────────────────────────────────

export function subscribeSelectedRoofEdge(cb: RoofEdgeListener): () => void {
  return store.subscribe(cb);
}
