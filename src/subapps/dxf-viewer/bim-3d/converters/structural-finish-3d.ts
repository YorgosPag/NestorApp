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
import { computeColumnFinishBands, computeBeamFinishFaces } from '../../bim/finishes/structural-finish-scene';
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

/** Τομή δύο ευθειών (p0+t·d0) ∩ (p1+u·d1)· `null` αν ~παράλληλες. */
function lineIntersect(p0: Vec2, d0: Vec2, p1: Vec2, d1: Vec2): Vec2 | null {
  const denom = d0.x * d1.y - d0.y * d1.x;
  if (Math.abs(denom) < EPS) return null;
  const t = ((p1.x - p0.x) * d1.y - (p1.y - p0.y) * d1.x) / denom;
  return { x: p0.x + t * d0.x, y: p0.y + t * d0.y };
}

/** Όριο μήκους miter (× offset) — αιχμηρές γωνίες κρατούν square άκρο, χωρίς spike. */
const MITER_LIMIT_FACTOR = 4;

/**
 * ADR-449 Slice 6/10 — κλείσιμο των **ΑΝΟΙΧΤΩΝ** άκρων (που δεν mitered-ηκαν με
 * γειτονική όψη του ΙΔΙΟΥ στοιχείου). Δύο περιπτώσεις, ανάλογα αν το άκρο ακουμπά γείτονα:
 *
 *  - **Ελεύθερο** άκρο (open space, `!aJunction`) → **chamfer 45°**: ΜΟΝΟ η εξωτερική γωνία
 *    τραβιέται **μέσα** κατά το πάχος (το core μένει) → λοξό end-cap (φαλτσογωνιά) αντί για
 *    τετράγωνο «κεφάλι» που προεξέχει σε ανοιχτό χώρο (Slice 6 #3 — mirror τοίχου).
 *  - **Junction** άκρο (`seg.aJunction/bJunction` — ακουμπά γειτονικό δομικό στοιχείο, π.χ.
 *    συμβολή «από κάναβο» ADR-441) → **ορθογώνια EXTEND**: **core ΚΑΙ outer** σπρώχνονται μαζί
 *    **έξω** κατά το πάχος (κατά τον άξονα) → το end-cap μένει **ΚΑΘΕΤΟ (ορθογωνική τομή)** και
 *    ακουμπά flush στην εξωτερική παρειά του διπλανού σοβά → **corner-fill** χωρίς λοξή ακμή που
 *    μπαίνει στο σώμα του όμορου (Giorgio 2026-06-14: v1 square άφηνε κενό· v2 outer-only EXTEND
 *    έκανε λοξό end-cap που διείσδυε· v3 = core+outer EXTEND = ορθογώνια κάθετη τομή). Γεμίζει
 *    την κάθετη γωνία ΚΑΙ overlap-άρει σε collinear συνέχεια → ο σοβάς **κλείνει**, μηδέν προεξοχή.
 *
 * Clamp στο μισό μήκος για μικρές όψεις (μηδέν inversion στο chamfer/extend).
 */
function closeOpenOuterEnds(
  segs: readonly FinishFaceSegment[],
  offsets: readonly (Vec2 | null)[],
  aCore: Vec2[],
  bCore: Vec2[],
  aOuter: Vec2[],
  bOuter: Vec2[],
  aMit: readonly boolean[],
  bMit: readonly boolean[],
): void {
  for (let i = 0; i < segs.length; i++) {
    const off = offsets[i];
    if (!off) continue;
    const dx = segs[i].b.x - segs[i].a.x;
    const dy = segs[i].b.y - segs[i].a.y;
    const len = Math.hypot(dx, dy);
    if (len < EPS) continue;
    const ch = Math.min(Math.hypot(off.x, off.y), len / 2);
    const ux = (dx / len) * ch;
    const uy = (dy / len) * ch;
    if (!aMit[i]) {
      if (segs[i].aJunction) {
        // Ορθογώνια EXTEND έξω (−άξονας): core + outer μαζί → κάθετο end-cap, corner-fill.
        aCore[i] = { x: aCore[i].x - ux, y: aCore[i].y - uy };
        aOuter[i] = { x: aOuter[i].x - ux, y: aOuter[i].y - uy };
      } else {
        // Chamfer 45°: μόνο outer μέσα (+άξονας) → λοξό end-cap σε ελεύθερο άκρο.
        aOuter[i] = { x: aOuter[i].x + ux, y: aOuter[i].y + uy };
      }
    }
    if (!bMit[i]) {
      if (segs[i].bJunction) {
        bCore[i] = { x: bCore[i].x + ux, y: bCore[i].y + uy };
        bOuter[i] = { x: bOuter[i].x + ux, y: bOuter[i].y + uy };
      } else {
        bOuter[i] = { x: bOuter[i].x - ux, y: bOuter[i].y - uy };
      }
    }
  }
}

