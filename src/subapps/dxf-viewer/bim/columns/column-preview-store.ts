/**
 * Column tool live-preview snap-target store — zero-React singleton (ADR-398 §3.10
 * sync-in-preview unification).
 *
 * **Γιατί υπάρχει:** πιστό mirror του `wall-preview-store` / `beam-preview-store` (targets
 * μέρος) ώστε το εργαλείο «Κολώνα» να υπολογίζει το face-snap **σύγχρονα στο preview** (ίδιο
 * pattern με τοίχο/δοκάρι), αντί ο decoupled `snap-scheduler` να το προ-υπολογίζει async και να
 * το γράφει σε stores. Ο `useColumnTool` γεμίζει τους στόχους ΜΙΑ φορά (on activate + on
 * `drawing:entity-created`)· το `column-preview-helpers` (ghost) και το `mouse-handler-up`
 * (commit) τους διαβάζουν imperatively → **preview ≡ commit** εξ ορισμού (ένας resolver, ίδιοι
 * στόχοι, ίδιος cursor μέσω `ImmediateSnap`).
 *
 * Single-writer (`useColumnTool`), multi-reader (preview + commit). Pre-collected (ΟΧΙ per-frame
 * `collectMemberSnapTargets`) → ελαφρύ hover σε αδύναμο μηχάνημα. Zero React/DOM (ADR-040-safe).
 *
 * @see ../walls/wall-preview-store.ts — το αρχικό pattern (targets: columnFootprints/memberTargets)
 * @see ./column-face-snap.ts — collectColumnFaceSnapTargets (ο populator) + resolveColumnFaceSnapFromTargets
 * @see ../../hooks/drawing/column-preview-helpers.ts — ο ghost consumer (sync recompute)
 * @see ../../systems/cursor/mouse-handler-up.ts — ο commit consumer (ίδιος resolver)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.10
 */

import type { ColumnFaceSnapTargets } from './column-face-snap';
import type { Point2D } from '../../rendering/types/Types';
import type { LinearMemberSnapTarget } from '../framing/linear-member-face-snap';

const EMPTY: ColumnFaceSnapTargets = Object.freeze({
  footprints: Object.freeze([]) as readonly (readonly Point2D[])[],
  beamTargets: Object.freeze([]) as readonly LinearMemberSnapTarget[],
  wallTargets: Object.freeze([]) as readonly LinearMemberSnapTarget[],
  slabTargets: Object.freeze([]) as readonly LinearMemberSnapTarget[],
});

let currentTargets: ColumnFaceSnapTargets = EMPTY;

export const columnPreviewStore = {
  /** Writer — από `useColumnTool` on activate / `drawing:entity-created` (pre-collected). */
  set(next: ColumnFaceSnapTargets): void {
    currentTargets = next;
  },
  /** Reset back to empty (tool deactivated / idle). */
  reset(): void {
    currentTargets = EMPTY;
  },
  /** Reader (non-React) — escape hatch για preview ghost + commit + tests. */
  get(): ColumnFaceSnapTargets {
    return currentTargets;
  },
};
