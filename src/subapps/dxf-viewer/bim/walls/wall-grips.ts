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
import { unitAxis, perpUnit, project2D } from './wall-grip-math';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
// ADR-363 (2026-06-11) — straight-wall 7-grip emission is the shared axis-box SSoT
// (same code as beam + foundation strip). The role↔kind map + AxisBoxParams adapter
// live in `wall-rect-adapter` so emission + drag read ONE mapping (no cycle: the
// adapter does not import this module).
// Column-parity mid-edge extras (Giorgio 2026-06-20): the 2 OPPOSITE wall faces
// reuse the SAME axis-box edge SSoT (`axisBoxEdgeMidpoint`) as the width-edge /
// length-edge — zero-duplication geometry, no re-derived frame in this module.
import { getAxisBoxGrips, axisBoxEdgeMidpoint, type AxisBoxParams } from '../grips/axis-box-grips';
import type { RectEdge, RectSign } from '../grips/rect-frame';
import { WALL_ROLE_TO_KIND, wallAxisBoxParams } from './wall-rect-adapter';

// Public API re-exports (consumers import from this module).
export { applyWallGripDrag, translateWallParams } from './wall-grip-transforms';
export type { WallGripDragInput } from './wall-grip-transforms';

/**
 * Phase 1C-ter (2026-05-28) — map a wall grip kind to its rendered glyph shape.
 * ADR-397: thin wrapper over the shared `gripGlyphShape` registry SSoT (the
 * midpoint MOVE + rotation handle glyphs live there alongside every other BIM
 * entity). Kept for back-compat call sites; new code may call `gripGlyphShape`
 * directly. Consumed by `WallRenderer.getGrips`.
 */
export function wallGripGlyphShape(kind: WallGripKind | undefined): GripShape {
  return gripGlyphShape(kind);
}

/** Axis midpoint (scene units) of the centre-axis box — the `wall-midpoint` MOVE anchor. */
function axisMidpoint(params: AxisBoxParams): Point2D {
  return { x: (params.start.x + params.end.x) / 2, y: (params.start.y + params.end.y) / 2 };
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

  // ── Straight wall → 7 wall-parity grips via the shared axis-box SSoT ─────────
  // (width/thickness edge + length edge + 4 corners + rotation), IDENTICAL code to
  // beam + foundation strip (Giorgio 2026-06-11 «παντού ίδιος κώδικας»). For a
  // straight wall the axis is the centreline, so the centred axis-box footprint ===
  // the rendered footprint (Revit shows shape handles at the un-mitered extents, so
  // miters do not move the grips). `widthFaceSign = flip` keeps the single width-edge
  // + rotation handles on the drawn +perp face.
  if (kind !== 'curved' && kind !== 'polyline') {
    const axisParams = wallAxisBoxParams(params);
    const grips: GripInfo[] = getAxisBoxGrips(axisParams).map((g, i) => ({
      entityId: entity.id,
      gripIndex: i,
      type: g.type,
      position: g.position,
      movesEntity: false,
      wallGripKind: WALL_ROLE_TO_KIND[g.role],
    }));

    // ── Column-parity completion (Giorgio 2026-06-20) ────────────────────────
    // (1) The 2 OPPOSITE mid-edge grips so ALL 4 faces carry a midpoint handle
    //     (mirror της κολόνας / δοκαριού 4 μεσοπλευρικών). The shared axis-box SSoT
    //     emits only the `widthFaceSign` thickness face + the END short edge; these
    //     extras are the OTHER two faces, built from the SAME edge SSoT
    //     (`axisBoxEdgeMidpoint`) on the opposite-sign `RectEdge`, RESPECTING `flip`:
    //       - existing `wall-thickness` sits on `{y, faceSign}` (faceSign = flip?-1:1);
    //         far thickness face → `{y, -faceSign}`.
    //       - existing `wall-edge-length` is the END `{x, +1}`; start short edge → `{x, -1}`.
    // (2) The centre 4-arrow MOVE glyph (`wall-midpoint`): identical behaviour to the
    //     column/beam — the shared move-glyph render / per-arm hover-zone / click→dialog
    //     SSoT activates the moment the grip is emitted (kind already registered in the
    //     glyph registry + hot-grip FSM + `moveMidpoint` transform).
    const faceSign: RectSign = params.flip ? -1 : 1;
    const farThicknessEdge: RectEdge = { axis: 'y', sign: (faceSign === 1 ? -1 : 1) };
    const startLengthEdge: RectEdge = { axis: 'x', sign: -1 };
    grips.push({
      entityId: entity.id, gripIndex: grips.length, type: 'edge',
      position: axisBoxEdgeMidpoint(axisParams, farThicknessEdge),
      movesEntity: false, wallGripKind: 'wall-thickness-far',
    });
    grips.push({
      entityId: entity.id, gripIndex: grips.length, type: 'edge',
      position: axisBoxEdgeMidpoint(axisParams, startLengthEdge),
      movesEntity: false, wallGripKind: 'wall-edge-length-start',
    });
    grips.push({
      entityId: entity.id, gripIndex: grips.length, type: 'center',
      position: axisMidpoint(axisParams),
      movesEntity: true, wallGripKind: 'wall-midpoint',
    });
    return grips;
  }

  // ── Curved / polyline → bespoke (no rectangular footprint to read corners) ───
  // start + end translate + single thickness handle (+ curve control / interior
  // vertices) + the centre 4-arrow MOVE glyph (column/beam parity, Giorgio
  // 2026-06-20 — `moveMidpoint`/`translateWallParams` already translate both
  // endpoints + curveControl + polyline vertices, so the move is correct here too).
  const grips: GripInfo[] = [];
  const start = project2D(params.start);
  const end = project2D(params.end);
  const mid: Point2D = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  grips.push({ entityId: entity.id, gripIndex: 0, type: 'vertex', position: start, movesEntity: false, wallGripKind: 'wall-start' });
  grips.push({ entityId: entity.id, gripIndex: 1, type: 'vertex', position: end, movesEntity: false, wallGripKind: 'wall-end' });

  // Single symmetric thickness handle at the axis midpoint (scene-scaled perp).
  const u = unitAxis(params);
  if (u) {
    const p = perpUnit(u);
    const sign = params.flip ? -1 : 1;
    const halfT = (params.thickness / 2) * mmScaleFor(params);
    grips.push({
      entityId: entity.id,
      gripIndex: 2,
      type: 'edge',
      position: { x: mid.x + sign * halfT * p.x, y: mid.y + sign * halfT * p.y },
      movesEntity: false,
      wallGripKind: 'wall-thickness',
    });
  }

  // Curve control (curved kind only).
  if (kind === 'curved' && params.curveControl) {
    grips.push({
      entityId: entity.id,
      gripIndex: grips.length,
      type: 'vertex',
      position: project2D(params.curveControl),
      movesEntity: false,
      wallGripKind: 'wall-curve',
    });
  }

  // Interior polyline vertex handles (skip endpoints at 0 / last).
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

  // Centre 4-arrow MOVE glyph (column/beam parity). Appended last so the existing
  // bespoke gripIndices (start/end/thickness/curve/vertices) stay stable.
  grips.push({
    entityId: entity.id,
    gripIndex: grips.length,
    type: 'center',
    position: mid,
    movesEntity: true,
    wallGripKind: 'wall-midpoint',
  });

  return grips;
}
