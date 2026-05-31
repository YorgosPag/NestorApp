/**
 * envelope-three-mesh — ADR-396 — κοινά low-level THREE helpers για το envelope rendering.
 *
 * SSoT για το mesh-finalize (υλικό + edge overlay + tags + shadows) και τα στοιχειώδη
 * prism builders που μοιράζονται οι ζώνες Z1 (κέλυφος, `EnvelopeToThree`), Z2/Z3 (flat
 * layers) και Z4 (reveal linings). Εξήχθη από το `EnvelopeToThree.ts` (N.7.1 size-split)
 * ώστε ο converter να μένει ≤500 γραμμές χωρίς διπλασιασμό του styling.
 *
 * Ίδια coordinate convention με `BimToThreeConverter`: shape XY → world Y-up μέσω
 * `ROT_X_NEG_90`, mm→m για scalar params.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md
 */

import * as THREE from 'three';
import type { Point3D } from '../../bim/types/bim-base';
import type { EnvelopeMaterialId } from '../../bim/types/thermal-envelope-types';
import { resolveEnvelopeMaterial } from '../materials/envelope-material-resolver';
import { resolve3DEdgeStyle } from '../edges/bim-3d-edge-resolver';
import { buildEdgeOverlay, attachEdgeOverlay } from '../edges/bim-3d-edge-overlay-builder';

// Ίδια convention με BimToThreeConverter: shape XY → Y-up, mm→m για scalar params.
export const ROT_X_NEG_90 = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
export const MM_TO_M = 0.001;
export const POS_EPS = 1e-4;
export const T_EPS = 1e-6;

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
export function makeEnvelopeMesh(
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
 * Band quad `[O_start, O_end, F_end, F_start]` (outer fwd → inner reversed) από
 * ρητά σημεία. Στα όρια ανοίγματος τα O είναι οι **κάθετες** απολήξεις του
 * `cut.bandQuad` (collinear με Z4)· στις γωνίες είναι οι κορυφές του outer loop.
 */
export function makeQuad(oStart: Point3D, oEnd: Point3D, fStart: Point3D, fEnd: Point3D): Point3D[] {
  return [oStart, oEnd, fEnd, fStart];
}

/**
 * Ένα κατακόρυφο prism: band quad (canvas units) εξωθημένο κατακόρυφα στο
 * εύρος [z0,z1] (ΜΕΤΡΑ) πάνω από τη βάση `baseY`. Mirror της convention του
 * `envelopeChainToMesh` (shape XY → Y-up μέσω ROT_X_NEG_90).
 */
export function addBandPrism(
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

/** Prism από ένα plan quad (scene/meter units) εξωθημένο κατά `depthM` (Y-up). */
export function stripPrismGeometry(quad: readonly Point3D[], depthM: number): THREE.BufferGeometry | null {
  if (quad.length < 3 || depthM <= 0) return null;
  const shape = new THREE.Shape();
  shape.moveTo(quad[0].x, quad[0].y);
  for (let i = 1; i < quad.length; i++) shape.lineTo(quad[i].x, quad[i].y);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: depthM, bevelEnabled: false });
  geo.applyMatrix4(ROT_X_NEG_90);
  return geo;
}
