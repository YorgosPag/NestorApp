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
import type { EnvelopeMaterialId } from '../../bim/types/thermal-envelope-types';
import { insetClosedPolygon } from '../../bim/geometry/shared/polygon-utils';
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

/**
 * Band cross-section: outer (insulation outer face) forward → inner (wall exterior
 * face) reversed → close. Mirror του `buildWallShape`.
 */
function buildBandShape(outer: readonly Point3D[], inner: readonly Point3D[]): THREE.Shape | null {
  if (outer.length < 2 || inner.length < 2) return null;
  const shape = new THREE.Shape();
  shape.moveTo(outer[0].x, outer[0].y);
  for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i].x, outer[i].y);
  for (let i = inner.length - 1; i >= 0; i--) shape.lineTo(inner[i].x, inner[i].y);
  shape.closePath();
  return shape;
}

/**
 * Χτίζει το 3D mesh ενός envelope chain (Z1 κατακόρυφο κέλυφος).
 *
 * @param chain                 το chain από `computeEnvelopePerimeter` (P3).
 * @param heightM               ύψος ορόφου σε ΜΕΤΡΑ (extrude depth).
 * @param floorElevationMm      base elevation ορόφου σε mm (ίδιο με walls).
 * @param materialId            υλικό κελύφους από `ThermalEnvelopeSpec`.
 * @param levelId               ενεργός όροφος (tag).
 * @param buildingBaseElevationM building base σε ΜΕΤΡΑ (ADR-369, ίδιο με walls).
 * @returns null αν το chain είναι degenerate ή `heightM <= 0`.
 */
export function envelopeChainToMesh(
  chain: EnvelopeChain,
  heightM: number,
  floorElevationMm = 0,
  materialId: EnvelopeMaterialId,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Mesh | null {
  if (heightM <= 0) return null;
  const shape = buildBandShape(chain.insulationOuterLoop.points, chain.exteriorFaceLoop.points);
  if (!shape) return null;

  const geo = new THREE.ExtrudeGeometry(shape, { depth: heightM, bevelEnabled: false });
  geo.applyMatrix4(ROT_X_NEG_90);

  // Ίδια κατακόρυφη βάση με τους τοίχους που τυλίγει (wallToMesh:159).
  return makeEnvelopeMesh(
    geo,
    materialId,
    floorElevationMm * MM_TO_M + buildingBaseElevationM,
    levelId,
  );
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
 * ADR-396 P-RENDER — Z4 μόνωση περβαζιών ανοίγματος (3D lining).
 *
 * Frame (band ανάμεσα στο `outline` της τρύπας και το inset του) εξωθημένο
 * καθ' ύψος του ανοίγματος — ντύνει εσωτερικά τις 4 παρειές (αρ./δεξ./πάνω/κάτω).
 * `outline` = meters (ίδιος χώρος με wall geometry). Κατακόρυφη βάση = ποδιά
 * ανοίγματος (`sillHeight`) πάνω από τη βάση ορόφου (mirror `wall-opening-extrude`).
 *
 * @param outline          4-vertex cutout rectangle (meters).
 * @param revealThicknessM πάχος περβαζιού σε ΜΕΤΡΑ (`revealInsulation.thickness_m`).
 * @param sillHeightMm     ποδιά ανοίγματος σε mm (0 για πόρτες).
 * @param openingHeightMm  ύψος ανοίγματος σε mm.
 * @returns null αν degenerate inset/outline ή ύψος ≤ 0.
 */
export function revealLiningToMesh(
  outline: readonly Point3D[],
  revealThicknessM: number,
  sillHeightMm: number,
  openingHeightMm: number,
  floorElevationMm: number,
  baseElevationM: number,
  materialId: EnvelopeMaterialId,
  levelId?: string,
): THREE.Mesh | null {
  const openingHeightM = openingHeightMm * MM_TO_M;
  if (openingHeightM <= 0 || revealThicknessM <= 0) return null;

  const inner = insetClosedPolygon(outline, revealThicknessM);
  if (!inner) return null;
  const shape = buildBandShape(outline, inner);
  if (!shape) return null;

  const geo = new THREE.ExtrudeGeometry(shape, { depth: openingHeightM, bevelEnabled: false });
  geo.applyMatrix4(ROT_X_NEG_90);

  const posY = floorElevationMm * MM_TO_M + baseElevationM + sillHeightMm * MM_TO_M;
  return makeEnvelopeMesh(geo, materialId, posY, levelId);
}
