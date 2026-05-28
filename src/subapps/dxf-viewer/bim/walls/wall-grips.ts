/**
 * ADR-363 Phase 1C — Wall parametric grip positions.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. `getWallGrips()`
 * produces `GripInfo[]` consumed by `computeDxfEntityGrips`. The drag transforms
 * live in `wall-grip-transforms.ts` (re-exported below for a stable public API)
 * and the shared math in `wall-grip-math.ts`. Mirrors the stair 3-file split
 * (`bim/stairs/stair-grips.ts`, ADR-393). Exposes the grips described in
 * ADR-363 §6 Phase 1C:
 *
 *   - `wall-start`     → translate axis start endpoint (no other params change)
 *   - `wall-end`       → translate axis end endpoint
 *   - `wall-midpoint`  → translate whole wall (axis midpoint anchor, moves both endpoints)
 *   - `wall-thickness` → resize thickness perpendicular to axis (symmetric);
 *                        manual override drops `dna`
 *   - `wall-curve`     → move quadratic Bezier control point (curved kind only)
 *   - `wall-vertex-N`  → translate polyline interior vertex N (polyline kind only)
 *
 * Phase 1C-bis (2026-05-27) — Asymmetric corner grips
 * (ArchiCAD / Vectorworks / AutoCAD reference-line pattern). Each corner is a
 * 2-DOF grip: axial component moves only the nearest axis endpoint; perpendicular
 * component grows/shrinks ONLY the corner's side while the opposite face stays
 * fixed and the axis re-centers by half the displacement so the wall remains
 * rectangular (parallel faces preserved). Manual override drops `dna`.
 *
 *   - `wall-corner-start-pos` / `wall-corner-start-neg` → start-side corners
 *   - `wall-corner-end-pos`   / `wall-corner-end-neg`   → end-side corners
 *
 * Phase 1C-ter (2026-05-28) — Straight walls expose ONLY the 4 corners + the
 * center (whole-wall translate); the endpoint grips (`wall-start`/`wall-end`)
 * and both `wall-thickness` face handles are suppressed because the corners
 * already cover length + thickness (direct-manipulation, Giorgio's request).
 * `getWallGrips` still computes all nine — see `suppressRedundantStraightGrips`.
 *
 * SSoT:
 *   - Geometry math via `computeWallGeometry()` (called by `UpdateWallParamsCommand`
 *     at commit time — `wall-grip-transforms` returns ONLY new `WallParams`).
 *   - Grip wire-up via the unified grip system (`computeDxfEntityGrips`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3 §6 Phase 1C / 1C-bis
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.12
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, WallGripKind } from '../../hooks/useGripMovement';
import type { GripShape } from '../../rendering/grips/types';
import type { WallEntity } from '../types/wall-types';
import { mmScaleFor } from '../../utils/scene-units';
import { calculateMidpoint } from '../../rendering/entities/shared/geometry-utils';
import { unitAxis, perpUnit, project2D } from './wall-grip-math';

// Public API re-exports (consumers import from this module).
export { applyWallGripDrag } from './wall-grip-transforms';
export type { WallGripDragInput } from './wall-grip-transforms';

/**
 * Phase 1C-ter (2026-05-28) — map a wall grip kind to its rendered glyph shape.
 * The midpoint (whole-wall MOVE) and the rotation handle get icon glyphs
 * (4-arrow / curved-arrow) instead of the default square — the SAME vocabulary
 * as the stair base/direction grips (`stairGripGlyphShape`). All other wall
 * grips stay square. Consumed by `WallRenderer.getGrips`.
 */
export function wallGripGlyphShape(kind: WallGripKind | undefined): GripShape {
  switch (kind) {
    case 'wall-midpoint':
      return 'move';
    case 'wall-rotation':
      return 'rotation';
    default:
      return 'square';
  }
}

// ─── Grip position computation (ADR-363 §6 Phase 1C) ─────────────────────────

