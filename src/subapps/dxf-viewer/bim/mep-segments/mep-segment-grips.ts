/**
 * ADR-408 Φ8 — MEP segment parametric grip positions.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Mirrors
 * `bim/beams/beam-grips.ts` — a segment is a linear 2-click element
 * (start / end / midpoint / section-size handle), exactly like a beam.
 *
 * Grips:
 *   0 → `mep-segment-start`    → translate axis start endpoint.
 *   1 → `mep-segment-end`      → translate axis end endpoint.
 *   2 → `mep-segment-midpoint` → translate whole segment (both endpoints).
 *   3 → `mep-segment-section`  → section-width dimension handle, perpendicular
 *                                 to the axis at midpoint (beam `beam-width` pattern).
 *                                 Skipped on degenerate (zero-length) axis.
 *   4 → `mep-segment-rotation` → rotation handle at 75% along axis (beam-rotation
 *                                 pattern; curved ROTATION glyph + 6-click hot-grip).
 *                                 Skipped on degenerate axis.
 *
 * @see bim/beams/beam-grips.ts — structural template
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, MepSegmentGripKind } from '../../hooks/grip-types';
import type { MepSegmentEntity, MepSegmentParams } from '../types/mep-segment-types';
import { resolveSegmentSection, MIN_SEGMENT_DIMENSION_MM, isSegmentVertical } from '../types/mep-segment-types';
import { project2D, perpUnit, unitVector, rotateAxisPointsAboutPivot } from '../grips/grip-math';
import { translatePoint3D } from '../../rendering/entities/shared/geometry-vector-utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function axisMidpoint2D(params: MepSegmentParams): Point2D {
  return {
    x: (params.startPoint.x + params.endPoint.x) / 2,
    y: (params.startPoint.y + params.endPoint.y) / 2,
  };
}

/**
 * Section-width handle position: axis midpoint offset by `widthMm/2` along the
 * CCW-perpendicular of the axis unit vector. Mirrors `beamWidthHandlePosition`.
 * Returns null when the axis is degenerate (start === end) or section width
 * is below `MIN_SEGMENT_DIMENSION_MM`.
 */
export function segmentSectionHandlePosition(params: MepSegmentParams): Point2D | null {
  const u = unitVector(params.startPoint, params.endPoint);
  if (!u) return null;
  const section = resolveSegmentSection(params);
  if (section.widthMm < MIN_SEGMENT_DIMENSION_MM) return null;
  const p = perpUnit(u);
  const mid = axisMidpoint2D(params);
  // Mirror of beamWidthHandlePosition: use widthMm / 2 as the perpendicular offset,
  // which is correct for the default sceneUnits='mm' scene (canvas unit = 1 mm).
  const halfWidthCanvas = section.widthMm / 2;
  return {
    x: mid.x + halfWidthCanvas * p.x,
    y: mid.y + halfWidthCanvas * p.y,
  };
}

// ─── Grip list ────────────────────────────────────────────────────────────────

/**
 * Compute parametric grips for a `MepSegmentEntity`. Index order is stable so
 * `gripIndex` is a deterministic identifier during drag.
 */
