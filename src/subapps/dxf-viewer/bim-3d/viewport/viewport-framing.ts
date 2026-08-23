/**
 * Zoom-to-fit calculations for perspective and orthographic cameras.
 * PORT_AS_IS from GenArc viewportFraming.ts (ADR-366 §8.2 SPEC-3D-004A).
 * Phase 4.1: computeFramingForView convenience wrapper for canonical views.
 */

import * as THREE from 'three';
import { DEFAULT_ORTHO_SIZE, FRAME_PADDING_FACTOR, ORTHO_CAMERA_UP } from './viewport-constants';
import type { CanonicalViewId } from './viewport-types';
import { getCanonicalViewDef } from './canonical-views';

export interface FramingResult {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
  readonly orthoZoom: number;
}

const _center = new THREE.Vector3();
const _size = new THREE.Vector3();

export function computePerspectiveFraming(
  min: THREE.Vector3,
  max: THREE.Vector3,
  viewDir: THREE.Vector3,
  aspect: number,
  fovDeg: number,
): FramingResult {
  _center.addVectors(min, max).multiplyScalar(0.5);
  _size.subVectors(max, min);
  const radius = _size.length() * 0.5;
  const fovRad = THREE.MathUtils.degToRad(fovDeg);
  const effectiveFov = aspect >= 1
    ? fovRad
    : 2 * Math.atan(Math.tan(fovRad / 2) * aspect);
  const distance = (radius / Math.tan(effectiveFov / 2)) * FRAME_PADDING_FACTOR;
  const position = new THREE.Vector3().copy(_center).addScaledVector(viewDir, -distance);
  return { position, target: _center.clone(), orthoZoom: 1 };
}

/**
 * Άξονο-ευθυγραμμισμένο κουτί σκηνής σε **world space, ΤΡΙΩΝ διαστάσεων**.
 *
 * ⚠️ Λεγόταν `SceneBounds` μέχρι το ADR-795, δηλαδή **ΤΟ ΙΔΙΟ ΟΝΟΜΑ** με **πέντε**
 * δισδιάστατα `SceneBounds` του δέντρου (`types/scene-types.ts` · `lib/dxf-scene/
 * scene-fit-transform.ts` · `components/.../overlay-renderer/types.ts` · κ.ά.). Τα πέντε 2Δ
 * είναι **αμοιβαία συμβατά**, άρα η μεταξύ τους σύγχυση είναι αθόρυβη· αυτό εδώ όμως έχει
 * **τρίτη διάσταση**, και μια τιμή του περνούσε ως «SceneBounds» σε αναγνώστη που περίμενε
 * κάτοψη — το `z` απλώς **αγνοούνταν**. Το όνομα λέει πλέον τη διάσταση.
 *
 * 🏆 Το πρότυπο είναι ομόφωνο και το ακολουθούμε: three.js `Box3` (έναντι `Box2`) ·
 * Revit `BoundingBoxXYZ` (έναντι `BoundingBoxUV`) · ArchiCAD `API_Box3D` (έναντι `Bbox`) ·
 * Rhino `BoundingBox` 3Δ. **Το όνομα δηλώνει τι ΕΓΓΥΑΤΑΙ**, ποτέ ποιος το χρησιμοποιεί.
 *
 * ⚠️ **ΜΗΝ το αντικαταστήσεις με σκέτο `THREE.Box3`**: ο μοναδικός καλών
 * (`viewport-camera.frameHome`) περνά **object literal** `{ min, max }`, που δεν έχει τις
 * μεθόδους της κλάσης — θα απαιτούσε `new THREE.Box3(...)` σε κάθε κλήση, δηλαδή κατανομή
 * αντικειμένου σε διαδρομή που σήμερα δεν κάνει καμία.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-795-rect-vocabulary-persistence.md
 */
export interface SceneBox3 {
  readonly min: THREE.Vector3;
  readonly max: THREE.Vector3;
}

/**
 * Compute framing for a canonical view ID given scene bounds.
 * Ortho views use computeOrthoFraming; iso/perspective use computePerspectiveFraming.
 * Phase 4.1 — used by CanonicalViewService.snapTo with frame-to-fit (Phase 4.4+).
 */
export function computeFramingForView(
  viewId: CanonicalViewId,
  bounds: SceneBox3,
  aspect: number,
  fovDeg: number,
): FramingResult {
  const def = getCanonicalViewDef(viewId);
  if (!def) {
    const fallbackDir = new THREE.Vector3(1, 0, 0);
    return computePerspectiveFraming(bounds.min, bounds.max, fallbackDir, aspect, fovDeg);
  }
  const viewDir = new THREE.Vector3(def.lookDir[0], def.lookDir[1], def.lookDir[2]).normalize();
  if (def.type === 'ortho' && def.projectionMode) {
    const upArr = ORTHO_CAMERA_UP[def.projectionMode] ?? [0, 1, 0];
    const up = new THREE.Vector3(upArr[0], upArr[1], upArr[2]);
    return computeOrthoFraming(bounds.min, bounds.max, viewDir, up, aspect);
  }
  return computePerspectiveFraming(bounds.min, bounds.max, viewDir, aspect, fovDeg);
}

export function computeOrthoFraming(
  min: THREE.Vector3,
  max: THREE.Vector3,
  viewDir: THREE.Vector3,
  cameraUp: THREE.Vector3,
  aspect: number,
): FramingResult {
  _center.addVectors(min, max).multiplyScalar(0.5);
  _size.subVectors(max, min);
  const right = new THREE.Vector3().crossVectors(viewDir, cameraUp).normalize();
  const up = new THREE.Vector3().crossVectors(right, viewDir).normalize();
  const halfX = Math.abs(_size.dot(right)) * 0.5;
  const halfY = Math.abs(_size.dot(up)) * 0.5;
  const zoomX = aspect > 0 ? DEFAULT_ORTHO_SIZE / (halfX * FRAME_PADDING_FACTOR) : 1;
  const zoomY = DEFAULT_ORTHO_SIZE / (halfY * FRAME_PADDING_FACTOR);
  const orthoZoom = Math.min(zoomX, zoomY);
  const position = new THREE.Vector3().copy(_center).addScaledVector(viewDir, -50);
  return { position, target: _center.clone(), orthoZoom: Math.max(orthoZoom, 0.01) };
}
