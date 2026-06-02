/**
 * bim3d-edit-math.ts — SSoT coordinate bridge for 3D BIM element editing.
 *
 * ADR-402 Phase 1. Pure functions — no React, no Three.js scene mutations.
 *
 * The 3D edit gizmos translate a pointer drag in Three.js world space into the
 * 2D `Point2D` (mm) deltas that the existing, view-agnostic commands
 * (`MoveEntityCommand`, `RotateEntityCommand`, the parametric `commit*GripDrag`
 * helpers) already understand. This module is the ONLY place that performs that
 * world↔DXF delta conversion, so the move hook and the rotate hook never
 * duplicate the sign/scale math.
 *
 * Coordinate convention (see coordinate-transforms.ts):
 *   DXF plan  — x = east (mm), y = north (mm), z = elevation (mm)
 *   3D world  — x = east (m),  y = elevation (m), z = -north (m), Y-up
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { mmToSceneUnits, mmScaleFor, inferSceneUnitsFromWidth } from '../../utils/scene-units';

const MM_TO_M = 0.001;
const M_TO_MM = 1000;

/**
 * The horizontal work-plane for a floor at the given elevation, in world space.
 *
 * Normal is world Y-up `(0, 1, 0)`; the plane passes through `y = floorElevationMm`.
 * Used as the drag-projection plane for whole-entity move and for rotate-about-Y,
 * so dragged positions stay on the element's floor instead of drifting in depth
 * (which a camera-aligned plane would allow).
 *
 * @param floorElevationMm — floor elevation in mm (0 in single-floor mode).
 */
export function computeFloorPlane(floorElevationMm: number): THREE.Plane {
  // THREE.Plane(normal, constant) where the plane is { p : normal·p + constant = 0 }.
  // For a Y-up plane at height h (metres): y - h = 0  →  constant = -h.
  const elevationM = floorElevationMm * MM_TO_M;
  return new THREE.Plane(new THREE.Vector3(0, 1, 0), -elevationM);
}

/**
 * Convert a world-space drag (start → end) into a DXF plan delta in mm.
 *
 * Only the horizontal components matter for a floor-plane move:
 *   Δx_mm = (end.x − start.x) · 1000
 *   Δy_mm = −(end.z − start.z) · 1000   (world Z = −DXF north, hence the flip)
 *
 * The vertical (world Y) component is intentionally ignored — elevation edits go
 * through dedicated height handles, not the floor-plane move.
 */
export function worldDeltaToDxfDelta(
  worldStart: THREE.Vector3,
  worldEnd: THREE.Vector3,
): Point2D {
  return {
    x: (worldEnd.x - worldStart.x) * M_TO_MM,
    y: -(worldEnd.z - worldStart.z) * M_TO_MM,
  };
}

/**
 * Convert a world-space drag (start → end) into a vertical (elevation) delta in mm.
 *
 *   Δup_mm = (end.y − start.y) · 1000   (world Y-up = DXF z = elevation)
 *
 * The counterpart of {@link worldDeltaToDxfDelta} for the ONE case that needs the
 * vertical component: gizmo axis-Y resize (height / depth / thickness) and future
 * elevation edits. Horizontal (move / plan-resize) paths ignore world Y; this is
 * the SSoT for the world-Y → mm conversion so the sign/scale lives in one place.
 */
export function worldUpDeltaToMm(
  worldStart: THREE.Vector3,
  worldEnd: THREE.Vector3,
): number {
  return (worldEnd.y - worldStart.y) * M_TO_MM;
}

/**
 * Factor that converts a plan value expressed in **mm** (what
 * {@link worldDeltaToDxfDelta} / `worldToDxfPlan` produce) into an entity's
 * NATIVE parameter units. A pure scale about the shared origin, so it applies to
 * both a delta (move) and a position (rotate pivot) alike — a 3D gizmo gesture
 * then transforms the entity by the right amount.
 *
 * - wall / column / beam / slab carry an optional `sceneUnits` field: their
 *   `start`/`end`/`position`/`outline` plan coords live in the drawing's CANVAS
 *   units (mm only when `sceneUnits` is mm — a meter/cm DXF stores them in m/cm).
 *   → factor `mmScaleFor(params)` = `mmToSceneUnits(sceneUnits ?? 'mm')`. An mm
 *   scene resolves to `1` (byte-for-byte the old behaviour, zero regression); a
 *   meter scene resolves to `0.001`. WITHOUT this, the mm gizmo delta/pivot is
 *   applied verbatim to a meter-scale entity → a 1000× off-screen fling on every
 *   3D move/rotate in a non-mm drawing (ADR-402/404 "vanish" root cause, fixed
 *   2026-06-01 — the entity rendered fine but landed kilometres away).
 * - **stairs** (ADR-358) store geometry + `basePoint` in **inferred drawing
 *   units** (`StairToThreeConverter` derives `sceneToM` from
 *   `inferSceneUnitsFromWidth`) → factor `mmToSceneUnits(inferSceneUnitsFromWidth(width))`,
 *   the SAME factor `getStairGrips` and the Sub-Phase 1 resize bridge use. Without
 *   it the shared `moveStair` / `rotateEntity` SSoT (which in 2D already receive
 *   drawing-unit inputs) over-transform a stair by 1/sceneToM in non-mm drawings
 *   (ADR-402 fix).
 */
export function mmToEntityUnitFactor(entity: Entity): number {
  if (entity.type === 'stair') {
    return mmToSceneUnits(inferSceneUnitsFromWidth(entity.params.width));
  }
  if (
    entity.type === 'wall' ||
    entity.type === 'column' ||
    entity.type === 'beam' ||
    entity.type === 'slab' ||
    // ADR-406 / ADR-408 Φ3 — point-based MEP hosts also carry `params.sceneUnits`;
    // without this their meter-scene gizmo move delta is 1000× off (entity flies
    // away then snaps back on resync). Same fix as the structural types above.
    entity.type === 'mep-fixture' ||
    entity.type === 'electrical-panel'
  ) {
    return mmScaleFor(entity.params);
  }
  return 1;
}
