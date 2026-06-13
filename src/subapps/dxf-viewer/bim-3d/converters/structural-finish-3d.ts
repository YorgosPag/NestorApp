/**
 * ADR-449 Slice 2 — Structural Finish Skin 3D (σοβάς κολόνας): faces → THREE.Group.
 *
 * Ανά εκτεθειμένη υπο-ακμή που δίνει ο SSoT resolver (`computeColumnFinishFaces`)
 * χτίζει ένα λεπτό κατακόρυφο **band prism**: το plan footprint του band είναι η
 * παρειά [a,b] μετατοπισμένη προς τα ΕΞΩ κατά το πάχος σοβά (outward normal),
 * εξωθημένο στο ύψος της κολόνας. Reuse:
 *   - `computeColumnFinishFaces` (bim/finishes) — το «ποιες/πόσο/τι υλικό» SSoT,
 *   - `stripPrismGeometry` (envelope-three-mesh) — ο καθαρός geometry SSoT (plan
 *     quad → vertical prism, ίδιο `ROT_X_NEG_90` convention με τον πυρήνα),
 *   - `getMaterial3D` — το PBR material catalog (mat-plaster-int/ext → plaster).
 *
 * Δεν αγγίζει τον στατικό πυρήνα: ο σοβάς είναι additive «δέρμα» ΕΞΩ από το
 * `width/depth`. Tag `structuralFinish:true` (κοινό `bimId`/`bimType:'column'` με
 * τον πυρήνα → ίδια visibility/picking, αλλά διακριτό για selective styling).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import * as THREE from 'three';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { WallEntity } from '../../bim/types/wall-types';
import type { Point3D } from '../../bim/types/bim-base';
import { stripPrismGeometry } from './envelope-three-mesh';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { attachEdgesProjection } from './bim-three-edges';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { computeColumnFinishFaces, computeBeamFinishFaces } from '../../bim/finishes/structural-finish-scene';
import type { FinishFaceSegment, StructuralFinishFaces } from '../../bim/finishes/structural-finish-types';

const MM_TO_M = 0.001;
const EPS = 1e-9;

interface Vec2 { readonly x: number; readonly y: number }

/** Μοναδιαία outward normal × offset (CCW footprint → (dy,−dx)). `null` αν degenerate. */
function segOffsetVec(seg: FinishFaceSegment, offCanvas: number): Vec2 | null {
  const dx = seg.b.x - seg.a.x;
  const dy = seg.b.y - seg.a.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;
  return { x: (dy / len) * offCanvas, y: (-dx / len) * offCanvas };
}

/**
 * Plan quad του band μιας παρειάς: [a, b, b+n·off, a+n·off] όπου n = μοναδιαία
 * outward normal (CCW footprint → (dy,−dx)) και `off` = πάχος σοβά σε canvas units.
 */
function buildFaceBandQuad(seg: FinishFaceSegment, offCanvas: number): Point3D[] {
  const n = segOffsetVec(seg, offCanvas);
  if (!n) return [];
  const { a, b } = seg;
  return [
    { x: a.x, y: a.y, z: 0 },
    { x: b.x, y: b.y, z: 0 },
    { x: b.x + n.x, y: b.y + n.y, z: 0 },
    { x: a.x + n.x, y: a.y + n.y, z: 0 },
  ];
}

/**
 * ADR-449 Slice 5 fix — παραλληλόγραμμο γεμίσματος γωνίας στην κοινή κορυφή `v` δύο
 * διαδοχικών exposed παρειών (offset vectors `n0`,`n1`): [v, v+n1, v+n0+n1, v+n0].
 * Κλείνει το κενό ανάμεσα στα δύο bands (αλλιώς οι γωνίες της κολώνας μένουν ανοιχτές).
 */
function buildCornerFillQuad(v: Vec2, n0: Vec2, n1: Vec2): Point3D[] {
  return [
    { x: v.x, y: v.y, z: 0 },
    { x: v.x + n1.x, y: v.y + n1.y, z: 0 },
    { x: v.x + n0.x + n1.x, y: v.y + n0.y + n1.y, z: 0 },
    { x: v.x + n0.x, y: v.y + n0.y, z: 0 },
  ];
}

/** Χτίζει ΕΝΑ band/corner prism από plan quad και το προσθέτει στο group (tagged). */
function addFinishPrism(
  group: THREE.Group,
  quad: Point3D[],
  heightM: number,
  baseY: number,
  id: string,
  bimType: 'column' | 'beam',
  materialId: string,
  classification: FinishFaceSegment['classification'],
  levelId: string | undefined,
  isCorner: boolean,
): void {
  if (quad.length < 4) return;
  const geo = stripPrismGeometry(quad, heightM);
  if (!geo) return;
  const mesh = new THREE.Mesh(geo, getMaterial3D(materialId));
  mesh.position.y = baseY;
  mesh.userData['bimId'] = id;
  mesh.userData['bimType'] = bimType;
  mesh.userData['structuralFinish'] = true;
  mesh.userData['matId'] = materialId;
  mesh.userData['finishClassification'] = classification;
  if (isCorner) mesh.userData['finishCorner'] = true;
  if (levelId !== undefined) mesh.userData['levelId'] = levelId;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  attachEdgesProjection(mesh, bimType);
  group.add(mesh);
}

