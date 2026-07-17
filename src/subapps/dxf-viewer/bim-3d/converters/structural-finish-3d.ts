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
import { getMaterial3D, getFinishColorOverrideMaterial3D } from '../materials/MaterialCatalog3D';
import { attachEdgesProjection } from './bim-three-edges';
import { stampBimIdentity } from './bim-three-shape-helpers';
import { mmToSceneUnits, sceneUnitsToMeters, type SceneUnits } from '../../utils/scene-units';
import { computeColumnFinishBands, computeBeamFinishFaces } from '../../bim/finishes/structural-finish-scene';
import type { FinishFaceSegment, StructuralFinishFaces } from '../../bim/finishes/structural-finish-types';
// ADR-449 Slice X2 — γωνιακή γεωμετρία = pure SSoT (κοινή με το 2Δ outline· πρώην εδώ).
// ADR-449 Slice X6 — `computeBandFinishQuads` = η κοινή offset→miter ακολουθία (μηδέν copy-paste).
import { computeBandFinishQuads, type BandFinishQuad } from '../../bim/finishes/structural-finish-outline-geometry';
import type { FinishStrip, FinishStripGroup } from '../../bim/finishes/structural-finish-vertical-merge';
// ADR-449/534 Φ7 — unified welded δέρμα ανά ομοεπίπεδη όψη (union t×z + τρύπες στα ανοίγματα).
import { buildFaceProfiles, collectMiterWedges, type FaceProfile, type MiterWedge } from '../../bim/finishes/structural-finish-face-profile';
// ADR-404 / ADR-449 Bug A — ο σοβάς κεκλιμένου μέλους ακολουθεί τον πυρήνα: ΙΔΙΟΣ shear
// SSoT consumer με τον core (no-op fast-path όταν δεν υπάρχει κλίση). Μηδέν νέα μαθηματικά.
import { applyColumnTilt, applyBeamSlope } from './mesh-slope-shear';

// Re-export ώστε importers/tests (`structural-finish-3d-beam.test.ts`) να μην σπάσουν.
export { computeMiteredOuter } from '../../bim/finishes/structural-finish-outline-geometry';

const MM_TO_M = 0.001;

/**
 * SSoT finalize ενός finish mesh (prism Ή unified face): υλικό/χρώμα-override + κατακόρυφη θέση +
 * bim tags + shadows + edge overlay. Κοινό για {@link addFinishPrism} (per-strip) ΚΑΙ
 * {@link buildFinishSkinFromStripGroups} (Φ7 unified) → μηδέν copy-paste (N.18).
 */
function finalizeFinishMesh(
  group: THREE.Group,
  geo: THREE.BufferGeometry,
  materialId: string,
  colorOverride: string | undefined,
  classification: FinishFaceSegment['classification'],
  id: string,
  bimType: 'column' | 'beam',
  levelId: string | undefined,
  posY: number,
): void {
  const material = colorOverride ? getFinishColorOverrideMaterial3D(colorOverride) : getMaterial3D(materialId);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = posY;
  stampBimIdentity(mesh, { bimId: id, bimType, matId: materialId, levelId });
  mesh.userData['structuralFinish'] = true;
  mesh.userData['finishClassification'] = classification;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  attachEdgesProjection(mesh, bimType);
  group.add(mesh);
}

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
  // ADR-404 Bug A — optional per-vertex tilt/slope shear applied to the prism
  // geometry BEFORE the edge overlay is built, so the σοβάς faces AND their
  // perimeter edge lines both follow the lean (the LineSegments2 overlay is a
  // separate interleaved geometry that cannot be re-sheared after the fact).
  shearGeo?: (geo: THREE.BufferGeometry) => void,
  // ADR-449 PART B — per-face colour override (Revit «Paint»): τιντάρει τον σοβά (plaster
  // PBR base + custom χρώμα)· απόν → material καταλόγου (SSoT με 2Δ). Δεν αλλάζει BOQ.
  colorOverride?: string,
): void {
  // ≥3 σημεία: quad (per-strip band) Ή τρίγωνο (miter wedge, ADR-534 Φ7b) — ο `stripPrismGeometry`
  // εξωθεί οποιοδήποτε plan polygon ≥3 κορυφών.
  if (quad.length < 3) return;
  const geo = stripPrismGeometry(quad, heightM);
  if (!geo) return;
  shearGeo?.(geo);
  finalizeFinishMesh(group, geo, materialId, colorOverride, classification, id, bimType, levelId, baseY);
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
  // ADR-404 Bug A — per-prism shear (applied before edges); flat/silhouette callers omit it.
  shearGeo?: (geo: THREE.BufferGeometry) => void,
): THREE.Group | null {
  if (faces.segments.length === 0 || heightM <= 0) return null;
  const s = mmToSceneUnits(sceneUnits);
  // ADR-449 Slice 9/10 + X5 — mitered quads μέσω του ΚΟΙΝΟΥ SSoT (offset→miter→skip-degenerate).
  // Junction άκρα → ορθογώνια EXTEND (core+outer)· ελεύθερα → chamfer 45° — τα διαχειρίζεται εντός
  // ο `computeMiteredOuter`, γι' αυτό το quad διαβάζει τα (πιθανώς επεκταμένα) `aCore/bCore`.
  const quads = computeBandFinishQuads(faces.segments, s);
  // ADR-462 — τα band coords (core/outer) είναι canvas units → world metres με sceneToM (SSoT `scalePoints`).
  const sceneToM = sceneUnitsToMeters(sceneUnits);
  const group = new THREE.Group();
  for (const q of quads) {
    addFinishPrism(
      group, quadToScenePoints(q, sceneToM), heightM, baseY, id, bimType,
      q.seg.materialId, q.seg.classification, levelId, shearGeo, q.seg.colorOverride,
    );
  }
  if (group.children.length === 0) return null;

  stampBimIdentity(group, { bimId: id, bimType });
  group.userData['structuralFinish'] = true;
  return group;
}

