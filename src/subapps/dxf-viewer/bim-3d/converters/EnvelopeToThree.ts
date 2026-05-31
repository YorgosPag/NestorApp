/**
 * EnvelopeToThree — ADR-396 Phase P5 — pure converter: `EnvelopeChain` → THREE.Mesh.
 *
 * 3D κατακόρυφο κέλυφος μόνωσης (ETICS, ζώνη Z1). **Παράγωγο** floor-shell — ΟΧΙ
 * per-entity converter· καλείται από το `BimSceneLayer.syncEnvelope` με το ίδιο SSoT
 * `computeEnvelopePerimeter` (P3) που τροφοδοτεί και το 2D overlay (P4). 2D⟷3D parity.
 *
 * Cross-section = band ανάμεσα στην εξωτ. όψη της μόνωσης (`insulationOuterLoop`) και
 * την εξωτ. παρειά των τοίχων (`exteriorFaceLoop`) — mirror του `buildWallShape`
 * (outer forward → inner reversed → close). Extrude κατά το ύψος ορόφου, ίδια
 * coordinate convention με `BimToThreeConverter` (shape XY → world Y-up).
 *
 * ΜΟΝΑΔΕΣ: τα vertices του `EnvelopeChain` είναι στον ΙΔΙΟ canvas-unit/meter χώρο με
 * το `wall.geometry.outerEdge` (το οποίο ο `BimToThreeConverter` τρώει ως meters) →
 * μηδέν extra conversion, αυτόματο alignment με τους τοίχους. `heightM` σε ΜΕΤΡΑ.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3, §5, §7 (P5)
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-readonly-visualization.md (3D coverage parity)
 * @see ../../bim/geometry/envelope-perimeter (EnvelopeChain — geometry SSoT)
 * @see ../materials/envelope-material-resolver (PBR material)
 */

import * as THREE from 'three';
import type { Point3D } from '../../bim/types/bim-base';
import type { EnvelopeChain } from '../../bim/geometry/envelope-perimeter';
import type { EnvelopeOpeningCut } from '../../bim/geometry/envelope-opening-cuts';
import { envelopeFaceEdges } from '../../bim/geometry/envelope-opening-cuts';
import type { EnvelopeEdgeTop } from '../../bim/geometry/envelope-wall-top';
import type { EnvelopeEdgeBase } from '../../bim/geometry/envelope-wall-base';
import type { WallOpeningPiece } from './wall-opening-pieces';
import { buildSlopedWallPieceGeometry } from './wall-piece-geometry';
import { computeRevealJambQuads } from '../../bim/geometry/reveal-lining-geometry';
import type { EnvelopeMaterialId } from '../../bim/types/thermal-envelope-types';
import {
  ROT_X_NEG_90,
  MM_TO_M,
  POS_EPS,
  T_EPS,
  makeEnvelopeMesh,
  makeQuad,
  addBandPrism,
  stripPrismGeometry,
} from './envelope-three-mesh';

// ─── ADR-401 B3b / (γ) — μεταβλητή κορυφή ΚΑΙ μεταβλητή βάση κελύφους ──────────

function lerpP(a: Point3D, b: Point3D, t: number): Point3D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 };
}

/**
 * Κοινό σχήμα top (B3b) / base ((γ)) edge profile: ordered sub-segments σε
 * edge-local `s∈[0,1]` με γραμμικά z0M→z1M (ΜΕΤΡΑ πάνω από τη βάση ορόφου· το base
 * μπορεί <0). `EnvelopeEdgeTop` και `EnvelopeEdgeBase` είναι structurally αυτό.
 */
interface EdgeProfile {
  readonly segments: readonly { s0: number; s1: number; z0M: number; z1M: number }[];
}

/** Επίπεδο edge profile σε σταθερό `z` (top fallback heightM / lintel head). */
function flatProfile(z: number): EdgeProfile {
  return { segments: [{ s0: 0, s1: 1, z0M: z, z1M: z }] };
}

/** Το segment του profile που καλύπτει το `s` (πρώτο που ταιριάζει· fallback τελευταίο). */
function segAt(p: EdgeProfile, s: number): EdgeProfile['segments'][number] {
  const segs = p.segments;
  for (const seg of segs) if (s >= seg.s0 - T_EPS && s <= seg.s1 + T_EPS) return seg;
  return segs[segs.length - 1];
}

