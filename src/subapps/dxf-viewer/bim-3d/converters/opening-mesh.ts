/**
 * Parametric 3D Opening Mesh (ADR-421 §A6).
 *
 * Χτίζει το ΙΔΙΟ το κούφωμα σε 3D (κάσα + φύλλο/-α + υαλοστάσιο) μέσα στο wall
 * void που ήδη ανοίγει το `wall-opening-extrude.ts` (wall-hosted). Μέχρι το ADR-421
 * το 3D ήταν kind-agnostic (μόνο ορθογώνιο κενό)· εδώ προστίθεται το πραγματικό σώμα.
 *
 * ADR-615 — δέχεται επίσης self-hosted (free-standing, χωρίς `WallEntity`) ανοίγματα
 * μέσω `OpeningHost` (π.χ. `selfOpeningHost()`)· βλ. JSDoc `buildOpeningMesh` για το
 * honesty statement (χωρίς τοίχο δεν υπάρχει wall-punch, μόνο το σώμα του κουφώματος).
 *
 * Units convention — Three.js world = METRES (ADR-462 parity με το wall path):
 *   - οριζόντια (πλάτος / πάχος / κάσα): `value(mm) × MM_TO_M` — τα `params` είναι
 *     ΠΑΝΤΑ mm, άρα σταθερή μετατροπή σε meters ανεξαρτήτως scene units.
 *   - κατακόρυφα (sill / height): `value(mm) × MM_TO_M` (meters)
 *   - placement: `geometry.position × sceneToM` (scene-units → meters, όπως ο τοίχος
 *     `scalePoints(..., sceneToM)`). ADR-568: πριν χρησιμοποιούσε `mmToSceneUnits` που
 *     έσπαγε σε mm-scenes → σώμα κουφώματος 1000× μακριά/μεγάλο (αόρατο).
 *
 * Pure / side-effect free. Επιστρέφει `THREE.Group` (ή null σε degenerate input).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-421-bim-opening-types-revit-grade.md §A6
 */

import * as THREE from 'three';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { resolveOpeningFrameProfile } from '../../bim/family-types/resolve-opening-frame-profile';
import { resolveOpeningHost, type OpeningHost } from '../../bim/geometry/opening-host';
import { stampBimIdentity } from './bim-three-shape-helpers';
import {
  buildLeafSpecs,
  type BoxSpec,
  type OpeningMeshMaterials,
} from './opening-mesh-builders';

export type { OpeningMeshMaterials };

const MM_TO_M = 0.001;

/**
 * Build the parametric 3D mesh for a single opening.
 *
 * `host` accepts either the real `WallEntity` (wall-hosted opening — the
 * common path) or an `OpeningHost` (ADR-615 self-hosted / free-standing
 * opening, e.g. `selfOpeningHost(opening.params, sceneUnits)`). Both are
 * normalised via `resolveOpeningHost()` — the ONLY two fields this file
 * needs from either provider are `thicknessMm` (leaf depth/offset ratios)
 * and `sceneUnits` (placement scaling); the wall-hosted path stays
 * byte-identical because `wallAsOpeningHost()` reads exactly the same
 * `wall.params.thickness` / `wall.params.sceneUnits` this file used to read
 * directly.
 *
 * Honesty (ADR-615): a self-hosted opening has NO BIM wall, so there is no
 * wall-void to punch/subtract — this function only ever builds the
 * opening's own frame + leaf/panel body from `opening.geometry`
 * (position/rotation/outline/frameOutlines/bbox, all host-less-safe since
 * `computeOpeningGeometry` already normalises the host). The wall-punch
 * cutout (`wall-opening-extrude.ts`) is a SEPARATE, wall-only concern and is
 * simply absent for self-hosted openings — same behaviour as an AutoCAD
 * dynamic block sitting on top of un-cut DXF lines.
 *
 * Returns null when geometry/dimensions are degenerate.
 */
