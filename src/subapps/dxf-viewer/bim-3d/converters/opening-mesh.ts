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
import {
  resolveOpeningThreshold,
  type OpeningEntity,
} from '../../bim/types/opening-types';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { resolveOpeningFrameProfile } from '../../bim/family-types/resolve-opening-frame-profile';
import { resolveOpeningHost, type OpeningHost } from '../../bim/geometry/opening-host';
import { stampBimIdentity } from './bim-three-shape-helpers';
import {
  buildLeafSpecs,
  type BoxSpec,
  type LeafDims,
  type OpeningMeshMaterials,
} from './opening-mesh-builders';
import { buildHardwareSpecs } from './opening-hardware-builders';
import {
  frameBarLayout,
  buildFrameProfileMembers,
  type FrameBarLayout,
} from './opening-frame-section-geometry';

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
  finishThicknessMm: number,
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
  // ADR-673 — κατώφλι (door threshold) SSoT. `profileHeightMm` = the resolved frame
  // face width (mm); the resolver returns render:false for windows / any sillHeight>0
  // opening so the bottom bar never double-draws with the existing sill path.
  const profileHeightMm = frameProfile.faceWidth;
  const threshold = resolveOpeningThreshold(opening.params, { finishThicknessMm, profileHeightMm });

  const dims: LeafDims = { widthW, heightM, sillM, thicknessW, frameW: faceWidthW };
  // ADR-676 ΒΗΜΑ 2 — the κάσα skeleton (jamb/head/sill positions) is the SSoT both
  // the box path AND the swept-section path derive from (`frameBarLayout`).
  const layout = frameBarLayout(widthW, heightM, sillM, faceWidthW, sillHeight > 0, threshold);
  const nonFrameSpecs: BoxSpec[] = [
    ...buildLeafSpecs(opening, dims, materials),
    // ADR-672 §8 Α — operable hardware (χειρολαβή) appended LAST so the frame-bar
    // indices (jamb/head/sill) that downstream code reads stay stable.
    ...buildHardwareSpecs(opening, dims, materials.hardware),
  ];

  const basis = makeBasis(opening.geometry.rotation);
  const group = new THREE.Group();
  // Realistic swept κάσα when a section outline resolved; else the constant
  // faceWidth×depth box (zero regression). Leaf/panel + hardware are always boxes.
  addFrameMembers(group, layout, frameProfile.section, faceWidthW, depthW, basis, materials.frame, opening.id);
  for (const s of nonFrameSpecs) group.add(makeBoxMesh(s, basis, opening.id));
  if (group.children.length === 0) return null;

  group.position.set(pos.x * sceneToM, floorY, -pos.y * sceneToM);
  stampBimIdentity(group, { bimId: opening.id, bimType: 'opening' });
  return group;
}

/**
 * Add the κάσα frame members to the group. When the resolved profile carries a
 * `section` outline (≥3 vertices) each member is the swept extrude of that outline
 * (ADR-676 ΒΗΜΑ 2)· otherwise each member is the constant `faceWidth × depth` box
 * (zero regression — byte-identical positions via the shared `frameBarLayout`).
 */
function addFrameMembers(
  group: THREE.Group,
  layout: readonly FrameBarLayout[],
  section: readonly { readonly x: number; readonly y: number }[] | undefined,
  faceWidthW: number,
  depthW: number,
  basis: THREE.Matrix4,
  mat: THREE.Material,
  bimId: string,
): void {
  if (section && section.length >= 3) {
    for (const geo of buildFrameProfileMembers(section, layout)) {
      group.add(finalizeMemberMesh(geo, basis, mat, bimId));
    }
    return;
  }
  for (const bar of layout) {
    group.add(makeBoxMesh(layoutToBoxSpec(bar, faceWidthW, depthW, mat), basis, bimId));
  }
}

/** Map a frame-bar layout entry to the equivalent constant-box spec (legacy path). */
function layoutToBoxSpec(bar: FrameBarLayout, faceWidthW: number, depthW: number, mat: THREE.Material): BoxSpec {
  const { cx, cy, cz } = bar.center;
  return bar.orientation === 'vertical'
    ? { cx, cy, cz, sx: faceWidthW, sy: bar.length, sz: depthW, mat }
    : { cx, cy, cz, sx: bar.length, sy: faceWidthW, sz: depthW, mat };
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
  return finalizeMemberMesh(geo, basis, s.mat, bimId);
}

/**
 * Apply the opening basis to a frame-LOCAL geometry and wrap it as a shadowing,
 * BIM-stamped mesh. SSoT tail shared by the box path (`makeBoxMesh`) and the swept
 * frame-section path (`buildFrameProfileMembers` output) — one place owns the
 * basis-apply + shadow flags + identity stamp (N.18: no duplicated mesh tail).
 */
function finalizeMemberMesh(
  geo: THREE.BufferGeometry,
  basis: THREE.Matrix4,
  mat: THREE.Material,
  bimId: string,
): THREE.Mesh {
  geo.applyMatrix4(basis);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  stampBimIdentity(mesh, { bimId, bimType: 'opening' });
  return mesh;
}
