/**
 * mep-underfloor-to-three — ADR-408 Εύρος Β #3. Pure converter:
 * `MepUnderfloorEntity` → `THREE.Group` (real radiant-floor serpentine).
 *
 * Revit / 4M-FineHEAT grade: the loop is drawn as the ACTUAL serpentine **pipes**
 * (a swept tube along `entity.geometry.loopPath`, radius = pipe diameter / 2, at the
 * screed elevation) — NOT a flat coloured plate. A faint translucent screed band is
 * kept underneath for context (so the heating area still reads when zoomed out / the
 * loop is degenerate).
 *
 * SSoT: the serpentine is NOT recomputed here — it reuses the params-derived
 * `entity.geometry.loopPath` (`Point3D[]`, **scene-units**, already units-correct
 * after the ADR-422 unit-fix). Empty loopPath (degenerate room) ⇒ band only. The
 * corner polyline is rounded on demand by `buildFilletedUnderfloorPath` (shared with
 * the 2D renderer) so the bends match in plan and 3D.
 *
 * The tube is built with ONE ring per (filleted) vertex via parallel-transport
 * frames — NOT `THREE.TubeGeometry`, which resamples uniformly by arc-length and
 * would skip the short U-turn arcs between the long rows (angular 3D vs smooth 2D).
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
import {
  buildFilletedUnderfloorPath,
  resolveUnderfloorBendRadiusScene,
} from '../../bim/mep-underfloor/mep-underfloor-geometry';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import type { SceneUnits } from '../../utils/scene-units';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { buildShape, extrudeAndRotate, tagMesh, stampBimIdentity } from './bim-three-shape-helpers';

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

/** A perpendicular unit vector to `t` (stable seed for the first transport frame). */
function arbitraryPerpendicular(t: THREE.Vector3): THREE.Vector3 {
  const helper = Math.abs(t.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3().crossVectors(t, helper).normalize();
}

/**
 * Sweep the serpentine loop into a tube, or `null` when there are < 2 distinct points.
 *
 * Builds the tube with **exactly one ring per polyline vertex** (parallel-transport
 * frames), so the geometry honours the input points 1:1. This is deliberately NOT
 * `THREE.TubeGeometry`/`CatmullRom`, which RESAMPLE the curve uniformly by arc-length:
 * with our path (short rounded U-turn arcs between long straight rows) uniform
 * resampling spends nearly all samples on the rows and skips the tiny arcs → the 3D
 * pipe looks angular even though the 2D plan is smooth. One-ring-per-point keeps the
 * arcs (dense points) curved and the rows (sparse points) cheap — WYSIWYG with 2D.
 */
export function buildUnderfloorTubeGeometry(
  rawPoints: readonly THREE.Vector3[],
  radiusM: number,
): THREE.BufferGeometry | null {
  // Drop consecutive duplicates (arc joins can coincide) — zero-length frames break transport.
  const pts: THREE.Vector3[] = [];
  for (const p of rawPoints) {
    if (pts.length === 0 || pts[pts.length - 1]!.distanceToSquared(p) > 1e-12) pts.push(p.clone());
  }
  const n = pts.length;
  if (n < 2) return null;

  const r = Math.max(0.001, radiusM);
  const rs = TUBE_RADIAL_SEGMENTS;

  // Per-vertex tangents (central difference; one-sided at the ends).
  const tangents = pts.map((_, i) =>
    pts[Math.min(n - 1, i + 1)]!.clone().sub(pts[Math.max(0, i - 1)]!).normalize());

  // Parallel-transport the normal along the path to avoid twisting.
  const positions = new Float32Array(n * rs * 3);
  const normalsArr = new Float32Array(n * rs * 3);
  let normal = arbitraryPerpendicular(tangents[0]!);
  for (let i = 0; i < n; i++) {
    const t = tangents[i]!;
    if (i > 0) {
      const prevT = tangents[i - 1]!;
      const axis = new THREE.Vector3().crossVectors(prevT, t);
      const al = axis.length();
      if (al > 1e-6) {
        axis.divideScalar(al);
        const angle = Math.acos(Math.min(1, Math.max(-1, prevT.dot(t))));
        normal.applyAxisAngle(axis, angle);
      }
    }
    // Re-orthogonalise the normal against the current tangent, then derive binormal.
    normal.sub(t.clone().multiplyScalar(normal.dot(t))).normalize();
    const binormal = new THREE.Vector3().crossVectors(t, normal).normalize();
    for (let j = 0; j < rs; j++) {
      const v = (j / rs) * Math.PI * 2;
      const cos = Math.cos(v);
      const sin = Math.sin(v);
      const dirX = cos * normal.x + sin * binormal.x;
      const dirY = cos * normal.y + sin * binormal.y;
      const dirZ = cos * normal.z + sin * binormal.z;
      const o = (i * rs + j) * 3;
      positions[o] = pts[i]!.x + dirX * r;
      positions[o + 1] = pts[i]!.y + dirY * r;
      positions[o + 2] = pts[i]!.z + dirZ * r;
      normalsArr[o] = dirX;
      normalsArr[o + 1] = dirY;
      normalsArr[o + 2] = dirZ;
    }
  }

  // Quad faces between consecutive rings (radial wrap).
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < rs; j++) {
      const jn = (j + 1) % rs;
      const a = i * rs + j;
      const b = i * rs + jn;
      const c = (i + 1) * rs + j;
      const d = (i + 1) * rs + jn;
      index.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normalsArr, 3));
  geo.setIndex(index);
  return geo;
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
  // The corner polyline is filleted (rounded pipe bends) in SCENE units first — the
  // SAME shared helper + radius the 2D renderer uses — then mapped to world metres.
  const filleted = buildFilletedUnderfloorPath(entity.geometry.loopPath, resolveUnderfloorBendRadiusScene(entity.params));
  const points = buildUnderfloorLoopPoints(filleted, sceneToM, screedYm + radiusM);
  const tubeGeo = buildUnderfloorTubeGeometry(points, radiusM);
  if (tubeGeo) {
    const tubeMesh = new THREE.Mesh(tubeGeo, getMaterial3D(UNDERFLOOR_PIPE_MATERIAL_KEY));
    tagMesh(tubeMesh, entity.id, 'mep-underfloor', UNDERFLOOR_PIPE_MATERIAL_KEY, levelId);
    group.add(tubeMesh);
  }

  if (group.children.length === 0) return null;

  // Tag the group itself so picking / V-G resolution on the container works too.
  stampBimIdentity(group, { bimId: entity.id, bimType: 'mep-underfloor', levelId });
  return group;
}
