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
import type { WallEntity } from '../../bim/types/wall-types';
import type { Point3D } from '../../bim/types/bim-base';
import { stripPrismGeometry } from './envelope-three-mesh';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { attachEdgesProjection } from './bim-three-edges';
import { mmToSceneUnits } from '../../utils/scene-units';
import { computeColumnFinishFaces } from '../../bim/finishes/structural-finish-scene';
import type { FinishFaceSegment } from '../../bim/finishes/structural-finish-types';

const MM_TO_M = 0.001;
const EPS = 1e-9;

/**
 * Plan quad του band μιας παρειάς: [a, b, b+n·off, a+n·off] όπου n = μοναδιαία
 * outward normal (CCW footprint → (dy,−dx)) και `off` = πάχος σοβά σε canvas units.
 */
function buildFaceBandQuad(seg: FinishFaceSegment, offCanvas: number): Point3D[] {
  const { a, b } = seg;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return [];
  const nx = (dy / len) * offCanvas;
  const ny = (-dx / len) * offCanvas;
  return [
    { x: a.x, y: a.y, z: 0 },
    { x: b.x, y: b.y, z: 0 },
    { x: b.x + nx, y: b.y + ny, z: 0 },
    { x: a.x + nx, y: a.y + ny, z: 0 },
  ];
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
  if (!faces || faces.segments.length === 0) return null;

  const s = mmToSceneUnits(column.params.sceneUnits ?? 'mm');
  const heightM = column.params.height * MM_TO_M;
  if (heightM <= 0) return null;

  const group = new THREE.Group();
  for (const seg of faces.segments) {
    const quad = buildFaceBandQuad(seg, seg.thickness * s);
    if (quad.length < 4) continue;
    const geo = stripPrismGeometry(quad, heightM);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, getMaterial3D(seg.materialId));
    mesh.position.y = baseY;
    mesh.userData['bimId'] = column.id;
    mesh.userData['bimType'] = 'column';
    mesh.userData['structuralFinish'] = true;
    mesh.userData['matId'] = seg.materialId;
    mesh.userData['finishClassification'] = seg.classification;
    if (levelId !== undefined) mesh.userData['levelId'] = levelId;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    attachEdgesProjection(mesh, 'column');
    group.add(mesh);
  }
  if (group.children.length === 0) return null;

  group.userData['bimId'] = column.id;
  group.userData['bimType'] = 'column';
  group.userData['structuralFinish'] = true;
  return group;
}
