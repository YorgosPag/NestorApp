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
import { computeRevealJambQuads } from '../../bim/geometry/reveal-lining-geometry';
import type { EnvelopeMaterialId } from '../../bim/types/thermal-envelope-types';
import { resolveEnvelopeMaterial } from '../materials/envelope-material-resolver';
import { resolve3DEdgeStyle } from '../edges/bim-3d-edge-resolver';
import { buildEdgeOverlay, attachEdgeOverlay } from '../edges/bim-3d-edge-overlay-builder';

// Ίδια convention με BimToThreeConverter: shape XY → Y-up, mm→m για scalar params.
const ROT_X_NEG_90 = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
const MM_TO_M = 0.001;

// ADR-375 Phase C.7 — default 3D edge resolution context (mirror BimToThreeConverter).
const EDGE_DEFAULT_SCALE = 100;
const EDGE_DEFAULT_DPI = 96;

function attachEnvelopeEdges(mesh: THREE.Mesh): void {
  const style = resolve3DEdgeStyle({
    category: 'envelope',
    cutState: 'projection',
    scaleDenominator: EDGE_DEFAULT_SCALE,
    dpi: EDGE_DEFAULT_DPI,
  });
  attachEdgeOverlay(mesh, buildEdgeOverlay(mesh, style));
}

/**
 * Κοινό finalize για όλα τα envelope meshes (Z1 κέλυφος / Z2-Z3 flat layers /
 * Z4 reveal linings): υλικό + κατακόρυφη θέση + tags + shadows + edge overlay.
 * SSoT για το styling — όλες οι ζώνες μοιράζονται `elem-envelope` + edge style.
 */
function makeEnvelopeMesh(
  geometry: THREE.BufferGeometry,
  materialId: EnvelopeMaterialId,
  posY: number,
  levelId?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, resolveEnvelopeMaterial(materialId));
  mesh.position.y = posY;
  mesh.userData['bimType'] = 'envelope';
  mesh.userData['matId'] = 'elem-envelope';
  if (levelId !== undefined) mesh.userData['levelId'] = levelId;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  attachEnvelopeEdges(mesh);
  return mesh;
}

const POS_EPS = 1e-4;
const T_EPS = 1e-6;

function lerpPt(a: Point3D, b: Point3D, t: number): Point3D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 };
}

/** Band sub-quad `[O_a, O_b, F_b, F_a]` (outer fwd → inner reversed) στο [t0,t1]. */
function bandQuadAt(
  f0: Point3D, f1: Point3D, o0: Point3D, o1: Point3D, t0: number, t1: number,
): Point3D[] {
  return [lerpPt(o0, o1, t0), lerpPt(o0, o1, t1), lerpPt(f0, f1, t1), lerpPt(f0, f1, t0)];
}

/**
 * Ένα κατακόρυφο prism: band quad (canvas units) εξωθημένο κατακόρυφα στο
 * εύρος [z0,z1] (ΜΕΤΡΑ) πάνω από τη βάση `baseY`. Mirror της convention του
 * `envelopeChainToMesh` (shape XY → Y-up μέσω ROT_X_NEG_90).
 */
function addBandPrism(
  group: THREE.Group,
  quad: readonly Point3D[],
  z0: number,
  z1: number,
  baseY: number,
  materialId: EnvelopeMaterialId,
  levelId?: string,
): void {
  const depth = z1 - z0;
  if (depth <= POS_EPS) return;
  const shape = new THREE.Shape();
  shape.moveTo(quad[0].x, quad[0].y);
  for (let i = 1; i < quad.length; i++) shape.lineTo(quad[i].x, quad[i].y);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.applyMatrix4(ROT_X_NEG_90);
  group.add(makeEnvelopeMesh(geo, materialId, baseY + z0, levelId));
}

/**
 * Χτίζει μια ακμή του κελύφους με κατακόρυφο split στα ανοίγματα: solid spans
 * πλήρους ύψους + ανά άνοιγμα prism κάτω από ποδιά [0,sill] + πάνω από πρέκι
 * [head,height]. Το κενό του κουφώματος μένει διαμπερές (Z4 reveal το ντύνει).
 */
function addEdge(
  group: THREE.Group,
  f0: Point3D, f1: Point3D, o0: Point3D, o1: Point3D,
  heightM: number,
  baseY: number,
  edgeCuts: readonly EnvelopeOpeningCut[],
  materialId: EnvelopeMaterialId,
  levelId?: string,
): void {
  if (edgeCuts.length === 0) {
    addBandPrism(group, bandQuadAt(f0, f1, o0, o1, 0, 1), 0, heightM, baseY, materialId, levelId);
    return;
  }
  const sorted = [...edgeCuts].sort((a, b) => a.tStart - b.tStart);
  let cursor = 0;
  for (const c of sorted) {
    const a = Math.max(0, Math.min(1, c.tStart));
    const b = Math.max(0, Math.min(1, c.tEnd));
    if (b - a < T_EPS) continue;
    if (a > cursor + T_EPS) {
      addBandPrism(group, bandQuadAt(f0, f1, o0, o1, cursor, a), 0, heightM, baseY, materialId, levelId);
    }
    const sill = Math.max(0, Math.min(heightM, c.sillM));
    const head = Math.max(0, Math.min(heightM, c.headM));
    const span = bandQuadAt(f0, f1, o0, o1, a, b);
    if (sill > POS_EPS) addBandPrism(group, span, 0, sill, baseY, materialId, levelId);
    if (head < heightM - POS_EPS) addBandPrism(group, span, head, heightM, baseY, materialId, levelId);
    cursor = Math.max(cursor, b);
  }
  if (cursor < 1 - T_EPS) {
    addBandPrism(group, bandQuadAt(f0, f1, o0, o1, cursor, 1), 0, heightM, baseY, materialId, levelId);
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

/** Prism από ένα plan quad (scene/meter units) εξωθημένο κατά `depthM` (Y-up). */
function stripPrismGeometry(quad: readonly Point3D[], depthM: number): THREE.BufferGeometry | null {
  if (quad.length < 3 || depthM <= 0) return null;
  const shape = new THREE.Shape();
  shape.moveTo(quad[0].x, quad[0].y);
  for (let i = 1; i < quad.length; i++) shape.lineTo(quad[i].x, quad[i].y);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: depthM, bevelEnabled: false });
  geo.applyMatrix4(ROT_X_NEG_90);
  return geo;
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