/**
 * ADR-449 Slice 5 fix — outer offset endpoints κάθε exposed παρειάς, **mitered** στις
 * κοινές κορυφές: το εξωτερικό άκρο επεκτείνεται/κόβεται στην τομή των δύο offset
 * ευθειών → ΕΝΑ 45° seam, **μηδέν επικάλυψη/κενό** (convex → extend, reflex → trim).
 * Slice 6: `chamferOpenEnds` → κλείνει τα μη-mitered άκρα (βλ. `closeOpenOuterEnds`).
 * Slice 9: ενεργό ΚΑΙ για κολόνες. Slice 10: per-end — ελεύθερο → chamfer 45° (outer-only)·
 * junction → ορθογώνια extend (**core+outer**, κάθετο end-cap, corner-fill). Γι' αυτό επιστρέφει
 * ΚΑΙ τα (πιθανώς επεκταμένα) `aCore/bCore` — το quad διαβάζει αυτά αντί για τα raw `seg.a/b`.
 */
export function computeMiteredOuter(
  segs: readonly FinishFaceSegment[],
  offsets: readonly (Vec2 | null)[],
  chamferOpenEnds: boolean,
): { aOuter: Vec2[]; bOuter: Vec2[]; aCore: Vec2[]; bCore: Vec2[] } {
  const n = segs.length;
  const aOuter: Vec2[] = [];
  const bOuter: Vec2[] = [];
  const aCore: Vec2[] = [];
  const bCore: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const o = offsets[i] ?? { x: 0, y: 0 };
    aCore[i] = { x: segs[i].a.x, y: segs[i].a.y };
    bCore[i] = { x: segs[i].b.x, y: segs[i].b.y };
    aOuter[i] = { x: segs[i].a.x + o.x, y: segs[i].a.y + o.y };
    bOuter[i] = { x: segs[i].b.x + o.x, y: segs[i].b.y + o.y };
  }
  const aMit = new Array<boolean>(n).fill(false);
  const bMit = new Array<boolean>(n).fill(false);
  for (let k = 0; k < n && n >= 2; k++) {
    const m = (k + 1) % n;
    const cur = segs[k];
    const nxt = segs[m];
    const ok = offsets[k];
    const om = offsets[m];
    if (!ok || !om) continue;
    const v = cur.b;
    const tol = 1e-6 * (1 + Math.hypot(v.x, v.y));
    if (Math.hypot(v.x - nxt.a.x, v.y - nxt.a.y) > tol) continue; // όχι κοινή κορυφή
    const dCur = { x: cur.b.x - cur.a.x, y: cur.b.y - cur.a.y };
    const dNxt = { x: nxt.b.x - nxt.a.x, y: nxt.b.y - nxt.a.y };
    const mPt = lineIntersect({ x: cur.a.x + ok.x, y: cur.a.y + ok.y }, dCur, { x: nxt.a.x + om.x, y: nxt.a.y + om.y }, dNxt);
    if (!mPt) continue;
    const offMag = Math.max(Math.hypot(ok.x, ok.y), Math.hypot(om.x, om.y));
    if (Math.hypot(mPt.x - v.x, mPt.y - v.y) > MITER_LIMIT_FACTOR * offMag) continue; // αιχμηρή → square
    bOuter[k] = mPt;
    aOuter[m] = mPt;
    bMit[k] = true;
    aMit[m] = true;
  }
  if (chamferOpenEnds) closeOpenOuterEnds(segs, offsets, aCore, bCore, aOuter, bOuter, aMit, bMit);
  return { aOuter, bOuter, aCore, bCore };
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

  const group = new THREE.Group();
  for (let i = 0; i < segs.length; i++) {
    if (!offsets[i]) continue;
    const seg = segs[i];
    const quad: Point3D[] = [
      { x: aCore[i].x, y: aCore[i].y, z: 0 },
      { x: bCore[i].x, y: bCore[i].y, z: 0 },
      { x: bOuter[i].x, y: bOuter[i].y, z: 0 },
      { x: aOuter[i].x, y: aOuter[i].y, z: 0 },
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
    if (sub) while (sub.children.length) group.add(sub.children[0]);
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
