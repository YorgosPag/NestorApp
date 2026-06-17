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
import { scalePoints } from '../../rendering/entities/shared/geometry-vector-utils';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { attachEdgesProjection } from './bim-three-edges';
import { mmToSceneUnits, sceneUnitsToMeters, type SceneUnits } from '../../utils/scene-units';
import { computeColumnFinishBands, computeBeamFinishFaces } from '../../bim/finishes/structural-finish-scene';
import type { FinishFaceSegment, StructuralFinishFaces } from '../../bim/finishes/structural-finish-types';
// ADR-449 Slice X2 — γωνιακή γεωμετρία = pure SSoT (κοινή με το 2Δ outline· πρώην εδώ).
import { computeMiteredOuter, segOffsetVec } from '../../bim/finishes/structural-finish-outline-geometry';
// ADR-404 / ADR-449 Bug A — ο σοβάς κεκλιμένου μέλους ακολουθεί τον πυρήνα: ΙΔΙΟΣ shear
// SSoT consumer με τον core (no-op fast-path όταν δεν υπάρχει κλίση). Μηδέν νέα μαθηματικά.
import { applyColumnTilt, applyBeamSlope } from './mesh-slope-shear';

// Re-export ώστε importers/tests (`structural-finish-3d-beam.test.ts`) να μην σπάσουν.
export { computeMiteredOuter } from '../../bim/finishes/structural-finish-outline-geometry';

const MM_TO_M = 0.001;

/** Χτίζει ΕΝΑ band prism από plan quad και το προσθέτει στο group (tagged). */
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
  if (levelId !== undefined) mesh.userData['levelId'] = levelId;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  attachEdgesProjection(mesh, bimType);
  group.add(mesh);
}

/**
 * ADR-449 Slice 4/5 — pure, entity-agnostic πυρήνας: από έτοιμα `StructuralFinishFaces`
 * χτίζει ένα `THREE.Group` με **mitered** band prisms (μία λωρίδα ανά εκτεθειμένη
 * παρειά· οι γωνίες κλείνουν με 45° miter, μηδέν επικάλυψη). ΕΝΑ SSoT για κολόνα ΚΑΙ
 * δοκάρι — διαφέρουν μόνο σε `heightM`, `baseY`, `bimType`. `null` αν κανένα band.
 */
