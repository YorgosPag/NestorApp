/**
 * BIM Schedule — Region-Pick Store (ADR-363 §6 Phase 8 / M5).
 *
 * Zero-React-state singleton για το 2-click BBox pick FSM. Mirror του
 * HoverStore / ImmediatePositionStore pattern (ADR-040 R2): mutable module
 * state + skip-if-unchanged setters + getter snapshot + individual
 * subscribers. Leaf canvas renderers μπορούν να καταναλώσουν το store
 * χωρίς να προκαλούν re-render του CanvasSection / CanvasLayerStack.
 *
 * State:
 *   - `phase`        FSM stage (idle / awaiting-first / awaiting-second).
 *   - `firstCorner`  World-coord anchor (mm), null όσο awaiting-first OR idle.
 *
 * Live cursor δεν αποθηκεύεται εδώ — leaves που ζωγραφίζουν rubber-band
 * preview θα συνδυάζουν `getPhase() + getFirstCorner()` με την
 * `ImmediatePositionStore` (cursor SSoT) στην ίδια render frame.
 *
 * Lifecycle owner: ο `useScheduleRegionPickTool` hook ορίζει transitions.
 * Άλλοι consumers ΜΟΝΟ διαβάζουν (getter / subscribe).
 *
 * ADR-040 compliance:
 *   - R1 ✅ canvas-leaf-friendly (no React in module)
 *   - R2 ✅ getter API για event-time reads (no stale snapshots)
 *   - R3 ✅ δεν εμπλέκεται σε bitmap cache key
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import { createExternalStore } from '../../../stores/createExternalStore';

// ─── FSM phases ───────────────────────────────────────────────────────────────

export type RegionPickPhase =
  | 'idle'
  | 'awaiting-first-corner'
  | 'awaiting-second-corner';

// ─── SSoT pub/sub via createExternalStore (WAVE 2.6) ─────────────────────────
//
// `phase` and `firstCorner` are two INDEPENDENT fields with their own
// subscribe channel each (leaves subscribe to only the one they need), so this
// is TWO `createExternalStore` instances rather than one composite snapshot.
//
// - `phaseStore`: `equals: Object.is` reproduces `if (next === phase) return`.
// - `firstCornerStore`: custom `equals` reproduces the structural guard (both
//   null, OR same reference, OR same x+y) the hand-rolled setter used.

const phaseStore = createExternalStore<RegionPickPhase>('idle', { equals: Object.is });

function firstCornerEquals(a: Point2D | null, b: Point2D | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.x === b.x && a.y === b.y;
}

const firstCornerStore = createExternalStore<Point2D | null>(null, {
  equals: firstCornerEquals,
});

type Listener = () => void;

// ─── Setters (skip-if-unchanged) ─────────────────────────────────────────────

/** Set FSM phase. No-op if unchanged. */
export function setRegionPickPhase(next: RegionPickPhase): void {
  phaseStore.set(next);
}

/**
 * Set first-corner anchor (world-coords, mm). Pass null όταν reset.
 * Skip-if-unchanged compares structural identity (both null OR same x+y).
 */
export function setRegionPickFirstCorner(next: Point2D | null): void {
  firstCornerStore.set(next);
}

/** Atomic reset — clears phase and first corner σε ένα notify cycle. */
export function resetRegionPickStore(): void {
  setRegionPickFirstCorner(null);
  setRegionPickPhase('idle');
}

// ─── Getters (snapshot-compatible) ───────────────────────────────────────────

export function getRegionPickPhase(): RegionPickPhase {
  return phaseStore.get();
}

export function getRegionPickFirstCorner(): Point2D | null {
  return firstCornerStore.get();
}

// ─── Subscribers (useSyncExternalStore) ──────────────────────────────────────

export function subscribeRegionPickPhase(cb: Listener): () => void {
  return phaseStore.subscribe(cb);
}

export function subscribeRegionPickFirstCorner(cb: Listener): () => void {
  return firstCornerStore.subscribe(cb);
}
