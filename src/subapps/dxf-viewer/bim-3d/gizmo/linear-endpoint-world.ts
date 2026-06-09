/**
 * linear-endpoint-world.ts — SSoT for the world-space positions of a STRUCTURAL
 * linear element's two axis endpoints, for the 3D gizmo length shape-handles
 * (ADR-408 Φ1, Revit «drag the end → the wall/beam stretches»).
 *
 * Sibling of `segmentAxisEndpointsWorld` (mep-segment-to-mesh.ts) but for the
 * PLANAR structural disciplines (wall / beam): the run is a plan dimension, so the
 * handle drags HORIZONTALLY (the ground plane) and its world Y is a constant —
 * the gizmo anchor's elevation (the element's world box centre). Unlike a pipe the
 * two ends therefore share the SAME Y (no per-endpoint slope): the height is a
 * separate shape-handle / Type parameter, never an end-drag.
 *
 * Coordinate convention (same as every BimToThreeConverter):
 *   DXF plan: X = East, Y = North (canvas scene units)
 *   Three.js world (Y-up): x = East, y = Up, z = −North
 * plan X,Y are scaled canvas→metres via `sceneUnitsToMeters`; the caller supplies
 * the world Y so the handle sits coplanar with the gizmo centre in any building datum.
 *
 * Pure (THREE + scene-units only) — no scene / no store / no command dispatch.
 *
 * @see ../converters/mep-segment-to-mesh.ts — `segmentAxisEndpointsWorld` (free-3D sibling)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ1
 */

import * as THREE from 'three';
import type { Point3D } from '../../bim/types/bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import { sceneUnitsToMeters } from '../../utils/scene-units';

/**
 * ADR-408 Φ1 — world positions of a horizontal linear element's two axis ends (the
 * Revit length shape handles). `start`/`end` are the raw plan endpoints in canvas
 * scene units; `worldY` is the shared handle elevation (the gizmo anchor's Y). plan
 * X → world X, plan Y (north) → world −Z, both scaled canvas→metres.
 */
export function linearEndpointHandleWorld(
  start: Point3D,
  end: Point3D,
  sceneUnits: SceneUnits | undefined,
  worldY: number,
): { startW: THREE.Vector3; endW: THREE.Vector3 } {
  const sceneToM = sceneUnitsToMeters(sceneUnits ?? 'mm');
  return {
    startW: new THREE.Vector3(start.x * sceneToM, worldY, -(start.y * sceneToM)),
    endW: new THREE.Vector3(end.x * sceneToM, worldY, -(end.y * sceneToM)),
  };
}
