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
