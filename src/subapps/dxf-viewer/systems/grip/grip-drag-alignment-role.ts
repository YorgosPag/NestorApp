/**
 * ADR-537/561/508 — grip-drag alignment/HUD SELECTION SSoT (2D ↔ 3D).
 *
 * The «which anchors light up the alignment traces» + «which segments the white
 * length/angle HUD dimensions» rules for a plain-DXF (line / polyline) grip drag used
 * to live INLINE inside the 2D preview helpers (`paintGripActionAlignmentTraces` /
 * `drawMemberGripHud`), keyed on `DxfGripDragPreview` (`dp`). The 3D raw-DXF grip path
 * (ADR-537) has a `GripInfo` + a live `livePlanPos`, NOT a `dp`, so it cannot reuse that
 * inline logic — and copying it would fork the SSoT.
 *
 * This module extracts BOTH selection rules onto a minimal, unit-agnostic view
 * ({@link GripAlignmentRole}) that BOTH sides can build (2D from `dp`, 3D from `GripInfo`
 * where `anchorPos ≡ grip.position`, `isRotation` from the `*-rotation` grip kind). The
 * 2D helpers become thin adapters; the 3D passes call the SAME functions — one selection
 * SSoT, zero duplicate. Pure — zero React / DOM / store deps.
 *
 * Coordinate-space AGNOSTIC: the caller supplies `entity` + `role.anchorPos` in ONE
 * consistent space (2D → scene/world units; 3D grip-tracking → the DXF scene's native
 * units), and the returned anchors are in that same space.
 *
 * @see hooks/tools/grip-ghost-preview-overlay-helpers.ts — 2D traces adapter
 * @see hooks/tools/grip-ghost-preview-hud-helpers.ts — 2D HUD adapter
 * @see bim-3d/viewport/overlay-dispatch/use-grip-tracking-pass.ts — 3D traces
 * @see bim-3d/viewport/overlay-dispatch/use-grip-hud-pass.ts — 3D HUD
 */

import type { Point2D } from '../../rendering/types/Types';
import { gripKindOf, type LineGripKind } from '../../hooks/grip-kinds';
import type { GripInfo } from '../../hooks/grip-types';
import { gripGlyphShape } from '../../bim/grips/grip-glyph-registry';
import { getLineGripAlignmentAnchors } from '../line/line-grips';
import {
  getPolylineGripAlignmentAnchors,
  getPolylineVertexIncidentSegments,
  getPolylineEdgeSlideIncidentSegments,
  isPolylineStraightEdgeSlide,
} from '../polyline/polyline-grips';

/**
 * The minimal per-grip view shared by the 2D `DxfGripDragPreview` and the 3D `GripInfo`
 * paths. Everything the anchor/segment selection needs, nothing entity-specific:
 *   - `movesEntity`  — whole-entity translate (base-point anchor).
 *   - `isRotation`   — rotation handle (2D `dp.rotatePivot`; 3D `*-rotation` grip kind) → no traces.
 *   - `gripIndex`    — vertex/edge index (polyline vertex adjacency, line endpoint).
 *   - `anchorPos`    — the grabbed point (2D `dp.anchorPos`; 3D `grip.position`).
 *   - `edgeVertexIndices` — present on a polyline segment-midpoint slide grip (`[i, next]`).
 *   - `lineGripKind` — line rotation discriminator (excludes the rotation handle).
 */
export interface GripAlignmentRole {
  readonly movesEntity: boolean;
  readonly isRotation: boolean;
  readonly gripIndex: number;
  readonly anchorPos: Point2D | null;
  readonly edgeVertexIndices?: readonly [number, number];
  readonly lineGripKind?: LineGripKind | null;
}

/**
 * Build the shared {@link GripAlignmentRole} from a 3D `GripInfo` (the raw-DXF grip path, ADR-537).
 * `anchorPos` is the grabbed point in the SAME coordinate space the caller resolves in (the DXF scene's
 * native units for grip-tracking; pass `null` for the HUD-segment topology, which ignores it). Rotation
 * is detected via the ONE glyph-registry SSoT (`gripGlyphShape(kind) === 'rotation'`) across the raw-DXF
 * kinds (line / arc / polyline / circle), so it can never drift from the rendered handle vocabulary. The
 * 2D side builds the role inline from `DxfGripDragPreview` (different shape) — this adapter is 3D-only.
 */