/**
 * Γεμίσματα γωνίας: για κάθε ζεύγος διαδοχικών exposed segments που μοιράζονται
 * **convex** κορυφή (CCW left-turn), προσθέτει παραλληλόγραμμο που κλείνει το κενό.
 * Σε reflex (concave) γωνίες τα bands ήδη επικαλύπτονται → skip. Δοκάρι (2 χωριστές
 * πλάγιες όψεις, άκρα εκτός) → κανένα κοινό vertex → μηδέν corner fills (σωστά).
 */
function addFinishCornerFills(
  group: THREE.Group,
  segs: readonly FinishFaceSegment[],
  s: number,
  heightM: number,
  baseY: number,
  id: string,
  bimType: 'column' | 'beam',
  levelId: string | undefined,
): void {
  const n = segs.length;
  if (n < 2) return;
  for (let k = 0; k < n; k++) {
    const cur = segs[k];
    const nxt = segs[(k + 1) % n];
    const tol = 1e-6 * (1 + Math.hypot(cur.b.x, cur.b.y));
    if (Math.hypot(cur.b.x - nxt.a.x, cur.b.y - nxt.a.y) > tol) continue; // όχι κοινή κορυφή
    const d0x = cur.b.x - cur.a.x, d0y = cur.b.y - cur.a.y;
    const d1x = nxt.b.x - nxt.a.x, d1y = nxt.b.y - nxt.a.y;
    if (d0x * d1y - d0y * d1x <= EPS) continue; // reflex/colinear → bands overlap, μηδέν κενό
    const n0 = segOffsetVec(cur, cur.thickness * s);
    const n1 = segOffsetVec(nxt, nxt.thickness * s);
    if (!n0 || !n1) continue;
    addFinishPrism(group, buildCornerFillQuad(cur.b, n0, n1), heightM, baseY, id, bimType, cur.materialId, cur.classification, levelId, true);
  }
}

/**
 * ADR-449 Slice 4 — pure, entity-agnostic πυρήνας: από έτοιμα `StructuralFinishFaces`
 * χτίζει ένα `THREE.Group` band prisms (μία λωρίδα ανά εκτεθειμένη παρειά) + corner
 * fills (Slice 5) στις convex γωνίες. ΕΝΑ SSoT για κολόνα ΚΑΙ δοκάρι — διαφέρουν
 * μόνο σε `heightM`, `baseY`, `bimType`. `null` όταν δεν προκύπτει κανένα band.
 */
function buildFinishSkinFromFaces(
  faces: StructuralFinishFaces,
  sceneUnits: SceneUnits,
  heightM: number,
  baseY: number,
  id: string,
  bimType: 'column' | 'beam',
  levelId?: string,
): THREE.Group | null {
  if (faces.segments.length === 0 || heightM <= 0) return null;
  const s = mmToSceneUnits(sceneUnits);
  const segs = faces.segments;

  const group = new THREE.Group();
  for (const seg of segs) {
    addFinishPrism(group, buildFaceBandQuad(seg, seg.thickness * s), heightM, baseY, id, bimType, seg.materialId, seg.classification, levelId, false);
  }
  addFinishCornerFills(group, segs, s, heightM, baseY, id, bimType, levelId);
  if (group.children.length === 0) return null;

  group.userData['bimId'] = id;
  group.userData['bimType'] = bimType;
  group.userData['structuralFinish'] = true;
  return group;
}

/**
 * Ομάδα από band prisms σοβά μιας κολόνας — ή `null` όταν ο σοβάς είναι ανενεργός /
 * όλες οι παρειές καλυμμένες. `baseY` = κατακόρυφη βάση του πυρήνα (ίδιο datum →
 * τα bands ευθυγραμμίζονται με την κολόνα). Flat-path μόνο (κεκλιμένες κορυφές =
 * μετέπειτα slice).
 */
export function buildColumnFinishSkin(
  column: ColumnEntity,
  walls: readonly WallEntity[],
  baseY: number,
  levelId?: string,
): THREE.Group | null {
  const verts = column.geometry?.footprint?.vertices;
  if (!verts || verts.length < 3) return null;

  const faces = computeColumnFinishFaces(column, verts, column.params.height, walls);
  if (!faces) return null;

  return buildFinishSkinFromFaces(
    faces,
    column.params.sceneUnits ?? 'mm',
    column.params.height * MM_TO_M,
    baseY,
    column.id,
    'column',
    levelId,
  );
}

/**
 * ADR-449 Slice 4 — band prisms σοβά **δοκαριού** (2 πλάγιες όψεις, ύψος = structural
 * depth). Mirror του `buildColumnFinishSkin`: ίδιος πυρήνας `buildFinishSkinFromFaces`,
 * obstacles = τοίχοι, `includeEdge` (μέσα στο `computeBeamFinishFaces`) αποκλείει τα
 * άκρα. `baseY` = κάτω παρειά δοκαριού (ίδιο datum με το box extrude). `null` όταν ο
 * σοβάς είναι ανενεργός / δεν προκύπτει band.
 */
export function buildBeamFinishSkin(
  beam: BeamEntity,
  walls: readonly WallEntity[],
  baseY: number,
  levelId?: string,
): THREE.Group | null {
  const verts = beam.geometry?.outline?.vertices;
  if (!verts || verts.length < 3) return null;

  const faces = computeBeamFinishFaces(beam, verts, beam.params.depth, walls);
  if (!faces) return null;

  return buildFinishSkinFromFaces(
    faces,
    beam.params.sceneUnits ?? 'mm',
    beam.params.depth * MM_TO_M,
    baseY,
    beam.id,
    'beam',
    levelId,
  );
}