/**
 * ADR-449 — mitered plan-quad (canvas units) → world-metre `Point3D[]` (order aCore→bCore→
 * bOuter→aOuter, ίδιο με τον πυρήνα του prism). Reuse `scalePoints` (ΕΝΑ scale SSoT).
 */
function quadToScenePoints(q: BandFinishQuad | FinishStrip, sceneToM: number): Point3D[] {
  const m = scalePoints([q.aCore, q.bCore, q.bOuter, q.aOuter], sceneToM);
  return m.map((p) => ({ x: p.x, y: p.y, z: 0 }));
}

/** FaceProfile (t,z) πολύγωνα (m) → THREE.Shape[] (outer + τρύπες = ανοίγματα). */
function faceProfileShapes(profile: FaceProfile): THREE.Shape[] {
  const shapes: THREE.Shape[] = [];
  for (const poly of profile.polygons) {
    const shape = new THREE.Shape();
    poly.outer.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)));
    shape.closePath();
    for (const hole of poly.holes) {
      const path = new THREE.Path();
      hole.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
      path.closePath();
      shape.holes.push(path);
    }
    shapes.push(shape);
  }
  return shapes;
}

/**
 * Matrix τοπικό (t, z, u) → world. Το plan (x,y) → world (x,0,−y)· z_profile → world +Y (ίδια
 * `ROT_X_NEG_90` σύμβαση). Columns: t→dir, z→up, u(πάχος)→outward perp· translation = originCore
 * (m) + baseElevation στο Y. `sceneToM` scale-άρει το core σημείο αναφοράς σε μέτρα.
 */
function faceProfileWorldMatrix(profile: FaceProfile, sceneToM: number, baseElevationM: number): THREE.Matrix4 {
  const { dir: d, perp: n, originCoreScene: o } = profile;
  return new THREE.Matrix4().set(
    d.x, 0, n.x, o.x * sceneToM,
    0, 1, 0, baseElevationM,
    -d.y, 0, -n.y, -o.y * sceneToM,
    0, 0, 0, 1,
  );
}

/**
 * ADR-534 Φ7b — ένα γωνιακό miter wedge (plan τρίγωνο) → τριγωνικό prism, προσθήκη στο group.
 * Reuse του {@link addFinishPrism} (ίδιο geometry/material/tag SSoT με τα per-strip bands). Το
 * τρίγωνο (core, mid, tip· scene units) → world metres με `scalePoints` (ίδιο scale με τα quads).
 */
function addMiterWedge(
  group: THREE.Group,
  w: MiterWedge,
  sceneToM: number,
  baseElevationM: number,
  id: string,
  bimType: 'column' | 'beam',
  levelId: string | undefined,
): void {
  const tri = scalePoints([w.core, w.mid, w.tip], sceneToM).map((p) => ({ x: p.x, y: p.y, z: 0 }));
  addFinishPrism(
    group, tri, (w.zTopMm - w.zBottomMm) * MM_TO_M, baseElevationM + w.zBottomMm * MM_TO_M,
    id, bimType, w.seg.materialId, w.seg.classification, levelId, undefined, w.seg.colorOverride,
  );
}

