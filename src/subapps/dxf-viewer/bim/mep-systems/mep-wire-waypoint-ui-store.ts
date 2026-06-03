/**
 * MEP wire waypoint UI store — ADR-408 Φ7 FU#3.
 *
 * Micro-leaf singleton for the *ephemeral hover affordance* of the wire-waypoint
 * editor: which point the cursor is over and whether it is an existing vertex
 * (`'node'` → highlight, draggable) or a spot on a segment (`'insert'` → ghost
 * "+", a drag here births a vertex). Mirror of `HoverStore` — mutable singleton,
 * optional React subscription via `useSyncExternalStore`, skip-if-unchanged so a
 * stable snapshot reference is returned between identical hovers.
 *
 * The drag geometry itself is NOT here: during a drag the interaction
 * optimistically upserts the system into `mep-system-store`, so the existing
 * `HomeRunWiresOverlay` leaf re-routes + repaints. This store only carries hover.
 *
 * ADR-040: leaf subscriber pattern — only `HomeRunWiresOverlay` reads it.
 *
 * @see ../../components/dxf-layout/HomeRunWiresOverlay.tsx
 * @see ../../hooks/canvas/use-mep-wire-waypoint-interaction.ts
 */

/** Hover affordance for the wire-waypoint editor (canvas-unit point). */
export interface WireWaypointHover {
  readonly systemId: string;
  readonly x: number;
  readonly y: number;
  readonly kind: 'node' | 'insert';
}

type HoverListener = () => void;

let hover: WireWaypointHover | null = null;
const subscribers = new Set<HoverListener>();

function sameHover(a: WireWaypointHover | null, b: WireWaypointHover | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.systemId === b.systemId && a.x === b.x && a.y === b.y && a.kind === b.kind;
}

/** Set the hover affordance. Skip-if-unchanged keeps the snapshot reference stable. */
export function setWireWaypointHover(next: WireWaypointHover | null): void {
  if (sameHover(hover, next)) return;
  hover = next;
  subscribers.forEach((cb) => cb());
}

/** Snapshot for `useSyncExternalStore` (stable ref between identical hovers). */
export function getWireWaypointHover(): WireWaypointHover | null {
  return hover;
}

export function subscribeWireWaypointHover(cb: HoverListener): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}