export function buildFinishSkinFromFaces(
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
  const offsets = segs.map((seg) => segOffsetVec(seg, seg.thickness * s));
  // ADR-449 Slice 9/10 — κλείσιμο ανοιχτών άκρων ανά τύπο (βλ. `closeOpenOuterEnds`): ελεύθερα
  // άκρα → chamfer 45° (outer-only)· **junction** άκρα (`seg.aJunction/bJunction` από τον resolver
  // — ακουμπούν γείτονα, π.χ. συμβολή «από κάναβο» ADR-441) → ορθογώνια **EXTEND** (core+outer →
  // κάθετη τομή· ο σοβάς κλείνει flush στον διπλανό χωρίς λοξή ακμή). Γι' αυτό το quad διαβάζει
  // τα (πιθανώς επεκταμένα) `aCore/bCore`, ΟΧΙ τα raw `seg.a/b`. Γωνίες ΙΔΙΟΥ στοιχείου = miter.
  const { aOuter, bOuter, aCore, bCore } = computeMiteredOuter(segs, offsets, true);

  // ADR-462 — τα band coords (core/outer) είναι canvas units (ίδιος χώρος με το
  // footprint) → world metres με sceneToM (SSoT `scalePoints`). Τα offsets (× s) είναι
  // ήδη στον ίδιο canvas χώρο, οπότε όλο το quad κλιμακώνεται μαζί.
  const sceneToM = sceneUnitsToMeters(sceneUnits);
  const aCoreM = scalePoints(aCore, sceneToM);
  const bCoreM = scalePoints(bCore, sceneToM);
  const aOuterM = scalePoints(aOuter, sceneToM);
  const bOuterM = scalePoints(bOuter, sceneToM);
  const group = new THREE.Group();
  for (let i = 0; i < segs.length; i++) {
    if (!offsets[i]) continue;
    const seg = segs[i];
    const quad: Point3D[] = [
      { x: aCoreM[i].x, y: aCoreM[i].y, z: 0 },
      { x: bCoreM[i].x, y: bCoreM[i].y, z: 0 },
      { x: bOuterM[i].x, y: bOuterM[i].y, z: 0 },
      { x: aOuterM[i].x, y: aOuterM[i].y, z: 0 },
    ];
    addFinishPrism(group, quad, heightM, baseY, id, bimType, seg.materialId, seg.classification, levelId);
  }
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
  beams: readonly BeamEntity[],
  baseY: number,
  levelId?: string,
): THREE.Group | null {
  const verts = column.geometry?.footprint?.vertices;
  if (!verts || verts.length < 3) return null;

  // ADR-449 Slice 6 — height-aware junction: η αφαίρεση λόγω δοκαριών ισχύει ΜΟΝΟ στη
  // ζώνη ύψους του δοκαριού (πάνω), όχι σε όλο το ύψος. Ένα prism set ανά κατακόρυφη ζώνη
  // (κάτω = πλήρης παρειά· πάνω = junction cut), στοιβαγμένα στο σωστό baseY.
  const bands = computeColumnFinishBands(column, verts, column.params.height, walls, beams);
  if (!bands) return null;

  const sceneUnits = column.params.sceneUnits ?? 'mm';
  const group = new THREE.Group();
  for (const band of bands) {
    const hM = (band.zTopMm - band.zBottomMm) * MM_TO_M;
    const sub = buildFinishSkinFromFaces(
      band.faces, sceneUnits, hM, baseY + band.zBottomMm * MM_TO_M, column.id, 'column', levelId,
    );
    if (!sub) continue;
    // ADR-404 Bug A — κεκλιμένη κολώνα: shear το finish band ΙΔΙΑ με τον πυρήνα. Το prism
    // ζει σε floor-local Y με βάση στο band bottom → `baseHeightM = zBottom` ώστε το ύψος
    // πάνω από τη βάση της κολώνας (= datum του core) να ταιριάζει 1:1. No-op flat fast-path.
    const baseHeightM = band.zBottomMm * MM_TO_M;
    for (const child of sub.children) {
      applyColumnTilt((child as THREE.Mesh).geometry as THREE.BufferGeometry, column.params, baseHeightM);
    }
    while (sub.children.length) group.add(sub.children[0]);
  }
  if (group.children.length === 0) return null;
  group.userData['bimId'] = column.id;
  group.userData['bimType'] = 'column';
  group.userData['structuralFinish'] = true;
  return group;
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
  columns: readonly ColumnEntity[],
  baseY: number,
  levelId?: string,
  floorElevationMm = 0,
): THREE.Group | null {
  const verts = beam.geometry?.outline?.vertices;
  if (!verts || verts.length < 3) return null;

  // ADR-449 Slice 6 — κολόνες ως mutual obstacles (πλάγια όψη στη σύνδεση κόβεται).
  // ADR-449 Slice 8 — `floorElevationMm` → height-aware wall coverage (τοίχος-στήριγμα
  // κάτω από το δοκάρι δεν καλύπτει τις πλάγιες όψεις· κρατά σοβά και στις 2 πλευρές).
  const faces = computeBeamFinishFaces(beam, verts, beam.params.depth, walls, columns, floorElevationMm);
  if (!faces) return null;

  const skin = buildFinishSkinFromFaces(
    faces,
    beam.params.sceneUnits ?? 'mm',
    beam.params.depth * MM_TO_M,
    baseY,
    beam.id,
    'beam',
    levelId,
  );
  if (!skin) return null;
  // ADR-401/404 Bug A — κεκλιμένη δοκός (sloped): shear το finish ΙΔΙΑ με τον πυρήνα
  // (plan-based world-Y slope· no-op fast-path όταν επίπεδη). Μηδέν νέα μαθηματικά.
  for (const child of skin.children) {
    applyBeamSlope((child as THREE.Mesh).geometry as THREE.BufferGeometry, beam.params);
  }
  return skin;
}