export function buildOpeningMesh(
  opening: OpeningEntity,
  host: WallEntity | OpeningHost,
  materials: OpeningMeshMaterials,
  floorElevationMm: number,
  buildingBaseElevationM: number,
): THREE.Group | null {
  const { width, height, sillHeight } = opening.params;
  if (width <= 0 || height <= 0) return null;
  const pos = opening.geometry?.position;
  if (!pos) return null;

  const resolvedHost = resolveOpeningHost(host);

  // ADR-568 fix — the Three.js world is in METRES. Opening `params` are ALWAYS in
  // mm, so horizontal dims convert with `MM_TO_M`. The placement `geometry.position`
  // is in SCENE UNITS, so it converts with `sceneToM = sceneUnitsToMeters(units)` —
  // exactly like the wall path (`scalePoints(..., sceneToM)`, ADR-462). The previous
  // `mmToSceneUnits` factor only equalled `MM_TO_M` for a metre scene (`units='m'`);
  // in a mm scene (geo-referenced DXF) the body was 1000× oversized AND placed ~1000×
  // too far from the wall → invisible. That is why the 3D door body never showed.
  const sceneToM = sceneUnitsToMeters(resolvedHost.sceneUnits);
  const widthW = width * MM_TO_M;
  // ADR-615 — `thicknessMm` is the host cross-section thickness (real wall thickness
  // for wall-hosted, `selfHost.hostThicknessMm` for self-hosted) — same role either way.
  const thicknessW = resolvedHost.thicknessMm * MM_TO_M;
  // ADR-611 — the κάσα cross-section (faceWidth × depth) is resolved from the
  // catalog/typeParams/instance-overrides chain and is INDEPENDENT of both the
  // opening width/height AND the host wall thickness (zero regression: a legacy
  // opening with only `frameWidth` set resolves to faceWidth = depth = frameWidth).
  const frameProfile = resolveOpeningFrameProfile(opening.params);
  const faceWidthW = frameProfile.faceWidth * MM_TO_M;
  const depthW = frameProfile.depth * MM_TO_M;
  const heightM = height * MM_TO_M;
  const sillM = sillHeight * MM_TO_M;
  const floorY = floorElevationMm * MM_TO_M + buildingBaseElevationM;

  const specs: BoxSpec[] = [
    ...frameBars(widthW, heightM, sillM, faceWidthW, depthW, sillHeight > 0, materials.frame),
    ...buildLeafSpecs(opening, { widthW, heightM, sillM, thicknessW, frameW: faceWidthW }, materials),
  ];
  if (specs.length === 0) return null;

  const basis = makeBasis(opening.geometry.rotation);
  const group = new THREE.Group();
  for (const s of specs) group.add(makeBoxMesh(s, basis, opening.id));
  group.position.set(pos.x * sceneToM, floorY, -pos.y * sceneToM);
  stampBimIdentity(group, { bimId: opening.id, bimType: 'opening' });
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
  stampBimIdentity(mesh, { bimId, bimType: 'opening' });
  return mesh;
}

/**
 * Κάσα: 2 παραστάδες (jambs) + πρέκι (head) + (παράθυρα) ποδιά (sill).
 *
 * ADR-611 — `faceWidthW`/`depthW` are the resolved κάσα cross-section (mm→m),
 * CONSTANT regardless of `widthW`/`heightM` (opening size) and regardless of the
 * host wall thickness. Only the bar LENGTH (jamb spans `heightM`, head/sill span
 * `widthW`) tracks the opening size — the cross-section never does.
 */
function frameBars(
  widthW: number, heightM: number, sillM: number, faceWidthW: number,
  depthW: number, hasSill: boolean, mat: THREE.Material,
): BoxSpec[] {
  const cyMid = sillM + heightM / 2;
  const halfW = widthW / 2;
  const bars: BoxSpec[] = [
    { cx: -(halfW - faceWidthW / 2), cy: cyMid, cz: 0, sx: faceWidthW, sy: heightM, sz: depthW, mat },
    { cx: halfW - faceWidthW / 2, cy: cyMid, cz: 0, sx: faceWidthW, sy: heightM, sz: depthW, mat },
    { cx: 0, cy: sillM + heightM - faceWidthW / 2, cz: 0, sx: widthW, sy: faceWidthW, sz: depthW, mat },
  ];
  if (hasSill) {
    bars.push({ cx: 0, cy: sillM + faceWidthW / 2, cz: 0, sx: widthW, sy: faceWidthW, sz: depthW, mat });
  }
  return bars;
}
