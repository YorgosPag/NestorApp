/**
 * ADR-449 Slice 11 — Horizontal Structural Finish 3D: faces → THREE.Group.
 *
 * Ο pure `computeHorizontalFinishFace` δίνει τις εκτεθειμένες οριζόντιες περιοχές
 * (κολόνα top/base, δοκάρι top/soffit) ως plan polygons + z + direction. Εδώ κάθε
 * περιοχή γίνεται μια **λεπτή οριζόντια πλάκα σοβά** (footprint extruded κατά
 * `thickness`), ΑΚΡΙΒΩΣ όπως ο `slabToMesh`: `buildShape` + `extrudeAndRotate`
 * (REUSE — μηδέν νέα geometry). `direction:'up'` → ο σοβάς κάθεται ΠΑΝΩ στη δομική
 * όψη (base y = z)· `'down'` → ΚΑΤΩ (top y = z, base y = z − thickness).
 *
 * Όπως ο ενιαίος silhouette σοβάς, οι οριζόντιες όψεις είναι **παράγωγη διακόσμηση**
 * → **μη-pickable** (το ray περνά στον δομικό πυρήνα από πίσω). Tag `structuralFinish`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import * as THREE from 'three';
import type { SceneUnits } from '../../utils/scene-units';
import type { Pt2 } from '../../bim/geometry/shared/segment-polygon-coverage';
import type { HorizontalFinishFace, HorizontalFinishPolygon } from '../../bim/finishes/structural-finish-horizontal';
import { extrudeAndRotate } from './bim-three-shape-helpers';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { attachEdgesProjection } from './bim-three-edges';

const MM_TO_M = 0.001;

/** Σταθερό id ομάδας οριζόντιου σοβά (visibility gate = global, ίδιο με silhouette). */
const HORIZONTAL_ID = 'structural-finish-horizontal';

/** no-op raycast — derived διακόσμηση, μη ανεξάρτητα επιλέξιμη (mirror silhouette). */
const NOOP_RAYCAST: THREE.Mesh['raycast'] = () => {};

/** Κάνει ΟΛΑ τα αντικείμενα του group μη-pickable (mesh + edges overlay) — το ray τα προσπερνά. */
function makeNonPickable(group: THREE.Group): void {
  group.traverse((obj) => {
    (obj as THREE.Mesh).raycast = NOOP_RAYCAST;
  });
}

/** THREE.Shape από outer ring + (πολλαπλές) τρύπες (partial coverage). */
function buildShapeWithHoles(outer: readonly Pt2[], holes: readonly (readonly Pt2[])[]): THREE.Shape | null {
  if (outer.length < 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(outer[0].x, outer[0].y);
  for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i].x, outer[i].y);
  shape.closePath();
  for (const hole of holes) {
    if (hole.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(hole[0].x, hole[0].y);
    for (let i = 1; i < hole.length; i++) path.lineTo(hole[i].x, hole[i].y);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

/** Y-βάση της πλάκας σοβά (world m): up → στη δομική όψη· down → πάχος κάτω από αυτήν. */
function slabBaseY(face: HorizontalFinishFace, buildingBaseElevationM: number): number {
  const zM = face.zMm * MM_TO_M;
  const thickM = face.thicknessMm * MM_TO_M;
  return buildingBaseElevationM + (face.direction === 'up' ? zM : zM - thickM);
}

/** Μία περιοχή → tagged, μη-pickable Mesh πλάκας σοβά. `null` αν εκφυλισμένη. */
function buildPolygonSlab(
  poly: HorizontalFinishPolygon,
  face: HorizontalFinishFace,
  baseY: number,
  id: string,
  bimType: 'column' | 'beam',
  levelId: string | undefined,
): THREE.Mesh | null {
  const shape = buildShapeWithHoles(poly.outer, poly.holes);
  if (!shape) return null;
  const geo = extrudeAndRotate(shape, face.thicknessMm * MM_TO_M);
  const mesh = new THREE.Mesh(geo, getMaterial3D(face.materialId));
  mesh.position.y = baseY;
  mesh.userData['bimId'] = id;
  mesh.userData['bimType'] = bimType;
  mesh.userData['structuralFinish'] = true;
  mesh.userData['matId'] = face.materialId;
  mesh.userData['finishClassification'] = face.classification;
  if (levelId !== undefined) mesh.userData['levelId'] = levelId;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  attachEdgesProjection(mesh, bimType);
  return mesh;
}

/**
 * Χτίζει ένα `THREE.Group` με τις λεπτές οριζόντιες πλάκες σοβά όλων των faces, ή
 * `null` όταν δεν προκύπτει mesh. `buildingBaseElevationM` = world datum (το z κάθε
 * face είναι building-relative). Όλα τα meshes μη-pickable.
 */
export function buildHorizontalFinishSkin(
  faces: readonly HorizontalFinishFace[],
  bimType: 'column' | 'beam',
  buildingBaseElevationM: number,
  sceneUnits: SceneUnits,
  levelId?: string,
  id: string = HORIZONTAL_ID,
): THREE.Group | null {
  void sceneUnits; // footprint ΗΔΗ σε scene units· vertical = thickness × MM_TO_M (mirror slabToMesh)
  if (faces.length === 0) return null;
  const group = new THREE.Group();
  for (const face of faces) {
    const baseY = slabBaseY(face, buildingBaseElevationM);
    for (const poly of face.polygons) {
      const mesh = buildPolygonSlab(poly, face, baseY, id, bimType, levelId);
      if (mesh) group.add(mesh);
    }
  }
  if (group.children.length === 0) return null;
  group.userData['bimId'] = id;
  group.userData['bimType'] = bimType;
  group.userData['structuralFinish'] = true;
  // ADR-449 Slice 11 — μη-pickable: κλικ σε σοβατισμένη όψη επιλέγει τον δομικό πυρήνα πίσω.
  makeNonPickable(group);
  return group;
}
