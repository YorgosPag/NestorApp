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
import { sceneUnitsToMeters, type SceneUnits } from '../../utils/scene-units';
import type { Pt2 } from '../../bim/geometry/shared/segment-polygon-coverage';
import type { HorizontalFinishFace, HorizontalFinishPolygon } from '../../bim/finishes/structural-finish-horizontal';
import { extrudeAndRotate, stampBimIdentity } from './bim-three-shape-helpers';
import { scalePoints } from '../../rendering/entities/shared/geometry-vector-utils';
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

/**
 * THREE.Shape από outer ring + (πολλαπλές) τρύπες (partial coverage).
 * ADR-462 — `sceneToM` κλιμακώνει τα plan coords (canvas units) → world metres.
 */
function buildShapeWithHoles(
  outer: readonly Pt2[],
  holes: readonly (readonly Pt2[])[],
  sceneToM: number,
): THREE.Shape | null {
  if (outer.length < 3) return null;
  const o = scalePoints(outer, sceneToM); // ADR-462 canvas units → world metres (SSoT)
  const shape = new THREE.Shape();
  shape.moveTo(o[0].x, o[0].y);
  for (let i = 1; i < o.length; i++) shape.lineTo(o[i].x, o[i].y);
  shape.closePath();
  for (const hole of holes) {
    if (hole.length < 3) continue;
    const h = scalePoints(hole, sceneToM);
    const path = new THREE.Path();
    path.moveTo(h[0].x, h[0].y);
    for (let i = 1; i < h.length; i++) path.lineTo(h[i].x, h[i].y);
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
  bimType: 'column' | 'beam' | 'wall' | 'slab',
  levelId: string | undefined,
  sceneToM: number,
): THREE.Mesh | null {
  const shape = buildShapeWithHoles(poly.outer, poly.holes, sceneToM);
  if (!shape) return null;
  const geo = extrudeAndRotate(shape, face.thicknessMm * MM_TO_M);
  const mesh = new THREE.Mesh(geo, getMaterial3D(face.materialId));
  mesh.position.y = baseY;
  stampBimIdentity(mesh, { bimId: id, bimType, matId: face.materialId, levelId });
  mesh.userData['structuralFinish'] = true;
  mesh.userData['finishClassification'] = face.classification;
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
  bimType: 'column' | 'beam' | 'wall' | 'slab',
  buildingBaseElevationM: number,
  sceneUnits: SceneUnits,
  levelId?: string,
  id: string = HORIZONTAL_ID,
): THREE.Group | null {
  if (faces.length === 0) return null;
  // ADR-462 — plan footprints (canvas units) → world metres· vertical = thickness × MM_TO_M.
  const sceneToM = sceneUnitsToMeters(sceneUnits);
  const group = new THREE.Group();
  for (const face of faces) {
    const baseY = slabBaseY(face, buildingBaseElevationM);
    for (const poly of face.polygons) {
      const mesh = buildPolygonSlab(poly, face, baseY, id, bimType, levelId, sceneToM);
      if (mesh) group.add(mesh);
    }
  }
  if (group.children.length === 0) return null;
  stampBimIdentity(group, { bimId: id, bimType });
  group.userData['structuralFinish'] = true;
  // ADR-449 Slice 11 — μη-pickable: κλικ σε σοβατισμένη όψη επιλέγει τον δομικό πυρήνα πίσω.
  makeNonPickable(group);
  return group;
}
