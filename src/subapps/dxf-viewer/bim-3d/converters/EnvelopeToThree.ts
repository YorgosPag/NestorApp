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

  const mesh = new THREE.Mesh(geo, resolveEnvelopeMaterial(materialId));
  // Ίδια κατακόρυφη βάση με τους τοίχους που τυλίγει (wallToMesh:159).
  mesh.position.y = floorElevationMm * MM_TO_M + buildingBaseElevationM;
  mesh.userData['bimType'] = 'envelope';
  mesh.userData['matId'] = 'elem-envelope';
  if (levelId !== undefined) mesh.userData['levelId'] = levelId;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  attachEnvelopeEdges(mesh);
  return mesh;
}
