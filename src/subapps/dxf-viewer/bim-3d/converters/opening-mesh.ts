/**
 * Parametric 3D Opening Mesh (ADR-421 §A6).
 *
 * Χτίζει το ΙΔΙΟ το κούφωμα σε 3D (κάσα + φύλλο/-α + υαλοστάσιο) μέσα στο wall
 * void που ήδη ανοίγει το `wall-opening-extrude.ts`. Μέχρι το ADR-421 το 3D ήταν
 * kind-agnostic (μόνο ορθογώνιο κενό)· εδώ προστίθεται το πραγματικό σώμα.
 *
 * Units convention — ΤΑΥΤΟΣΗΜΗ με `wall-opening-extrude.ts` ώστε το mesh να
 * συμπίπτει με το cutout:
 *   - οριζόντια (κατά τον άξονα + πάχος): `value(mm) × mmFactor`, scene-units ως meters
 *   - κατακόρυφα (sill / height): `value(mm) × MM_TO_M` (meters)
 *   - placement: `geometry.position` (scene-units ως meters), `floorY` ίδιο με wall
 *
 * Pure / side-effect free. Επιστρέφει `THREE.Group` (ή null σε degenerate input).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-421-bim-opening-types-revit-grade.md §A6
 */

import * as THREE from 'three';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import {
  buildLeafSpecs,
  type BoxSpec,
  type OpeningMeshMaterials,
} from './opening-mesh-builders';

export type { OpeningMeshMaterials };

const MM_TO_M = 0.001;
/** Default κάσα (mm) όταν λείπει `frameWidth`. */
const DEFAULT_FRAME_MM = 50;

/**
 * Build the parametric 3D mesh for a single opening hosted by `hostWall`.
 * Returns null when geometry/dimensions are degenerate.
 */
export function buildOpeningMesh(
  opening: OpeningEntity,
  hostWall: WallEntity,
  materials: OpeningMeshMaterials,
  floorElevationMm: number,
  buildingBaseElevationM: number,
): THREE.Group | null {
  const { width, height, sillHeight } = opening.params;
  if (width <= 0 || height <= 0) return null;
  const pos = opening.geometry?.position;
  if (!pos) return null;

  const mmFactor = mmToSceneUnits(hostWall.params.sceneUnits ?? 'mm');
  const widthW = width * mmFactor;
  const thicknessW = hostWall.params.thickness * mmFactor;
  const frameW = (opening.params.frameWidth ?? DEFAULT_FRAME_MM) * mmFactor;
  const heightM = height * MM_TO_M;
  const sillM = sillHeight * MM_TO_M;
  const floorY = floorElevationMm * MM_TO_M + buildingBaseElevationM;

  const specs: BoxSpec[] = [
    ...frameBars(widthW, heightM, sillM, thicknessW, frameW, sillHeight > 0, materials.frame),
    ...buildLeafSpecs(opening, { widthW, heightM, sillM, thicknessW, frameW }, materials),
  ];
  if (specs.length === 0) return null;

  const basis = makeBasis(opening.geometry.rotation);
  const group = new THREE.Group();
  for (const s of specs) group.add(makeBoxMesh(s, basis, opening.id));
  group.position.set(pos.x, floorY, -pos.y);
  group.userData['bimId'] = opening.id;
  group.userData['bimType'] = 'opening';
  return group;
}

/** Basis: local +X = host-axis direction (DXF y → world -z), +Y = up, +Z = perp. */
function makeBasis(rotation: number): THREE.Matrix4 {
  const xAxis = new THREE.Vector3(Math.cos(rotation), 0, -Math.sin(rotation));
  const yAxis = new THREE.Vector3(0, 1, 0);
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
  return new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
}

function makeBoxMesh(s: BoxSpec, basis: THREE.Matrix4, bimId: string): THREE.Mesh {
  const geo = new THREE.BoxGeometry(
    Math.max(s.sx, 1e-4), Math.max(s.sy, 1e-4), Math.max(s.sz, 1e-4),
  );
  geo.translate(s.cx, s.cy, s.cz);
  geo.applyMatrix4(basis);
  const mesh = new THREE.Mesh(geo, s.mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData['bimId'] = bimId;
  mesh.userData['bimType'] = 'opening';
  return mesh;
}

/** Κάσα: 2 παραστάδες (jambs) + πρέκι (head) + (παράθυρα) ποδιά (sill). */
function frameBars(
  widthW: number, heightM: number, sillM: number, thicknessW: number,
  frameW: number, hasSill: boolean, mat: THREE.Material,
): BoxSpec[] {
  const cyMid = sillM + heightM / 2;
  const halfW = widthW / 2;
  const bars: BoxSpec[] = [
    { cx: -(halfW - frameW / 2), cy: cyMid, cz: 0, sx: frameW, sy: heightM, sz: thicknessW, mat },
    { cx: halfW - frameW / 2, cy: cyMid, cz: 0, sx: frameW, sy: heightM, sz: thicknessW, mat },
    { cx: 0, cy: sillM + heightM - frameW / 2, cz: 0, sx: widthW, sy: frameW, sz: thicknessW, mat },
  ];
  if (hasSill) {
    bars.push({ cx: 0, cy: sillM + frameW / 2, cz: 0, sx: widthW, sy: frameW, sz: thicknessW, mat });
  }
  return bars;
}