/**
 * Compute the parametric grip positions for a `WallEntity`. Order is stable
 * so `gripIndex` is a deterministic identifier across drags.
 *
 * Phase 1C-ter (2026-05-28): on STRAIGHT walls grips 0/1/3/4 (`wall-start`,
 * `wall-end`, both `wall-thickness` handles) are suppressed from the returned
 * set — the four corners cover length + thickness. See
 * `suppressRedundantStraightGrips`. All nine are still computed below.
 *
 * Layout (gripIndex; ⊘ = suppressed from output on straight kind):
 *   0 → axis start (translate start endpoint)            ⊘ straight
 *   1 → axis end (translate end endpoint)                ⊘ straight
 *   2 → axis midpoint (translate whole wall)
 *   straight kind only (positions read from the computed footprint):
 *     3 → thickness handle, +perp face edge-midpoint     ⊘ straight
 *     4 → thickness handle, -perp face edge-midpoint     ⊘ straight
 *     5 → corner start-pos   (Phase 1C-bis, asymmetric 2-DOF)
 *     6 → corner start-neg
 *     7 → corner end-pos
 *     8 → corner end-neg
 *   curved kind only:
 *     3 → curve control (emitted only when `params.curveControl` set)
 *   polyline kind only:
 *     3..N → interior vertex handles
 */
