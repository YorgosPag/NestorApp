/**
 * bim3d-resize-bridge.ts — pure resize math bridge: gizmo resize drag → new entity params.
 *
 * ADR-402 (3D Viewport BIM Element Editing) — Phase B resize.
 *
 * Pure (no React, no Zustand, no scene mutation, no command dispatch). Mirrors
 * `bim-gizmo-drag-bridge` for the move/rotate path: it turns the resize drag the
 * gizmo produced (a world axis + the DXF-mm plan slide + the vertical world-Y mm
 * delta + the absolute cursor on the floor plane) into the new entity `params`.
 *
 * Two families, per the Revit-standard semantics chosen for ADR-402 Phase B:
 *
 *   • PLAN resize (axis X / Z) → delegates to the SAME view-agnostic 2D grip-drag
 *     SSoT the ribbon / 2D-grips use (`apply*GripDrag`). Each entity exposes BOTH
 *     world X and Z resize handles; the per-type grip math projects onto the
 *     entity's local frame, so whichever handle is perpendicular to the element
 *     drives the cross-section dimension (a parallel drag projects to ~0 → no-op).
 *       - column: resize-x → width, resize-z → depth (`applyColumnGripDrag`).
 *       - beam:   resize-x/z → width   (`applyBeamGripDrag('beam-width')`).
 *       - wall:   resize-x/z → thickness (see NOTE below).
 *       - slab:   NO plan resize — the footprint is edited per-vertex in 2D.
 *
 *   • VERTICAL resize (axis Y) → a direct mm patch on the element's vertical
 *     field. The 2D plan view has no vertical SSoT (height/depth/thickness live on
 *     the Y axis the plan can't show), so this IS the canonical place for it.
 *       - wall → height, beam → depth, column → height, slab → thickness.
 *
 * Unit contract (delegated grips): `apply*GripDrag` work in scene/canvas units for
 * the slide delta — EXCEPT the magnitude is added to mm fields differently per
 * type, so we honour each function's real contract:
 *   - column `resizeWidth/Depth` divide the local delta by `mmScaleFor` → we pass
 *     `toCanvasDelta(deltaMm, mmScaleFor)` (canvas units), as the column slice did.
 *   - beam `resizeWidth` adds `delta·perp` straight to the mm width → we pass the
 *     raw mm delta (correct in EVERY scene; the 2D caller passes canvas, which is
 *     only right in mm scenes — we don't replicate that latent bug).
 *
 * NOTE (wall thickness): the 2D `resizeThickness` is ABSOLUTE-frame — it derives
 * thickness from the cursor's perpendicular distance to the wall axis, which only
 * works when the grip is rendered ON the wall face. The gizmo resize handle sits
 * at a fixed screen-constant offset along a world axis, NOT on the face, so an
 * absolute read would make thickness jump to the handle distance. We therefore
 * compute thickness RELATIVELY here (`thickness + 2·perpComponent`, the same ×2
 * symmetric formula `resizeThickness` uses) reusing the `perpUnit` geometry SSoT —
 * no new geometric primitive, just the gizmo-appropriate relative accumulation.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GizmoAxis, GizmoResizeMode } from './gizmo-types';
import type { ColumnParams } from '../../bim/types/column-types';
import type { WallParams } from '../../bim/types/wall-types';
import type { BeamParams } from '../../bim/types/beam-types';
import type { SlabParams } from '../../bim/types/slab-types';
import type { StairParams, StairEntity } from '../../bim/types/stair-types';
import { applyColumnGripDrag } from '../../bim/columns/column-grips';
import { applyBeamGripDrag } from '../../bim/beams/beam-grips';
import { applyStairGripDrag } from '../../bim/stairs/stair-grip-transforms';
import type { ColumnGripKind, StairGripKind } from '../../hooks/useGripMovement';
import { MIN_WALL_THICKNESS_MM, MAX_WALL_THICKNESS_MM } from '../../bim/types/wall-types';
import { MIN_BEAM_DEPTH_MM } from '../../bim/types/beam-types';
import { MIN_SLAB_THICKNESS_MM } from '../../bim/types/slab-types';
import { perpUnit, unitVector } from '../../bim/grips/grip-math';
import { detachWallSide, isWallSideAttached } from '../../bim/walls/wall-attach-detach';
import { detachEntitySide, isEntitySideAttached } from '../../bim/entities/entity-attach-detach';
import { detachStairSide, isStairSideAttached } from '../../bim/stairs/stair-attach-detach';
import { snapTotalRiseToWholeSteps } from '../../bim/geometry/stair-vertical-profile';
import { directionToUnitVector, perp as stairPerp } from '../../bim/geometry/stairs/stair-geometry-shared';
import { mmScaleFor, mmToSceneUnits, inferSceneUnitsFromWidth } from '../../utils/scene-units';

/**
 * Floor (mm) for a vertical resize on a field with no dedicated minimum constant
 * (wall / column `height`). Keeps geometry valid (validators require positive).
 */
