/**
 * mep-underfloor-to-three — ADR-408 Εύρος Β #3. Pure converter:
 * `MepUnderfloorEntity` → `THREE.Group` (real radiant-floor serpentine).
 *
 * Revit / 4M-FineHEAT grade: the loop is drawn as the ACTUAL serpentine **pipes**
 * (a swept `TubeGeometry` along `entity.geometry.loopPath`, radius = pipe
 * diameter / 2, at the screed elevation) — NOT a flat coloured plate. A faint
 * translucent screed band is kept underneath for context (so the heating area
 * still reads when zoomed out / the loop is degenerate).
 *
 * SSoT: the serpentine is NOT recomputed here — it reuses the params-derived
 * `entity.geometry.loopPath` (`Point3D[]`, **scene-units**, already units-correct
 * after the ADR-422 unit-fix). Empty loopPath (degenerate room) ⇒ band only.
 *
 * **UNITS-SAFE** (same pattern as `mep-wire-to-three.ts` / `mep-segment-to-mesh.ts`):
 *   - canvas-unit XY → Three.js world metres via `sceneUnitsToMeters(units)`
 *   - mm screedOffset / pipe diameter → metres via `MM_TO_M`
 *
 * Coordinate convention (see BimToThreeConverter header):
 *   DXF plan: X = East, Y = North → Three.js world x = East, y = Up, z = -North.
 * The band uses `extrudeAndRotate` (XY→XZ); the tube maps each loop point to
 * `(x·sceneToM, screedY, -y·sceneToM)` — the same axis mapping, made explicit.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see bim-3d/converters/mep-wire-to-three.ts — the polyline→TubeGeometry template
 */

import * as THREE from 'three';
import type { Point3D } from '../../bim/types/bim-base';
import type { MepUnderfloorEntity } from '../../bim/types/mep-underfloor-types';
import { DEFAULT_UNDERFLOOR_CONNECTOR_DIAMETER_MM } from '../../bim/types/mep-underfloor-types';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import type { SceneUnits } from '../../utils/scene-units';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { buildShape, extrudeAndRotate, tagMesh } from './bim-three-shape-helpers';

const MM_TO_M = 0.001;

/** Material key for the faint embedded screed band (warm translucent layer). */
const UNDERFLOOR_BAND_MATERIAL_KEY = 'elem-mep-underfloor';
/** Material key for the serpentine pipes themselves (solid warm-red). */
const UNDERFLOOR_PIPE_MATERIAL_KEY = 'elem-mep-underfloor-pipe';

/** Low side count — many tube metres in a big room; keep the triangle budget sane. */
const TUBE_RADIAL_SEGMENTS = 6;

/**
 * Map a scene-unit loop polyline (XY plane, z ignored) to world-space Three.js
 * points at a fixed screed elevation. Pure helper (testable without a renderer).
 *
 *   world = (x·sceneToM, worldY, -y·sceneToM)   [plan Y = North → world -Z]
 *
 * @param loopPath  The serpentine polyline in scene units (`geometry.loopPath`).
 * @param sceneToM  `sceneUnitsToMeters(units)` for the floor.
 * @param worldY    The pipe-centreline elevation in metres (screed level).
 */
export function buildUnderfloorLoopPoints(
  loopPath: readonly Point3D[],
  sceneToM: number,
  worldY: number,
): THREE.Vector3[] {
  return loopPath.map((p) => new THREE.Vector3(p.x * sceneToM, worldY, -p.y * sceneToM));
}

/**
 * Sweep the serpentine loop into a `TubeGeometry`, or `null` when there are < 2
 * points (nothing to sweep). The polyline is run through a centripetal
 * Catmull-Rom curve so the U-turns read as real pipe bends (no overshoot/cusp at
 * the sharp 180° row reversals, unlike the uniform variant).
 */
export function buildUnderfloorTubeGeometry(
  points: readonly THREE.Vector3[],
  radiusM: number,
): THREE.TubeGeometry | null {
  if (points.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3([...points], false, 'centripetal');
  const tubularSegments = Math.min(4000, Math.max(64, points.length * 6));
  return new THREE.TubeGeometry(curve, tubularSegments, Math.max(0.001, radiusM), TUBE_RADIAL_SEGMENTS, false);
}

/**
 * Convert `MepUnderfloorEntity` → `THREE.Group` (band + serpentine pipes), or
 * `null` when neither can be built (no footprint and no loop).
 *
 * @param entity            - The underfloor heating BIM entity.
 * @param floorElevationMm  - FFL elevation of the containing floor, in mm. The
 *                            screed band bottom + the pipe centreline sit at
 *                            `floorElevationMm + params.screedOffsetMm`.
 * @param levelId           - Optional level ID for V/G visibility tagging.
 * @param buildingBaseM     - Building base elevation in METRES (ADR-369 §9.2 Q2.1).
 */
export function underfloorToObject3D(
  entity: MepUnderfloorEntity,
  floorElevationMm: number,
  levelId?: string,
  buildingBaseM = 0,
): THREE.Object3D | null {
  const { footprint, screedOffsetMm, connectorDiameterMm, sceneUnits } = entity.params;
  const units: SceneUnits = sceneUnits ?? 'mm';
  const sceneToM = sceneUnitsToMeters(units);

  // Screed elevation (m): pipe centreline + band bottom both sit at FFL + screedOffset.
  const screedYm = (floorElevationMm + (screedOffsetMm ?? 0)) * MM_TO_M + buildingBaseM;
  const radiusM = ((connectorDiameterMm ?? DEFAULT_UNDERFLOOR_CONNECTOR_DIAMETER_MM) * MM_TO_M) / 2;

  const group = new THREE.Group();

  // ── Faint screed band (context) — the thin translucent plate, as before. ──────
  if (footprint && footprint.vertices.length >= 3) {
    const scaledVerts = footprint.vertices.map((v) => ({ x: v.x * sceneToM, y: v.y * sceneToM, z: v.z }));
    const shape = buildShape(scaledVerts);
    if (shape) {
      const bandGeo = extrudeAndRotate(shape, radiusM * 2); // band as deep as the pipe
      const bandMesh = new THREE.Mesh(bandGeo, getMaterial3D(UNDERFLOOR_BAND_MATERIAL_KEY));
      bandMesh.position.y = screedYm;
      tagMesh(bandMesh, entity.id, 'mep-underfloor', UNDERFLOOR_BAND_MATERIAL_KEY, levelId);
      group.add(bandMesh);
    }
  }

  // ── Real serpentine pipes (the loop) — swept tube along the params-derived path. ─
  // Pipe centreline sits a radius above the band bottom → the tube rests in the screed.
  const points = buildUnderfloorLoopPoints(entity.geometry.loopPath, sceneToM, screedYm + radiusM);
  const tubeGeo = buildUnderfloorTubeGeometry(points, radiusM);
  if (tubeGeo) {
    const tubeMesh = new THREE.Mesh(tubeGeo, getMaterial3D(UNDERFLOOR_PIPE_MATERIAL_KEY));
    tagMesh(tubeMesh, entity.id, 'mep-underfloor', UNDERFLOOR_PIPE_MATERIAL_KEY, levelId);
    group.add(tubeMesh);
  }

  if (group.children.length === 0) return null;

  // Tag the group itself so picking / V-G resolution on the container works too.
  group.userData['bimId'] = entity.id;
  group.userData['bimType'] = 'mep-underfloor';
  if (levelId !== undefined) group.userData['levelId'] = levelId;
  return group;
}