export function getWallGrips(entity: Readonly<WallEntity>): GripInfo[] {
  const { params, kind } = entity;
  const grips: GripInfo[] = [];

  const start = project2D(params.start);
  const end = project2D(params.end);
  const mid: Point2D = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  // 0 — start endpoint
  grips.push({
    entityId: entity.id,
    gripIndex: 0,
    type: 'vertex',
    position: start,
    movesEntity: false,
    wallGripKind: 'wall-start',
  });

  // 1 — end endpoint
  grips.push({
    entityId: entity.id,
    gripIndex: 1,
    type: 'vertex',
    position: end,
    movesEntity: false,
    wallGripKind: 'wall-end',
  });

  // 2 — axis midpoint translate (moves both endpoints)
  grips.push({
    entityId: entity.id,
    gripIndex: 2,
    type: 'center',
    position: mid,
    movesEntity: true,
    wallGripKind: 'wall-midpoint',
  });

  // 3..8 — thickness handles + Phase 1C-bis corners. Positions read DIRECTLY
  // from the computed footprint (`geometry.outerEdge` / `innerEdge` — the SAME
  // SSoT the renderer draws) so the handles can never drift from the wall
  // faces. Mirrors the stair grip pattern (read from geometry, never re-derive
  // from raw params). The drag transforms (`resizeThickness` / `moveCorner`)
  // still convert canvas↔mm — that boundary is inherent to a mm param store
  // driven by canvas-space cursors and cannot be read off the geometry.
  //
  // Emitted for straight kind (and legacy walls with undefined kind, treated as
  // straight). Skipped for curved/polyline where the rectangular outline does
  // not hold. Corners use type 'vertex' (not 'corner') so `wrapDxfGrip` keeps
  // them out of the `showMidpoints` filter — corners are primary editing
  // affordances (direct-manipulation principle), not secondary helpers.
  const outerPts = entity.geometry?.outerEdge?.points;
  const innerPts = entity.geometry?.innerEdge?.points;
  if (kind !== 'curved' && kind !== 'polyline') {
    // STRAIGHT — handles read from the footprint vertices (the SSoT geometry).
    if (outerPts && innerPts && outerPts.length >= 2 && innerPts.length >= 2) {
      // `computeWallGeometry` bakes `flip` into outer/inner; remap to the +perp
      // ("pos") / -perp ("neg") basis the drag transforms use (`moveCorner` is
      // flip-agnostic) so the picked corner and its drag direction stay in sync.
      const posSide = params.flip ? innerPts : outerPts; // +perp face
      const negSide = params.flip ? outerPts : innerPts; // -perp face
      const posStart = project2D(posSide[0]);
      const posEnd = project2D(posSide[posSide.length - 1]);
      const negStart = project2D(negSide[0]);
      const negEnd = project2D(negSide[negSide.length - 1]);

      // 3 — thickness handle on the +perp face (edge midpoint, SSoT helper).
      grips.push({
        entityId: entity.id,
        gripIndex: 3,
        type: 'edge',
        position: calculateMidpoint(posStart, posEnd),
        movesEntity: false,
        wallGripKind: 'wall-thickness',
      });
      // 4 — symmetric thickness handle on the -perp face (AutoCAD edge-midpoint
      // parity). Same `wall-thickness` transform: `resizeThickness` is symmetric
      // about the axis, so either face drives the same resize.
      grips.push({
        entityId: entity.id,
        gripIndex: 4,
        type: 'edge',
        position: calculateMidpoint(negStart, negEnd),
        movesEntity: false,
        wallGripKind: 'wall-thickness',
      });
      // 5..8 — corners at the footprint vertices.
      grips.push({
        entityId: entity.id, gripIndex: 5, type: 'vertex',
        position: posStart, movesEntity: false, wallGripKind: 'wall-corner-start-pos',
      });
      grips.push({
        entityId: entity.id, gripIndex: 6, type: 'vertex',
        position: negStart, movesEntity: false, wallGripKind: 'wall-corner-start-neg',
      });
      grips.push({
        entityId: entity.id, gripIndex: 7, type: 'vertex',
        position: posEnd, movesEntity: false, wallGripKind: 'wall-corner-end-pos',
      });
      grips.push({
        entityId: entity.id, gripIndex: 8, type: 'vertex',
        position: negEnd, movesEntity: false, wallGripKind: 'wall-corner-end-neg',
      });
      // 9 — rotation handle at the +perp face midpoint: ON the wall body, at the
      // centre of its length, between the two +perp corner handles (Giorgio
      // 2026-05-29: «στο κέντρο ανάμεσα στα δύο χερούλια» — the prior "200mm beyond
      // the end edge" placement read OUTSIDE the wall). Position is read DIRECTLY
      // from the footprint geometry (`posStart`/`posEnd`, the same SSoT the renderer
      // draws) — never re-derived from raw mm — so it stays on the wall in any
      // scene unit (the old `OFFSET_MM * mmScaleFor` drifted off-screen in metre
      // scenes; see grip-positions-read-geometry rule). Renders the curved ROTATION
      // glyph; the 6-click reference flow (ADR-363 §6 Phase 1G.3) rotates the wall.
      grips.push({
        entityId: entity.id,
        gripIndex: 9,
        type: 'vertex',
        position: calculateMidpoint(posStart, posEnd),
        movesEntity: false,
        wallGripKind: 'wall-rotation',
      });
    }
  } else {
    // CURVED / POLYLINE — single symmetric thickness handle at the axis
    // midpoint (no rectangular footprint to read corners from). Scene-scaled
    // perpendicular offset (mm → canvas), mirror `computeWallGeometry`.
    const u = unitAxis(params);
    if (u) {
      const p = perpUnit(u);
      const sign = params.flip ? -1 : 1;
      const halfT = (params.thickness / 2) * mmScaleFor(params);
      grips.push({
        entityId: entity.id,
        gripIndex: 3,
        type: 'edge',
        position: { x: mid.x + sign * halfT * p.x, y: mid.y + sign * halfT * p.y },
        movesEntity: false,
        wallGripKind: 'wall-thickness',
      });
    }
  }

  // 4 — curve control (curved kind only)
  if (kind === 'curved' && params.curveControl) {
    grips.push({
      entityId: entity.id,
      gripIndex: 4,
      type: 'vertex',
      position: project2D(params.curveControl),
      movesEntity: false,
      wallGripKind: 'wall-curve',
    });
  }

  // 5..N — polyline interior vertex handles (skip endpoints at 0/last)
  if (kind === 'polyline' && params.polylineVertices && params.polylineVertices.length >= 3) {
    const verts = params.polylineVertices;
    for (let i = 1; i < verts.length - 1; i++) {
      grips.push({
        entityId: entity.id,
        gripIndex: grips.length,
        type: 'vertex',
        position: project2D(verts[i]),
        movesEntity: false,
        wallGripKind: `wall-vertex-${i}`,
      });
    }
  }

  return suppressRedundantStraightGrips(grips, kind);
}

/**
 * ADR-363 Phase 1C-ter (2026-05-28) — On a straight wall the four corner grips
 * (5..8) already provide every editing degree of freedom: the axial component
 * of a corner drag moves the nearest endpoint (length), the perpendicular
 * component grows the near face while the opposite face stays anchored
 * (thickness). That makes the start/end endpoint grips (`wall-start`,
 * `wall-end`) and the two thickness face-midpoint handles (`wall-thickness`)
 * redundant, so they are hidden from the emitted set per Giorgio's
 * direct-manipulation request (corners + center only).
 *
 * The builder above still computes all nine grips — nothing is deleted.
 * Restoring the full layout (e.g. for debugging) is a one-line revert: drop
 * this filter. Curved / polyline walls have no rectangular footprint (hence no
 * corners), so their endpoint translate grips + single thickness handle stay
 * visible untouched.
 */
function suppressRedundantStraightGrips(
  grips: GripInfo[],
  kind: WallEntity['kind'],
): GripInfo[] {
  if (kind === 'curved' || kind === 'polyline') return grips;
  return grips.filter(
    (g) =>
      g.wallGripKind !== 'wall-start' &&
      g.wallGripKind !== 'wall-end' &&
      g.wallGripKind !== 'wall-thickness',
  );
}