export function gripInfoToAlignmentRole(grip: GripInfo, anchorPos: Point2D | null): GripAlignmentRole {
  // ADR-602 Stage 4 — 1:1 chain over the 4 raw-DXF kinds (line/arc/polyline/circle), NOT a
  // bare `grip.gripKind?.kind` collapse: this adapter is raw-DXF-only, and a defensive BIM
  // grip must still resolve to `undefined` here (else a BIM rotation kind would flip isRotation).
  const kind = gripKindOf(grip, 'line') ?? gripKindOf(grip, 'arc')
    ?? gripKindOf(grip, 'polyline') ?? gripKindOf(grip, 'circle');
  return {
    movesEntity: grip.movesEntity,
    isRotation: gripGlyphShape(kind) === 'rotation',
    gripIndex: grip.gripIndex,
    anchorPos,
    edgeVertexIndices: grip.edgeVertexIndices,
    lineGripKind: gripKindOf(grip, 'line'),
  };
}

/**
 * Structural view of the dragged entity — the fields the line/polyline selection reads.
 * A full `Entity` (2D bim types) or `DxfEntityUnion` (3D) is assignable to it, so BOTH
 * callers pass their native entity variable with no cast.
 */
export interface GripAlignmentEntityView {
  readonly type: string;
  readonly start?: Point2D;
  readonly end?: Point2D;
  readonly vertices?: readonly Point2D[];
  readonly closed?: boolean;
  readonly bulges?: readonly number[];
}

/**
 * The alignment-tracking anchor point(s) for a plain-DXF grip drag, or `null` when the
 * grip produces no traces (a non-line / non-polyline reshape — e.g. a BIM footprint, which
 * the 2D caller resolves separately, or a rotation handle). Mirrors the branch order the
 * 2D `paintGripActionAlignmentTraces` used inline:
 *   1. whole-entity translate (`movesEntity`, not rotation) → the base point (`anchorPos`);
 *   2. line endpoint reshape → the line SSoT anchors (fixed endpoint; rotation → null);
 *   3. polyline STRAIGHT edge-slide → the base point (slides the whole leg like a move);
 *   4. polyline VERTEX reshape → the fixed neighbour vertices (polyline SSoT).
 * The arc-apex (curved midpoint) is excluded from (3) via `isPolylineStraightEdgeSlide`.
 */
export function resolveGripAlignmentAnchors(
  entity: GripAlignmentEntityView,
  role: GripAlignmentRole,
): Point2D[] | null {
  if (role.movesEntity && !role.isRotation && role.anchorPos) {
    return [role.anchorPos];
  }
  if (entity.type === 'line' && entity.start && entity.end) {
    return getLineGripAlignmentAnchors(
      role.gripIndex,
      role.lineGripKind,
      { start: entity.start, end: entity.end },
      role.anchorPos,
    );
  }
  if (entity.type === 'polyline' && entity.vertices) {
    return isPolylineStraightEdgeSlide(role.edgeVertexIndices, entity.bulges)
      ? (role.anchorPos ? [role.anchorPos] : null)
      : getPolylineGripAlignmentAnchors(role.gripIndex, entity.vertices, entity.closed ?? false);
  }
  return null;
}

/**
 * The polyline vertex-index pair(s) whose length/angle the white HUD must dimension while
 * a polyline grip is dragged, or `[]` when the grip is not a polyline reshape. Mirrors the
 * inline gate the 2D `drawMemberGripHud` used:
 *   - STRAIGHT edge-slide (`edgeVertexIndices`, non-arc) → the leg + its two neighbours
 *     ({@link getPolylineEdgeSlideIncidentSegments});
 *   - VERTEX reshape → the (≤2) segments incident to the dragged vertex
 *     ({@link getPolylineVertexIncidentSegments}).
 * The caller maps each index pair onto ITS OWN reshaped vertices (2D → the `transformed`
 * ghost; 3D → the live-reshaped ghost points) before `buildSegmentHudMeta`.
 */
export function resolvePolylineHudSegments(
  entity: GripAlignmentEntityView,
  role: GripAlignmentRole,
): Array<readonly [number, number]> {
  if (entity.type !== 'polyline' || !entity.vertices) return [];
  const n = entity.vertices.length;
  const closed = entity.closed ?? false;
  return isPolylineStraightEdgeSlide(role.edgeVertexIndices, entity.bulges) && role.edgeVertexIndices
    ? getPolylineEdgeSlideIncidentSegments(role.edgeVertexIndices, n, closed)
    : getPolylineVertexIncidentSegments(role.gripIndex, n, closed);
}
