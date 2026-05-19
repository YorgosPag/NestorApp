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

// ─── FSM phases ───────────────────────────────────────────────────────────────

export type RegionPickPhase =
  | 'idle'
  | 'awaiting-first-corner'
  | 'awaiting-second-corner';

// ─── Internal mutable state ──────────────────────────────────────────────────

let phase: RegionPickPhase = 'idle';
let firstCorner: Point2D | null = null;

type Listener = () => void;
const phaseSubscribers = new Set<Listener>();
const firstCornerSubscribers = new Set<Listener>();

// ─── Setters (skip-if-unchanged) ─────────────────────────────────────────────

/** Set FSM phase. No-op if unchanged. */
export function setRegionPickPhase(next: RegionPickPhase): void {
  if (next === phase) return;
  phase = next;
  phaseSubscribers.forEach((cb) => cb());
}

/**
 * Set first-corner anchor (world-coords, mm). Pass null όταν reset.
 * Skip-if-unchanged compares structural identity (both null OR same x+y).
 */
export function setRegionPickFirstCorner(next: Point2D | null): void {
  if (next === firstCorner) return;
  if (
    next !== null &&
    firstCorner !== null &&
    next.x === firstCorner.x &&
    next.y === firstCorner.y
  ) {
    return;
  }
  firstCorner = next;
  firstCornerSubscribers.forEach((cb) => cb());
}

/** Atomic reset — clears phase and first corner σε ένα notify cycle. */
export function resetRegionPickStore(): void {
  setRegionPickFirstCorner(null);
  setRegionPickPhase('idle');
}

// ─── Getters (snapshot-compatible) ───────────────────────────────────────────

export function getRegionPickPhase(): RegionPickPhase {
  return phase;
}

export function getRegionPickFirstCorner(): Point2D | null {
  return firstCorner;
}

// ─── Subscribers (useSyncExternalStore) ──────────────────────────────────────

export function subscribeRegionPickPhase(cb: Listener): () => void {
  phaseSubscribers.add(cb);
  return () => {
    phaseSubscribers.delete(cb);
  };
}

export function subscribeRegionPickFirstCorner(cb: Listener): () => void {
  firstCornerSubscribers.add(cb);
  return () => {
    firstCornerSubscribers.delete(cb);
  };
}