export function getMepSegmentGrips(entity: Readonly<MepSegmentEntity>): GripInfo[] {
  const { params } = entity;

  // ADR-408 Φ15 — a VERTICAL riser (κατακόρυφη στήλη) projects to a SINGLE plan
  // point: its start/end share X,Y (they differ only in Z). Emitting the usual
  // start/end/midpoint grips would stack all three on that one pixel, and a
  // start/end drag would pull a single endpoint off-axis — destroying the riser
  // (it stops being vertical → the plan symbol disappears). In plan a riser is a
  // point object (Revit): expose ONE move grip that translates the whole stack,
  // keeping the Z-span intact (`moveMidpoint` shifts both endpoints by the same
  // ΔX,ΔY). Section/rotation grips are meaningless on a zero-length plan axis.
  if (isSegmentVertical(params)) {
    return [{
      entityId: entity.id,
      gripIndex: 0,
      type: 'center',
      position: project2D(params.startPoint),
      movesEntity: true,
      gripKind: { on: 'mep-segment', kind: 'mep-segment-midpoint' },
    }];
  }

  const grips: GripInfo[] = [];

  const start = project2D(params.startPoint);
  const end = project2D(params.endPoint);

  // 0 — axis start endpoint
  grips.push({
    entityId: entity.id,
    gripIndex: 0,
    type: 'vertex',
    position: start,
    movesEntity: false,
    gripKind: { on: 'mep-segment', kind: 'mep-segment-start' },
  });

  // 1 — axis end endpoint
  grips.push({
    entityId: entity.id,
    gripIndex: 1,
    type: 'vertex',
    position: end,
    movesEntity: false,
    gripKind: { on: 'mep-segment', kind: 'mep-segment-end' },
  });

  // 2 — axis midpoint (whole-entity translate / MOVE). ADR-363 Φ1G.5 Slice 2: no
  // longer emitted on a HORIZONTAL segment — Alt+drag from start / end / section /
  // rotation moves the whole segment (declutter). gripIndex 2 left unused (the
  // section/rotation indices below depend on `sectionPos`, not on this gap).
  // NOTE: the VERTICAL riser branch above KEEPS its move grip — it is the riser's
  // ONLY affordance (a plan point object), and Alt+drag itself needs a grip to
  // grab. The `mep-segment-midpoint` transform (`moveMidpoint`) stays (riser + hot-grip).

  // 3 — section-width dimension handle (skip on degenerate axis)
  const sectionPos = segmentSectionHandlePosition(params);
  if (sectionPos) {
    grips.push({
      entityId: entity.id,
      gripIndex: 3,
      type: 'edge',
      position: sectionPos,
      movesEntity: false,
      gripKind: { on: 'mep-segment', kind: 'mep-segment-section' },
    });
  }

  // 4 — rotation handle at 75% along axis (beam-rotation pattern)
  const u = unitVector(params.startPoint, params.endPoint);
  if (u) {
    grips.push({
      entityId: entity.id,
      gripIndex: sectionPos ? 4 : 3,
      type: 'vertex',
      position: {
        x: start.x + 0.75 * (end.x - start.x),
        y: start.y + 0.75 * (end.y - start.y),
      },
      movesEntity: false,
      gripKind: { on: 'mep-segment', kind: 'mep-segment-rotation' },
    });
  }

  return grips;
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface MepSegmentGripDragInput {
  /** Original params at drag start. */
  readonly originalParams: MepSegmentParams;
  /** World-space delta from drag anchor to current cursor. */
  readonly delta: Point2D;
  /**
   * Current world cursor position — required by `mep-segment-rotation` to
   * compute the swept angle around the pivot. Undefined → rotation no-ops.
   */
  readonly currentPos?: Point2D;
  /**
   * Optional rotation pivot for `mep-segment-rotation`. When set the segment
   * rotates around this point; undefined → uses the axis midpoint.
   */
  readonly pivot?: Point2D;
}

/**
 * Pure transform: segment grip kind + drag input → new `MepSegmentParams`.
 * Geometry is NOT recomputed here — the caller (`UpdateMepSegmentParamsCommand`)
 * calls `computeMepSegmentGeometry()` to keep the math SSoT clean.
 *
 * Zero delta or unknown kind → returns `originalParams` referentially unchanged
 * so the caller can short-circuit the commit.
 */
export function applyMepSegmentGripDrag(
  gripKind: MepSegmentGripKind,
  input: Readonly<MepSegmentGripDragInput>,
): MepSegmentParams {
  if (input.delta.x === 0 && input.delta.y === 0) return input.originalParams;

  switch (gripKind) {
    case 'mep-segment-start':
      return moveStart(input);
    case 'mep-segment-end':
      return moveEnd(input);
    case 'mep-segment-midpoint':
      return moveMidpoint(input);
    case 'mep-segment-section':
      return resizeSection(input);
    case 'mep-segment-rotation':
      return rotateSegment(input);
    default:
      return input.originalParams;
  }
}

// ─── Transform helpers ────────────────────────────────────────────────────────

function moveStart(input: Readonly<MepSegmentGripDragInput>): MepSegmentParams {
  const { originalParams, delta } = input;
  return {
    ...originalParams,
    startPoint: translatePoint3D(originalParams.startPoint, delta),
  };
}

function moveEnd(input: Readonly<MepSegmentGripDragInput>): MepSegmentParams {
  const { originalParams, delta } = input;
  return {
    ...originalParams,
    endPoint: translatePoint3D(originalParams.endPoint, delta),
  };
}

function moveMidpoint(input: Readonly<MepSegmentGripDragInput>): MepSegmentParams {
  const { originalParams, delta } = input;
  return {
    ...originalParams,
    startPoint: translatePoint3D(originalParams.startPoint, delta),
    endPoint: translatePoint3D(originalParams.endPoint, delta),
  };
}

/**
 * Symmetric section resize. The handle sits at `widthMm/2` along the
 * perpendicular; dragging it `d` outward adds `2d` to widthMm (symmetric
 * around the axis). For a round section this resizes the diameter; for a
 * rectangular duct this resizes the plan-width. Height (rectangular) is NOT
 * changed by this grip (it is the out-of-plan dimension, like `beam-depth`).
 * Clamped to `MIN_SEGMENT_DIMENSION_MM`.
 */
function resizeSection(input: Readonly<MepSegmentGripDragInput>): MepSegmentParams {
  const { originalParams, delta } = input;
  const u = unitVector(originalParams.startPoint, originalParams.endPoint);
  if (!u) return originalParams;
  const p = perpUnit(u);
  const deltaPerp = delta.x * p.x + delta.y * p.y;
  const section = resolveSegmentSection(originalParams);

  if (originalParams.sectionKind === 'round') {
    const rawDiameter = section.widthMm + 2 * deltaPerp;
    const clamped = Math.max(MIN_SEGMENT_DIMENSION_MM, rawDiameter);
    return { ...originalParams, diameter: clamped };
  }
  // Rectangular: resize width (plan axis)
  const rawWidth = section.widthMm + 2 * deltaPerp;
  const clamped = Math.max(MIN_SEGMENT_DIMENSION_MM, rawWidth);
  return { ...originalParams, width: clamped };
}

/**
 * Rotate the segment (startPoint + endPoint) about a picked centre or the
 * axis midpoint. Mirror of `rotateBeam` in beam-grips.ts — anchor-relative
 * swept angle via `rotateAxisPointsAboutPivot` SSoT.
 * Returns `originalParams` unchanged when `currentPos` is absent or the
 * swept angle is degenerate (cursor on the pivot).
 */
function rotateSegment(input: Readonly<MepSegmentGripDragInput>): MepSegmentParams {
  const { originalParams, delta, currentPos, pivot } = input;
  if (!currentPos) return originalParams;

  // Anchor-relative swept-angle rotation via the shared SSoT (mirrors beam-grips
  // rotateBeam — delegates to rotateAxisPointsAboutPivot, NEVER raw cos/sin).
  const centre: Point2D = pivot ?? axisMidpoint2D(originalParams);
  const anchor: Point2D = { x: currentPos.x - delta.x, y: currentPos.y - delta.y };
  const pts: Point2D[] = [
    project2D(originalParams.startPoint),
    project2D(originalParams.endPoint),
  ];
  const rotated = rotateAxisPointsAboutPivot(pts, { pivot: centre, anchor, currentPos });
  if (!rotated) return originalParams;

  return {
    ...originalParams,
    startPoint: { x: rotated[0].x, y: rotated[0].y, z: originalParams.startPoint.z ?? 0 },
    endPoint:   { x: rotated[1].x, y: rotated[1].y, z: originalParams.endPoint.z ?? 0 },
  };
}