/** z (m) ενός segment στο `s` (γραμμικά z0→z1, clamped στο span). */
function segZAt(seg: EdgeProfile['segments'][number], s: number): number {
  const span = seg.s1 - seg.s0;
  if (span < T_EPS) return seg.z0M;
  const sc = s < seg.s0 ? seg.s0 : s > seg.s1 ? seg.s1 : s;
  return seg.z0M + ((seg.z1M - seg.z0M) * (sc - seg.s0)) / span;
}

/** Ενωμένα s-breakpoints (top + base) εντός (sStart,sEnd), αύξοντα, deduped. */
function bandBreakpoints(top: EdgeProfile, bottom: EdgeProfile | null, sStart: number, sEnd: number): number[] {
  const set = new Set<number>([sStart, sEnd]);
  const add = (p: EdgeProfile): void => {
    for (const seg of p.segments) {
      if (seg.s0 > sStart + T_EPS && seg.s0 < sEnd - T_EPS) set.add(seg.s0);
      if (seg.s1 > sStart + T_EPS && seg.s1 < sEnd - T_EPS) set.add(seg.s1);
    }
  };
  add(top);
  if (bottom) add(bottom);
  return [...set].sort((a, b) => a - b);
}

/**
 * Band με μεταβλητή κορυφή (`top`) ΚΑΙ μεταβλητή/επίπεδη βάση (`bottom`: profile →
 * ακολουθεί base-attach· number → επίπεδο floor, π.χ. 0 ή head πρεκιού) πάνω σε
 * plan quad που εκτείνεται σε edge-local `[sStart,sEnd]` (γωνίες lerp). Σπάει στο
 * **union** των top+base breakpoints· interior-biased eval (segment του midpoint)
 * → σκαλοπάτι = καθαρή κατακόρυφη ασυνέχεια. Επίπεδο sub-piece (top & base flat) →
 * φθηνό `addBandPrism`· αλλιώς `buildSlopedWallPieceGeometry` (wedge, 4 ανεξάρτητες
 * γωνίες). Top-only (bottom = scalar) → byte-for-byte με προ-(γ) συμπεριφορά.
 */
function addProfiledBand(
  group: THREE.Group,
  oStart: Point3D, oEnd: Point3D, fStart: Point3D, fEnd: Point3D,
  sStart: number, sEnd: number,
  top: EdgeProfile,
  bottom: EdgeProfile | number,
  baseY: number,
  materialId: EnvelopeMaterialId,
  levelId?: string,
): void {
  const span = sEnd - sStart;
  if (span < T_EPS) return;
  const botProfile = typeof bottom === 'number' ? null : bottom;
  const botFlatZ = typeof bottom === 'number' ? bottom : 0;
  const bps = bandBreakpoints(top, botProfile, sStart, sEnd);
  for (let k = 0; k < bps.length - 1; k++) {
    const u0 = bps[k];
    const u1 = bps[k + 1];
    if (u1 - u0 < T_EPS) continue;
    const mid = (u0 + u1) / 2;
    const ts = segAt(top, mid);
    const zT0 = segZAt(ts, u0);
    const zT1 = segZAt(ts, u1);
    let zB0 = botFlatZ;
    let zB1 = botFlatZ;
    if (botProfile) {
      const bs = segAt(botProfile, mid);
      zB0 = segZAt(bs, u0);
      zB1 = segZAt(bs, u1);
    }
    if (zT0 - zB0 <= POS_EPS && zT1 - zB1 <= POS_EPS) continue;
    const f0 = (u0 - sStart) / span;
    const f1 = (u1 - sStart) / span;
    const o0 = lerpP(oStart, oEnd, f0);
    const o1 = lerpP(oStart, oEnd, f1);
    const fp0 = lerpP(fStart, fEnd, f0);
    const fp1 = lerpP(fStart, fEnd, f1);
    if (Math.abs(zT0 - zT1) < POS_EPS && Math.abs(zB0 - zB1) < POS_EPS) {
      addBandPrism(group, makeQuad(o0, o1, fp0, fp1), zB0, zT0, baseY, materialId, levelId);
    } else {
      const piece: WallOpeningPiece = { quad: [o0, o1, fp1, fp0], zBotAM: zB0, zBotBM: zB1, zTopAM: zT0, zTopBM: zT1 };
      const geo = buildSlopedWallPieceGeometry(piece);
      if (geo) group.add(makeEnvelopeMesh(geo, materialId, baseY, levelId));
    }
  }
}

