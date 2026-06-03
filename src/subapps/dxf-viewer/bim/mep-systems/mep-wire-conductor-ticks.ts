/**
 * MEP home-run conductor ticks — ADR-408 Φ7 (SSoT, pure).
 *
 * Revit's home-run tick marks: short slashes crossing the wire near the panel
 * arrow, one per conductor, encoding how many (and which) conductors run on the
 * circuit's home-run leg:
 *   - `hot`     (ungrounded)        → a LONG slash,
 *   - `neutral` (grounded)          → a SHORT slash,
 *   - `ground`  (equipment ground)  → a SHORT slash + a dot at its outer end.
 *
 * This is the ONE place the tick geometry is computed. It is **screen-space**
 * (zoom-independent, like the home-run arrow): the caller passes the two screen
 * endpoints of the home-run leg (`tip` = panel end, `from` = first fixture) and
 * the conductor counts; `MepWireRenderer` only strokes the returned segments
 * (plus the ground dot). Pure — no canvas, no store, no Date/Math.random.
 *
 * @see ./mep-wire-routing.ts (CircuitWirePath.conductors)
 * @see ../renderers/MepWireRenderer.ts (the sole consumer)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ConductorBreakdown } from '../types/mep-system-types';

/** Pixel length of a `hot` (ungrounded) conductor slash — the long tick. */
const HOT_LEN_PX = 14;
/** Pixel length of a `neutral` / `ground` slash — the short tick. */
const SHORT_LEN_PX = 8;
/** Distance (px) from the panel end before the first tick, clearing the arrow. */
const TICK_OFFSET_PX = 15;
/** Spacing (px) between consecutive ticks along the home-run leg. */
const TICK_SPACING_PX = 5;
/** Slash angle relative to the wire axis (Revit-style ~60° lean). */
const TICK_ANGLE_RAD = Math.PI / 3;
/** Radius (px) of the dot drawn at the outer end of a `ground` tick. */
export const GROUND_DOT_R = 2;

/** One conductor tick to stroke, with its role (drives length + ground dot). */
export interface ConductorTick {
  /** Inner endpoint (on the wire axis side). */
  readonly a: Point2D;
  /** Outer endpoint (where the `ground` dot, if any, is drawn). */
  readonly b: Point2D;
  readonly kind: 'hot' | 'neutral' | 'ground';
}

/** Rotate unit-ish vector `(x,y)` by `rad` (standard 2D rotation). */
function rotate(x: number, y: number, rad: number): Point2D {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: x * c - y * s, y: x * s + y * c };
}

/**
 * Build the conductor tick slashes for one home-run leg. Ticks march from the
 * panel end (`tip`) toward `from`, ordered hots → neutrals → grounds, each a
 * slash centred on the wire axis at {@link TICK_ANGLE_RAD}. Returns `[]` for a
 * degenerate (zero-length) leg or when there are no conductors.
 */
export function buildConductorTicks(
  tip: Point2D,
  from: Point2D,
  conductors: ConductorBreakdown,
): ConductorTick[] {
  const total = conductors.hot + conductors.neutral + conductors.ground;
  if (total <= 0) return [];
  const dx = from.x - tip.x;
  const dy = from.y - tip.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return [];
  const ux = dx / len;
  const uy = dy / len;
  // Slash direction = the leg axis rotated by the lean angle (unit vector).
  const slash = rotate(ux, uy, TICK_ANGLE_RAD);

  const kinds: ConductorTick['kind'][] = [
    ...Array<ConductorTick['kind']>(conductors.hot).fill('hot'),
    ...Array<ConductorTick['kind']>(conductors.neutral).fill('neutral'),
    ...Array<ConductorTick['kind']>(conductors.ground).fill('ground'),
  ];

  return kinds.map((kind, i) => {
    const dist = TICK_OFFSET_PX + i * TICK_SPACING_PX;
    const cx = tip.x + ux * dist;
    const cy = tip.y + uy * dist;
    const half = (kind === 'hot' ? HOT_LEN_PX : SHORT_LEN_PX) / 2;
    return {
      a: { x: cx - slash.x * half, y: cy - slash.y * half },
      b: { x: cx + slash.x * half, y: cy + slash.y * half },
      kind,
    };
  });
}