const MIN_BIM_HEIGHT_MM = 10;

/** A finished gizmo resize drag, expressed in DXF-plan millimetres. */
export interface ResizeDragMm {
  readonly axis: GizmoAxis;
  readonly mode: GizmoResizeMode;
  /** World→DXF horizontal slide delta (mm) — from `worldDeltaToDxfDelta`. */
  readonly deltaMm: Point2D;
  /** Vertical (world-Y) slide delta (mm) — from `worldUpDeltaToMm`. */
  readonly deltaUpMm: number;
  /** Absolute cursor on the floor plane (mm) — from `worldToDxfPlan`. */
  readonly cursorMm: Point2D;
}

/** mm delta → scene/canvas-unit delta (column `apply*GripDrag` work in canvas units). */
export function toCanvasDelta(deltaMm: Point2D, sceneScale: number): Point2D {
  return { x: deltaMm.x * sceneScale, y: deltaMm.y * sceneScale };
}

function clampMin(value: number, min: number): number {
  return Math.max(min, value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Column ──────────────────────────────────────────────────────────────────

/** Column plan resize: resize-x → width (local X), resize-z → depth (local Y). */
function columnGripFor(axis: GizmoAxis): ColumnGripKind | null {
  if (axis === 'x') return 'column-width';
  if (axis === 'z') return 'column-depth';
  return null;
}

/**
 * Column resize → new `ColumnParams`, or `null` for a no-op drag.
 *
 * Axis-Y mirrors the wall (ADR-401 F.3, Revit-standard top/base faces):
 *   • mode 'normal' (TOP octahedron) → `height` (top face moves, base fixed).
 *   • mode 'mirror' (BASE octahedron below it) → `baseOffset` (base face moves),
 *     with an inverse `height` adjustment so the TOP stays put.
 * Dragging a side attached to a structural host DETACHES it first (Revit "edit
 * breaks attach", Giorgio-confirmed) — reusing the generic `detachEntitySide` SSoT.
 *
 * Axis-X/Z → width / depth via the 2D `applyColumnGripDrag` SSoT (returns the
 * original params referentially on a no-op, e.g. depth on a circular column).
 */
export function computeColumnResizeParams(
  params: ColumnParams,
  drag: ResizeDragMm,
): ColumnParams | null {
  if (drag.axis === 'y') {
    if (drag.deltaUpMm === 0) return null;
    if (drag.mode === 'mirror') {
      // BASE grip: base += Δ, height -= Δ (keep top fixed).
      const base = isEntitySideAttached(params, 'base') ? detachEntitySide(params, 'base') : params;
      const baseOffset = base.baseOffset + drag.deltaUpMm;
      const height = clampMin(base.height - drag.deltaUpMm, MIN_BIM_HEIGHT_MM);
      return base === params && baseOffset === params.baseOffset && height === params.height
        ? null
        : { ...base, baseOffset, height };
    }
    // TOP grip: height += Δ (base fixed).
    const top = isEntitySideAttached(params, 'top') ? detachEntitySide(params, 'top') : params;
    const height = clampMin(top.height + drag.deltaUpMm, MIN_BIM_HEIGHT_MM);
    return top === params && height === params.height ? null : { ...top, height };
  }
  const gripKind = columnGripFor(drag.axis);
  if (!gripKind) return null;
  const delta = toCanvasDelta(drag.deltaMm, mmScaleFor(params));
  const next = applyColumnGripDrag(gripKind, { originalParams: params, delta });
  return next === params ? null : next;
}

// ─── Wall ────────────────────────────────────────────────────────────────────

/**
 * Wall resize → new `WallParams`.
 *
 * Axis-Y has TWO grips (ADR-401 E.3, Revit-standard top/base faces):
 *   • mode 'normal' (TOP octahedron) → `height` (top face moves, base fixed).
 *   • mode 'mirror' (BASE octahedron below it) → `baseOffset` (base face moves),
 *     with an inverse `height` adjustment so the TOP stays put for height-driven
 *     walls (and the resolver pins it anyway for storey-ceiling / attached tops).
 * Dragging a side that is attached to a structural host DETACHES it first (Revit
 * "edit breaks attach", Giorgio-confirmed) — reusing the `detachWallSide` SSoT.
 *
 * Axis-X/Z → thickness (relative ±2·perpComponent, see file NOTE).
 * `null` for a no-op / degenerate axis.
 */
export function computeWallResizeParams(
  params: WallParams,
  drag: ResizeDragMm,
): WallParams | null {
  if (drag.axis === 'y') {
    if (drag.deltaUpMm === 0) return null;
    if (drag.mode === 'mirror') {
      // BASE grip: base += Δ, height -= Δ (keep top fixed).
      const base = isWallSideAttached(params, 'base') ? detachWallSide(params, 'base') : params;
      const baseOffset = base.baseOffset + drag.deltaUpMm;
      const height = clampMin(base.height - drag.deltaUpMm, MIN_BIM_HEIGHT_MM);
      return base === params && baseOffset === params.baseOffset && height === params.height
        ? null
        : { ...base, baseOffset, height };
    }
    // TOP grip: height += Δ (base fixed).
    const top = isWallSideAttached(params, 'top') ? detachWallSide(params, 'top') : params;
    const height = clampMin(top.height + drag.deltaUpMm, MIN_BIM_HEIGHT_MM);
    return top === params && height === params.height ? null : { ...top, height };
  }
  const axis = unitVector(params.start, params.end);
  if (!axis) return null; // degenerate wall (start === end)
  const perp = perpUnit(axis);
  // Perpendicular component of the plan slide (mm — `deltaMm` and `perp` unit are
  // both in the DXF-plan frame). Thickness is stored in mm, so no scaling.
  const perpMm = drag.deltaMm.x * perp.x + drag.deltaMm.y * perp.y;
  if (perpMm === 0) return null;
  const thickness = clamp(params.thickness + 2 * perpMm, MIN_WALL_THICKNESS_MM, MAX_WALL_THICKNESS_MM);
  if (thickness === params.thickness) return null;
  // Manual thickness override drops DNA so the validator does not fire
  // `dnaThicknessMismatch` (parity with the 2D `resizeThickness` / ribbon path).
  const { dna: _dropped, ...rest } = params;
  return { ...rest, thickness };
}

// ─── Beam ────────────────────────────────────────────────────────────────────

/**
 * Beam resize → new `BeamParams`. Axis-Y → depth (structural depth, the vertical
 * cross-section dimension); axis-X/Z → width via the 2D `beam-width` grip SSoT.
 * `null` for a no-op / degenerate axis.
 */
export function computeBeamResizeParams(
  params: BeamParams,
  drag: ResizeDragMm,
): BeamParams | null {
  if (drag.axis === 'y') {
    const depth = clampMin(params.depth + drag.deltaUpMm, MIN_BEAM_DEPTH_MM);
    return depth === params.depth ? null : { ...params, depth };
  }
  // `resizeWidth` adds `delta·perp` directly to the mm width → pass the mm delta.
  // A parallel-to-axis drag projects to perp 0 → `resizeWidth` returns a fresh
  // object with the SAME width (it does not short-circuit referentially like the
  // column grip does), so we treat an unchanged width as a no-op (`null`).
  const next = applyBeamGripDrag('beam-width', { originalParams: params, delta: drag.deltaMm });
  return next === params || next.width === params.width ? null : next;
}

// ─── Slab ────────────────────────────────────────────────────────────────────

/**
 * Slab resize → new `SlabParams`. Only axis-Y is supported (thickness); the
 * footprint is edited per-vertex in 2D (Revit-standard, ADR-402 Phase B). `null`
 * for a plan axis or a no-op vertical drag.
 */
export function computeSlabResizeParams(
  params: SlabParams,
  drag: ResizeDragMm,
): SlabParams | null {
  if (drag.axis !== 'y') return null;
  const thickness = clampMin(params.thickness + drag.deltaUpMm, MIN_SLAB_THICKNESS_MM);
  return thickness === params.thickness ? null : { ...params, thickness };
}

// ─── Stair ─────────────────────────────────────────────────────────────────────

/**
 * Stair axis-Y resize (ADR-401 Phase G.3 — Revit «Desired number of risers»). TOP
 * grip grows `totalRise`; BASE grip lifts the base (top fixed) so `totalRise`
 * shrinks. Both re-step via the shared whole-step snap SSoT (`snapTotalRiseToWholeSteps`
 * — same formula as the attach resolver) and DETACH the affected side first if it
 * was attached. `null` = no-op / degenerate (non-positive resulting totalRise).
 */
function computeStairVerticalResize(
  params: StairParams,
  deltaUpMm: number,
  mode: GizmoResizeMode,
): StairParams | null {
  if (deltaUpMm === 0) return null;
  if (mode === 'mirror') {
    // BASE grip: base += Δ, totalRise -= Δ (top fixed).
    const base = isStairSideAttached(params, 'base') ? detachStairSide(params, 'base') : params;
    const newTotalRise = base.totalRise - deltaUpMm;
    if (!(newTotalRise > 0) || base.rise <= 0) return null;
    const snap = snapTotalRiseToWholeSteps(newTotalRise, base.rise);
    return {
      ...base,
      basePoint: { ...base.basePoint, z: base.basePoint.z + deltaUpMm },
      totalRise: snap.totalRise,
      stepCount: snap.stepCount,
      rise: snap.rise,
    };
  }
  // TOP grip: totalRise += Δ (base fixed).
  const top = isStairSideAttached(params, 'top') ? detachStairSide(params, 'top') : params;
  const newTotalRise = top.totalRise + deltaUpMm;
  if (!(newTotalRise > 0) || top.rise <= 0) return null;
  const snap = snapTotalRiseToWholeSteps(newTotalRise, top.rise);
  return {
    ...top,
    totalRise: snap.totalRise,
    stepCount: snap.stepCount,
    rise: snap.rise,
  };
}

/**
 * Stair plan resize → new `StairParams`, reusing the 2D grip-drag SSoT
 * (`applyStairGripDrag`). ADR-402 Sub-Phase 1.
 *
 * Unlike the box elements above, a stair has TWO in-plane dimensions, so a single
 * world handle cannot map 1:1 to one of them. We project the plan slide onto the
 * stair's LOCAL frame and let the DOMINANT component drive a single dimension
 * (predictable: one drag → one dimension):
 *   • perpendicular to the climb direction → `width` (symmetric, ×2 — `resizeWidth`).
 *   • along the climb direction → `totalRun`, SNAPPED to whole steps: `stepCount`
 *     changes while `tread` stays constant (`resizeLength` — the Revit "drag the run
 *     to add / remove risers" behaviour, NOT a free stretch).
 *
 * Frame / units (the crux): `resizeWidth`/`resizeLength` are ABSOLUTE-frame — they
 * read `currentPos` relative to `basePoint` in the stair's own numeric (drawing-unit)
 * space, the same space the geometry builder consumes `width`/`tread`/`totalRun` in.
 * The gizmo resize handle sits at a screen-constant offset along a WORLD axis, NOT on
 * the stair edge, so — exactly like the wall-thickness NOTE at the top of this file —
 * an absolute read would make the dimension jump to the handle distance. We instead
 * rebuild a RELATIVE drag the way `commitStairGripDrag` does (`currentPos = anchor +
 * delta`): the anchor is derived with the SAME formula each transform inverts
 * (`base ± dim`), and the mm slide is converted into the stair's drawing-unit space
 * via the stair grip SSoT factor (`mmToSceneUnits(inferSceneUnitsFromWidth)`), so it
 * is scene-correct in mm / cm / m drawings alike.
 *
 * Vertical (axis-Y) — ADR-401 Phase G.3 (Revit «Desired number of risers»): dragging
 * the TOP/BASE octahedron changes the **step COUNT** to reach the new height with
 * equal risers (the whole-step snap SSoT `snapTotalRiseToWholeSteps`, shared with the
 * attach resolver — no duplicate formula), NOT a free riser-height stretch:
 *   • mode 'normal' (TOP) → top face moves, base fixed → `totalRise += Δ` → re-step.
 *   • mode 'mirror' (BASE) → base face moves, top fixed → `basePoint.z += Δ`,
 *     `totalRise -= Δ` → re-step.
 * Dragging a side attached to a structural host DETACHES it first (Revit "edit breaks
 * attach", `detachStairSide`).
 */
export function computeStairResizeParams(
  entity: StairEntity,
  drag: ResizeDragMm,
): StairParams | null {
  if (drag.axis === 'y') return computeStairVerticalResize(entity.params, drag.deltaUpMm, drag.mode);
  const params = entity.params;
  const u = directionToUnitVector(params.direction);
  const p = stairPerp(u);
  const axialMm = drag.deltaMm.x * u.x + drag.deltaMm.y * u.y;
  const perpMm = drag.deltaMm.x * p.x + drag.deltaMm.y * p.y;
  if (axialMm === 0 && perpMm === 0) return null;
  const gripKind: StairGripKind =
    Math.abs(axialMm) >= Math.abs(perpMm) ? 'stair-length' : 'stair-width';
  // mm slide → stair drawing-unit space (matches getStairGrips' own conversion).
  const scenePerMm = mmToSceneUnits(inferSceneUnitsFromWidth(params.width));
  const deltaScene: Point2D = { x: drag.deltaMm.x * scenePerMm, y: drag.deltaMm.y * scenePerMm };
  const base: Point2D = { x: params.basePoint.x, y: params.basePoint.y };
  const anchor: Point2D =
    gripKind === 'stair-length'
      ? { x: base.x + params.totalRun * u.x, y: base.y + params.totalRun * u.y }
      : { x: base.x + (params.width / 2) * p.x, y: base.y + (params.width / 2) * p.y };
  const currentPos: Point2D = { x: anchor.x + deltaScene.x, y: anchor.y + deltaScene.y };
  const next = applyStairGripDrag(gripKind, {
    originalParams: params,
    delta: deltaScene,
    currentPos,
    geometry: entity.geometry,
  });
  // `resizeWidth`/`resizeLength` always return a FRESH object (no referential
  // short-circuit), so a sub-step drag that snaps to the same run — or a width
  // pinned at its floor — would still register an empty undo step. Treat a value-
  // identical result on the resize fields (width / run / stepCount) as a no-op.
  if (
    next === params ||
    (next.width === params.width &&
      next.stepCount === params.stepCount &&
      next.totalRun === params.totalRun)
  ) {
    return null;
  }
  return next;
}