/**
 * Flat fast path (ούτε attached κορυφή ούτε βάση): solid spans πλήρους ύψους +
 * ανά άνοιγμα prism κάτω από ποδιά [0,sill] + πάνω από πρέκι [head,height].
 * ΑΜΕΤΑΒΛΗΤΟ (byte-for-byte με προ-B3b) — το κοινό case (μη-attached τοίχοι).
 */
function addFlatEdge(
  group: THREE.Group,
  f0: Point3D, f1: Point3D, o0: Point3D, o1: Point3D,
  heightM: number,
  baseY: number,
  edgeCuts: readonly EnvelopeOpeningCut[],
  materialId: EnvelopeMaterialId,
  levelId?: string,
): void {
  if (edgeCuts.length === 0) {
    addBandPrism(group, makeQuad(o0, o1, f0, f1), 0, heightM, baseY, materialId, levelId);
    return;
  }
  const sorted = [...edgeCuts].sort((a, b) => a.tStart - b.tStart);
  let cursor = 0;
  let cursorO = o0; // outer σημείο στο cursor (corner ή προηγ. cut boundary — κάθετο)
  let cursorF = f0;
  for (const c of sorted) {
    const a = Math.max(0, Math.min(1, c.tStart));
    const b = Math.max(0, Math.min(1, c.tEnd));
    if (b - a < T_EPS) continue;
    // Κάθετες απολήξεις από το cut.bandQuad = [O_a, O_b, F_b, F_a].
    const oA = c.bandQuad[0], oB = c.bandQuad[1], fB = c.bandQuad[2], fA = c.bandQuad[3];
    if (a > cursor + T_EPS) {
      addBandPrism(group, makeQuad(cursorO, oA, cursorF, fA), 0, heightM, baseY, materialId, levelId);
    }
    const span = makeQuad(oA, oB, fA, fB);
    const sill = Math.max(0, Math.min(heightM, c.sillM));
    const head = Math.max(0, Math.min(heightM, c.headM));
    if (sill > POS_EPS) addBandPrism(group, span, 0, sill, baseY, materialId, levelId);
    if (head < heightM - POS_EPS) addBandPrism(group, span, head, heightM, baseY, materialId, levelId);
    cursor = Math.max(cursor, b);
    cursorO = oB;
    cursorF = fB;
  }
  if (cursor < 1 - T_EPS) {
    addBandPrism(group, makeQuad(cursorO, o1, cursorF, f1), 0, heightM, baseY, materialId, levelId);
  }
}

/**
 * Χτίζει μια ακμή του κελύφους με κατακόρυφο split στα ανοίγματα. Το κενό του
 * κουφώματος μένει διαμπερές (Z4 reveal το ντύνει).
 *
 * - **Flat** (ούτε `edgeTop` ούτε `edgeBase`) → `addFlatEdge` (ΑΜΕΤΑΒΛΗΤΟ).
 * - **Attached** (B3b κορυφή ‖ (γ) βάση) → `addProfiledBand` με `top` = `edgeTop`
 *   (ή επίπεδο `heightM`) και `bottom` = `edgeBase` (μεταβλητός πάτος) ή `0`. Στα
 *   ανοίγματα: η **ποδιά** ακολουθεί τη βάση [base..sill], το **πρέκι** μένει στο
 *   floor-relative head [head..top] (Revit: το άνοιγμα μετριέται από το floor).
 */
