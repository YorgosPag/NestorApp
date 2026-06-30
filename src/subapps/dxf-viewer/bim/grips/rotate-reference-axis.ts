/**
 * ADR-363 Slice G.6 — FREE-rotate reference baseline along the entity's MAJOR axis.
 *
 * When the user picks a rotation centre (pivot) in the free-rotate hot-grip flow, the
 * imaginary reference line (from which the live sweep is measured) should start
 * PARALLEL to the entity's longest axis — pointing toward the entity BODY — so the
 * far end of that axis tracks the cursor (Giorgio 2026-06-30: «η νοητή ευθεία από το
 * κέντρο περιστροφής να είναι πάντοτε παράλληλη προς τον μεγαλύτερο άξονα· η μακρινή
 * άκρη ακολουθεί το ποντίκι»). Before this, the baseline was the cursor position at
 * the first move after the pivot — an arbitrary direction.
 *
 * This pure helper resolves that baseline ANCHOR (`pivot + majorAxisUnit`) for ANY
 * entity, REUSING the existing orientation SSoT `resolveMoveGlyphFrame` (the same
 * local +X/+Y axes the MOVE glyph rotates by) — NO new orientation maths. Returns
 * `null` when the entity has no planar orientation, so the caller falls back to the
 * legacy first-move baseline (zero regression).
 *
 * Major-axis selection: linear entities (wall / beam / segment / strip / plain line)
 * are longest ALONG their axis → local +X. Box entities (column / foundation / …)
 * use whichever of width (local +X) / depth (local +Y) is larger. Direction is then
 * flipped to point from the pivot toward the entity centre (the «body»), so the
 * reference line lies over the body and its far end chases the cursor.
 *
 * Pure: zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/grips/move-glyph-frame.ts — `resolveMoveGlyphFrame` (the orientation SSoT)
 * @see hooks/grips/grip-hotgrip-actions.ts — seeds `hotGripRotateBaseRef` with this
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md Slice G.6
 */

import type { Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { resolveMoveGlyphFrame } from './move-glyph-frame';

/**
 * World-unit threshold separating a pivot that sits OFF the axis of symmetry (so the
 * body lies clearly to one side → follow it) from one ON it (projection ≈ 0 → the
 * direction is ambiguous, default to −major). Tiny: real grips project at ½·dimension.
 */
const MAJOR_AXIS_PROJ_EPS = 1e-6;

interface BBoxView { readonly min: { x: number; y: number }; readonly max: { x: number; y: number }; }

interface DimsView {
  readonly width?: number;
  readonly depth?: number;
  readonly length?: number;
  readonly height?: number;
  readonly start?: { x: number; y: number };
  readonly end?: { x: number; y: number };
  readonly startPoint?: { x: number; y: number };
  readonly endPoint?: { x: number; y: number };
  readonly position?: { x: number; y: number };
}

/** Entity centre (world) for the «toward the body» direction flip. */
function entityCentre(entity: Entity): Point2D | null {
  const bbox = (entity as { geometry?: { bbox?: BBoxView } }).geometry?.bbox;
  if (bbox) return { x: (bbox.min.x + bbox.max.x) / 2, y: (bbox.min.y + bbox.max.y) / 2 };
  // Plain DXF line: top-level start/end midpoint.
  const ln = entity as { type?: string; start?: { x: number; y: number }; end?: { x: number; y: number } };
  if (ln.type === 'line' && ln.start && ln.end) {
    return { x: (ln.start.x + ln.end.x) / 2, y: (ln.start.y + ln.end.y) / 2 };
  }
  const p = (entity as { params?: DimsView }).params;
  if (p) {
    const a = p.start ?? p.startPoint;
    const b = p.end ?? p.endPoint;
    if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (p.position) return { x: p.position.x, y: p.position.y };
  }
  return null;
}

/**
 * True when local +Y (depth) is the MAJOR axis (so the reference uses `axisY`).
 * Linear entities (an axis with start/end) and params-less primitives are longest
 * along local +X → false. Box entities compare width (local +X) vs depth/length/
 * height (local +Y). Unknown dims → false (default to +X).
 */
function axisYIsMajor(entity: Entity): boolean {
  const p = (entity as { params?: DimsView }).params;
  if (!p) return false; // plain line: length along +X dominates
  if ((p.start && p.end) || (p.startPoint && p.endPoint)) return false; // linear → +X
  const w = p.width;
  const d = p.depth ?? p.length ?? p.height;
  if (typeof w === 'number' && typeof d === 'number') return d > w;
  return false;
}

/**
 * Resolve the free-rotate reference baseline anchor (`pivot + majorAxisUnit`,
 * oriented toward the entity body) for `entity`, or `null` when the entity has no
 * planar orientation (caller falls back to the legacy first-move baseline).
 *
 * The returned point is one unit from the pivot along the major axis; only its
 * DIRECTION matters (the sweep is angle-based, distance-independent), mirroring how
 * the 6-click reference flow and the typed-angle flow seed their anchors.
 */
export function resolveRotateReferenceAnchor(entity: Entity, pivot: Point2D): Point2D | null {
  const frame = resolveMoveGlyphFrame(entity);
  if (!frame) return null;
  const major = axisYIsMajor(entity) ? frame.axisY : frame.axisX;
  // Direction along the major axis, toward the body. `major` is kept ONLY when it
  // points clearly toward the centre (projection > ε); otherwise — it points away
  // OR the pivot sits on the axis of symmetry (projection ≈ 0) — use −major. For a
  // wall this reproduces the Giorgio truth-table exactly: east-side grips → west,
  // west-side grips → east, central-X grips (mid-N / centre / mid-S) → west (−major).
  let dir: Point2D = { x: -major.x, y: -major.y };
  const centre = entityCentre(entity);
  if (centre) {
    const proj = (centre.x - pivot.x) * major.x + (centre.y - pivot.y) * major.y;
    if (proj > MAJOR_AXIS_PROJ_EPS) dir = major;
  }
  return { x: pivot.x + dir.x, y: pivot.y + dir.y };
}