/** FaceProfile → ΕΝΑ welded BufferGeometry (extrude κατά πάχος + world placement). */
function faceProfileGeometry(profile: FaceProfile, sceneToM: number, baseElevationM: number): THREE.BufferGeometry | null {
  const shapes = faceProfileShapes(profile);
  if (shapes.length === 0 || profile.thicknessM <= 0) return null;
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: profile.thicknessM, bevelEnabled: false });
  geo.applyMatrix4(faceProfileWorldMatrix(profile, sceneToM, baseElevationM));
  return geo;
}

/**
 * ADR-449/534 Φ7 — ΕΝΑ welded δέρμα ΑΝΑ ομοεπίπεδη όψη (big-player: Revit «join» / C4D weld):
 * τα (t×z) ορθογώνια κάθε `FinishStripGroup` ενώνονται σε ΕΝΑ profile (τρύπες = ανοίγματα) και
 * εξωθούνται ΜΙΑ φορά → μηδέν εσωτερικό side-face = μηδέν ραφή στη συνεχή coplanar πρόσοψη. Ραφή
 * μόνο σε πραγματικό όριο (γωνία = άλλο group, αλλαγή υλικού = άλλο group, άνοιγμα = τρύπα).
 * Αντικαθιστά το «ένα prism ανά strip» ({@link buildFinishSkinFromStrips}) στο silhouette path.
 * `baseElevationM` = world datum (bakes στο matrix Y). `null` όταν κανένα profile.
 */
export function buildFinishSkinFromStripGroups(
  groups: readonly FinishStripGroup[],
  sceneUnits: SceneUnits,
  baseElevationM: number,
  id: string,
  bimType: 'column' | 'beam',
  levelId?: string,
): THREE.Group | null {
  if (groups.length === 0) return null;
  const sceneToM = sceneUnitsToMeters(sceneUnits);
  const group = new THREE.Group();
  for (const profile of buildFaceProfiles(groups, sceneToM)) {
    const geo = faceProfileGeometry(profile, sceneToM, baseElevationM);
    if (!geo) continue;
    finalizeFinishMesh(
      group, geo, profile.seg.materialId, profile.seg.colorOverride, profile.seg.classification,
      id, bimType, levelId, 0,
    );
  }
  // ADR-534 Φ7b — γωνιακά miter wedges: γεμίζουν τη γωνία με διαγώνιο αρμό 45° (μονή κάλυψη), αφού
  // το welded body τελειώνει στο core-length. Big-player «Miter» join· μηδέν double-coverage/κενό.
  for (const w of collectMiterWedges(groups)) {
    addMiterWedge(group, w, sceneToM, baseElevationM, id, bimType, levelId);
  }
  if (group.children.length === 0) return null;
  stampBimIdentity(group, { bimId: id, bimType });
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
    // ADR-404 Bug A — κεκλιμένη κολώνα: shear κάθε finish prism (faces + edges) ΙΔΙΑ με
    // τον πυρήνα, ΠΡΙΝ χτιστούν οι ακμές. Το prism ζει σε floor-local Y με βάση στο band
    // bottom → `baseHeightM = zBottom` ώστε το ύψος πάνω από τη βάση της κολώνας (= datum
    // του core) να ταιριάζει 1:1. No-op flat fast-path (μηδέν regression για ίσιες κολώνες).
    const baseHeightM = band.zBottomMm * MM_TO_M;
    const sub = buildFinishSkinFromFaces(
      band.faces, sceneUnits, hM, baseY + band.zBottomMm * MM_TO_M, column.id, 'column', levelId,
      (geo) => applyColumnTilt(geo, column.params, baseHeightM),
    );
    if (sub) while (sub.children.length) group.add(sub.children[0]);
  }
  if (group.children.length === 0) return null;
  stampBimIdentity(group, { bimId: column.id, bimType: 'column' });
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

  // ADR-401/404 Bug A — κεκλιμένη δοκός (sloped): shear κάθε finish prism (faces + edges)
  // ΠΡΙΝ τις ακμές, ΙΔΙΑ με τον πυρήνα (plan-based world-Y slope· no-op fast-path όταν επίπεδη).
  return buildFinishSkinFromFaces(
    faces,
    beam.params.sceneUnits ?? 'mm',
    beam.params.depth * MM_TO_M,
    baseY,
    beam.id,
    'beam',
    levelId,
    (geo) => applyBeamSlope(geo, beam.params),
  );
}