function addEdge(
  group: THREE.Group,
  f0: Point3D, f1: Point3D, o0: Point3D, o1: Point3D,
  heightM: number,
  baseY: number,
  edgeCuts: readonly EnvelopeOpeningCut[],
  materialId: EnvelopeMaterialId,
  levelId?: string,
  edgeTop?: EnvelopeEdgeTop | null,
  edgeBase?: EnvelopeEdgeBase | null,
): void {
  if (!edgeTop && !edgeBase) {
    addFlatEdge(group, f0, f1, o0, o1, heightM, baseY, edgeCuts, materialId, levelId);
    return;
  }
  const top: EdgeProfile = edgeTop ?? flatProfile(heightM);
  const base: EdgeProfile | number = edgeBase ?? 0;

  if (edgeCuts.length === 0) {
    addProfiledBand(group, o0, o1, f0, f1, 0, 1, top, base, baseY, materialId, levelId);
    return;
  }
  const sorted = [...edgeCuts].sort((a, b) => a.tStart - b.tStart);
  let cursor = 0;
  let cursorO = o0;
  let cursorF = f0;
  for (const c of sorted) {
    const a = Math.max(0, Math.min(1, c.tStart));
    const b = Math.max(0, Math.min(1, c.tEnd));
    if (b - a < T_EPS) continue;
    const oA = c.bandQuad[0], oB = c.bandQuad[1], fB = c.bandQuad[2], fA = c.bandQuad[3];
    if (a > cursor + T_EPS) {
      addProfiledBand(group, cursorO, oA, cursorF, fA, cursor, a, top, base, baseY, materialId, levelId);
    }
    // Ποδιά: [base .. sill] (μεταβλητός πάτος αν base-attach). Πρέκι: [head .. top(s)].
    addProfiledBand(group, oA, oB, fA, fB, a, b, flatProfile(Math.max(0, c.sillM)), base, baseY, materialId, levelId);
    addProfiledBand(group, oA, oB, fA, fB, a, b, top, Math.max(0, c.headM), baseY, materialId, levelId);
    cursor = Math.max(cursor, b);
    cursorO = oB;
    cursorF = fB;
  }
  if (cursor < 1 - T_EPS) {
    addProfiledBand(group, cursorO, o1, cursorF, f1, cursor, 1, top, base, baseY, materialId, levelId);
  }
}

/**
 * Χτίζει το 3D κέλυφος ενός envelope chain (Z1) ως **per-edge band prisms**.
 * Διαδοχικές ακμές μοιράζονται ακριβώς τις κορυφές γωνίας (mitered offset loop)
 * → μηδέν gap, καθαρές γωνίες. Τα `cuts` σπάνε κατακόρυφα τις ακμές ώστε τα
 * ανοίγματα να μένουν διαμπερή (ADR-396 — η μόνωση δεν σκεπάζει κουφώματα).
 *
 * @param chain                 το chain από `computeEnvelopePerimeter` (P3).
 * @param heightM               ύψος ορόφου σε ΜΕΤΡΑ.
 * @param floorElevationMm      base elevation ορόφου σε mm (ίδιο με walls).
 * @param materialId            υλικό κελύφους από `ThermalEnvelopeSpec`.
 * @param levelId               ενεργός όροφος (tag).
 * @param buildingBaseElevationM building base σε ΜΕΤΡΑ (ADR-369, ίδιο με walls).
 * @param cuts                  opening cutouts από `computeEnvelopeOpeningCuts`.
 * @param edgeTops              ADR-401 B3b — μεταβλητή κορυφή ανά ακμή (ευθυγραμμισμένη
 *                              με `envelopeFaceEdges`). `null`/απών edge → επίπεδο
 *                              `heightM` (flat/μη-attached τοίχος). Όλο undefined →
 *                              ΑΜΕΤΑΒΛΗΤΟ flat κέλυφος (zero regression).
 * @param edgeBases             ADR-401 (γ) — μεταβλητή **βάση** ανά ακμή (base-attach
 *                              σε θεμέλιο). `null`/απών edge → επίπεδος πάτος `0`
 *                              (floor). Όλο undefined → ο πάτος μένει στο floor.
 * @returns null αν το chain είναι degenerate ή `heightM <= 0`.
 */
export function envelopeChainToMesh(
  chain: EnvelopeChain,
  heightM: number,
  floorElevationMm = 0,
  materialId: EnvelopeMaterialId,
  levelId?: string,
  buildingBaseElevationM = 0,
  cuts: readonly EnvelopeOpeningCut[] = [],
  edgeTops: readonly (EnvelopeEdgeTop | null)[] = [],
  edgeBases: readonly (EnvelopeEdgeBase | null)[] = [],
): THREE.Object3D | null {
  if (heightM <= 0) return null;
  const face = chain.exteriorFaceLoop.points;
  const outer = chain.insulationOuterLoop.points;
  if (face.length < 2 || outer.length !== face.length) return null;

  const baseY = floorElevationMm * MM_TO_M + buildingBaseElevationM;
  const byEdge = new Map<number, EnvelopeOpeningCut[]>();
  for (const c of cuts) {
    const arr = byEdge.get(c.edgeIndex);
    if (arr) arr.push(c);
    else byEdge.set(c.edgeIndex, [c]);
  }

  const edges = envelopeFaceEdges(chain.exteriorFaceLoop);
  const group = new THREE.Group();
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    addEdge(
      group, face[a], face[b], outer[a], outer[b],
      heightM, baseY, byEdge.get(i) ?? [], materialId, levelId,
      edgeTops[i] ?? null, edgeBases[i] ?? null,
    );
  }

  if (group.children.length === 0) return null;
  group.userData['bimType'] = 'envelope';
  if (levelId !== undefined) group.userData['levelId'] = levelId;
  return group;
}

/**
 * ADR-396 P-RENDER — Z2/Z3 flat μόνωση εκτεθειμένης πλάκας (3D).
 *
 * Λεπτή στρώση που εξωθείται από το footprint της πλάκας: Z3 (δώμα) ΠΑΝΩ από την
 * άνω παρειά (top face), Z2 (πιλοτή) ΚΑΤΩ από την κάτω παρειά (soffit). Ίδιο
 * coordinate convention με `slabToMesh` (`BimToThreeConverter:230`): `levelElevation`
 * = top face FFL, η πλάκα κρέμεται κάτω κατά `thickness`.
 *
 * @param footprint        polygon πλάκας (meters, ίδιος χώρος με wall geometry).
 * @param zone             'Z2' (κάτω) ή 'Z3' (πάνω).
 * @param slabTopMm        top face elevation της πλάκας σε mm (levelElevation + offset).
 * @param slabThicknessMm  πάχος πλάκας σε mm.
 * @param layerThicknessM  πάχος μόνωσης σε ΜΕΤΡΑ (από `envelopeLayer.thickness_m`).
 * @returns null αν degenerate footprint ή `layerThicknessM <= 0`.
 */
export function slabFlatLayerToMesh(
  footprint: readonly Point3D[],
  zone: 'Z2' | 'Z3',
  slabTopMm: number,
  slabThicknessMm: number,
  layerThicknessM: number,
  materialId: EnvelopeMaterialId,
  levelId?: string,
  baseElevationM = 0,
): THREE.Mesh | null {
  if (footprint.length < 3 || layerThicknessM <= 0) return null;

  const shape = new THREE.Shape();
  shape.moveTo(footprint[0].x, footprint[0].y);
  for (let i = 1; i < footprint.length; i++) shape.lineTo(footprint[i].x, footprint[i].y);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth: layerThicknessM, bevelEnabled: false });
  geo.applyMatrix4(ROT_X_NEG_90);

  // Extrude μετά το ROT_X_NEG_90 μεγαλώνει προς +y από το position.y.
  const slabTopM = slabTopMm * MM_TO_M + baseElevationM;
  const slabBottomM = slabTopM - slabThicknessMm * MM_TO_M;
  const posY = zone === 'Z3' ? slabTopM : slabBottomM - layerThicknessM;

  return makeEnvelopeMesh(geo, materialId, posY, levelId);
}

/**
 * ADR-396 P-RENDER — Z4 μόνωση περβαζιών ανοίγματος (3D lining), **ανά λωρίδα**.
 *
 * Ντύνει εσωτερικά τις παρειές του ανοίγματος με ρητές λωρίδες (όχι κλειστή
 * «κάννη»), ώστε να αντιστοιχούν στο φυσικό ETICS detail:
 *   - **Παραστάδες** (αριστερά/δεξιά): κατακόρυφα prisms σε όλο το ύψος ανοίγματος,
 *     πάχους `revealThicknessM` κατά τον άξονα, βάθους = πάχος τοίχου.
 *   - **Πρέκι** (πάνω): οριζόντια λωρίδα στην οροφή της τρύπας (W × T × reveal).
 *   - **Ποδιά** (κάτω): οριζόντια λωρίδα στη βάση — **ΜΟΝΟ για παράθυρα**
 *     (`sillHeightMm > 0`)· οι πόρτες (sill 0) δεν έχουν ποδιά (mirror του
 *     `buildStraightWallWithOpenings`: sill piece μόνο όταν `sillM > 0`).
 *
 * `outline` = 4 κορυφές (CCW: start-outer, end-outer, end-inner, start-inner) σε
 * scene/meter units (ίδιος χώρος με wall geometry). Κατακόρυφη βάση = `sillHeight`
 * πάνω από τη βάση ορόφου.
 *
 * @param outline          4-vertex cutout rectangle (meters).
 * @param revealThicknessM πάχος περβαζιού σε ΜΕΤΡΑ (`revealInsulation.thickness_m`).
 * @param sillHeightMm     ποδιά ανοίγματος σε mm (0 για πόρτες → χωρίς κάτω λωρίδα).
 * @param openingHeightMm  ύψος ανοίγματος σε mm.
 * @returns `THREE.Group` με τις λωρίδες, ή null αν degenerate.
 */
export function revealLiningToMesh(
  freeOutline: readonly Point3D[],
  structuralOutline: readonly Point3D[],
  revealThicknessM: number,
  sillHeightMm: number,
  openingHeightMm: number,
  floorElevationMm: number,
  baseElevationM: number,
  materialId: EnvelopeMaterialId,
  levelId?: string,
): THREE.Group | null {
  const openingHeightM = openingHeightMm * MM_TO_M;
  if (freeOutline.length < 4 || openingHeightM <= 0 || revealThicknessM <= 0) return null;

  // ADR-396 — η μόνωση τρώει τον ΤΟΙΧΟ (όχι το κούφωμα). Παραστάδες = δαχτυλίδι ΕΞΩ από
  // το free (το `computeRevealJambQuads` κάνει πλέον ring, κοινό SSoT με 2D). Πρέκι/ποδιά
  // = ΠΑΝΩ/ΚΑΤΩ από το ελεύθερο head/sill, σε structural footprint (πλήρες πλάτος).
  const jambs = computeRevealJambQuads(freeOutline, revealThicknessM);
  if (!jambs) return null;

  const tM = revealThicknessM;
  const sillM = sillHeightMm * MM_TO_M;
  const headM = sillM + openingHeightM;
  const isWindow = sillHeightMm > 0; // πόρτα (sill 0) → χωρίς ποδιά
  // Structural κατακόρυφο εύρος: πρέκι +t πάνω από head· ποδιά −t κάτω από sill (παράθυρα).
  const structBottomM = isWindow ? Math.max(0, sillM - tM) : 0;
  const structTopM = headM + tM;
  const baseY = floorElevationMm * MM_TO_M + baseElevationM;
  const lining = structuralOutline.length >= 4 ? structuralOutline : freeOutline;

  const group = new THREE.Group();
  group.userData['bimType'] = 'envelope';
  if (levelId !== undefined) group.userData['levelId'] = levelId;
  const addStrip = (quad: readonly Point3D[], depthM: number, posY: number): void => {
    if (depthM <= 1e-6) return;
    const geo = stripPrismGeometry(quad, depthM);
    if (geo) group.add(makeEnvelopeMesh(geo, materialId, posY, levelId));
  };

  // Παραστάδες — κατακόρυφες, σε όλο το structural ύψος (συναντούν πρέκι/ποδιά).
  addStrip(jambs.startJamb, structTopM - structBottomM, baseY + structBottomM);
  addStrip(jambs.endJamb, structTopM - structBottomM, baseY + structBottomM);
  // Πρέκι — οριζόντια λωρίδα ΠΑΝΩ από το head [head .. head+t].
  addStrip(lining, tM, baseY + headM);
  // Ποδιά — μόνο για παράθυρα — ΚΑΤΩ από το sill [sill−t .. sill].
  if (isWindow) addStrip(lining, tM, baseY + structBottomM);

  return group.children.length > 0 ? group : null;
}
