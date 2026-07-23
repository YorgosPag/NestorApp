/**
 * BimEntityRaycaster — THREE.Raycaster wrapper for BIM entity picking.
 *
 * Casts a ray from the camera through the cursor NDC point and returns the
 * first BimSceneLayer mesh hit (identified by userData.bimId + userData.bimType).
 *
 * Module-level singleton raycaster avoids per-call allocation.
 * ADR-366 B.2.Q1.
 */

import * as THREE from 'three';
import { slotFaceKey } from '../../../bim/types/face-appearance-types';

export interface RaycastHit {
  readonly bimId: string;
  readonly bimType: string;
  /**
   * ADR-539 — present only on a faced-prism hit (Polygon Mode): the `FaceKey`
   * of the picked όψη, resolved from `hit.face.materialIndex` via the mesh's
   * `userData.faceKeyByMaterialIndex`. Absent on legacy single-material meshes.
   */
  readonly faceKey?: string;
  /**
   * ADR-358 Q19 — present only on a STAIR sub-element hit (tread/riser/stringer/…):
   * `userData.stairComponent` of the picked mesh. Enables «click-into components»
   * per-tread selection without exploding the stair into entities.
   */
  readonly stairPart?: string;
  /**
   * ADR-358 Q19 — 0-based index of the picked stair sub-element within its geometry
   * array (`userData.stairComponentIndex`), matching `resolveStairMaterial`'s
   * `treadIndex`. Present with `stairPart` on tread/riser hits.
   */
  readonly stairSubIndex?: number;
}

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _planeNormal = new THREE.Vector3();
const _plane = new THREE.Plane();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _groundPlane = new THREE.Plane();
const _groundCoplanar = new THREE.Vector3();
const _groundPoint = new THREE.Vector3();

/**
 * SSoT client (px) → NDC [-1,1] conversion against a dom element rect.
 * Writes into the module-level `_ndc` and returns it, or null when the rect
 * has zero area (element not laid out yet).
 *
 * Exported (ADR-403) so the 3D placement floor-plane raycaster reuses the ONE
 * client→NDC math instead of re-deriving the rect arithmetic. The returned
 * vector is the shared module singleton — consume it immediately (e.g. pass to
 * `raycaster.setFromCamera`, which copies it) before the next call.
 */
export function clientToNdc(domElement: HTMLElement, clientX: number, clientY: number): THREE.Vector2 | null {
  const rect = domElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  _ndc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  return _ndc;
}

/**
 * SSoT preamble for every cursor raycast: client px → NDC → set the shared
 * `_raycaster` from the camera → return the depth-sorted intersections against
 * `group`'s children. Returns null ONLY when the dom rect has zero area (element
 * not laid out); a valid-but-empty ray yields `[]`. Reuses the module singletons
 * (`_raycaster`, `_ndc`) — no per-call allocation — and leaves `_raycaster.ray`
 * set for callers that need the plane-fallback ray afterwards.
 */
function castThroughCursor(
  group: THREE.Group,
  camera: THREE.Camera,
  domElement: HTMLElement,
  clientX: number,
  clientY: number,
): THREE.Intersection[] | null {
  const ndc = clientToNdc(domElement, clientX, clientY);
  if (!ndc) return null;
  _raycaster.setFromCamera(ndc, camera);
  return _raycaster.intersectObjects(group.children, true);
}

/**
 * Walk up the parent chain from a hit object to the mesh tagged (by `tagMesh`)
 * with both `bimId` and `bimType`; returns the tagged object + ids, or null when
 * no ancestor is a BIM entity (helper / untagged mesh).
 */
function resolveTaggedBim(
  from: THREE.Object3D,
): { readonly obj: THREE.Object3D; readonly bimId: string; readonly bimType: string } | null {
  let obj: THREE.Object3D | null = from;
  while (obj) {
    const bimId = obj.userData['bimId'] as string | undefined;
    const bimType = obj.userData['bimType'] as string | undefined;
    if (bimId && bimType) return { obj, bimId, bimType };
    obj = obj.parent;
  }
  return null;
}

/**
 * Raycast against all direct children of `group` (BimSceneLayer meshes).
 * Uses the renderer domElement bounding rect for client → NDC conversion.
 */
export function raycastBimGroup(
  group: THREE.Group,
  camera: THREE.Camera,
  domElement: HTMLElement,
  clientX: number,
  clientY: number,
): RaycastHit | null {
  const hits = castThroughCursor(group, camera, domElement, clientX, clientY);
  if (!hits) return null;
  for (const hit of hits) {
    const tagged = resolveTaggedBim(hit.object);
    if (tagged) {
      return { bimId: tagged.bimId, bimType: tagged.bimType, ...stairSubElementFields(tagged.obj) };
    }
  }
  return null;
}

/**
 * ADR-358 Q19 — read the optional stair sub-element tag (`stairComponent` +
 * `stairComponentIndex`) off the tagged mesh, enabling «click-into components»
 * per-tread picking. Returns `{}` for non-stair meshes (no keys spread onto the
 * `RaycastHit`).
 */
function stairSubElementFields(
  obj: THREE.Object3D,
): { stairPart?: string; stairSubIndex?: number } {
  const stairPart = obj.userData['stairComponent'] as string | undefined;
  if (stairPart === undefined) return {};
  const idx = obj.userData['stairComponentIndex'] as number | undefined;
  return idx === undefined ? { stairPart } : { stairPart, stairSubIndex: idx };
}

/**
 * ADR-686 — το όνομα υλικού του slot που χτυπήθηκε σε ΕΙΣΑΓΟΜΕΝΟ mesh (καρέκλα = μπράτσα/κάθισμα/
 * πλάτη). Τα imported δεν έχουν `faceKeyByMaterialIndex` (structural-only)· το slot addressing
 * γίνεται by-material-name, ίδιο SSoT με το `materialSlots` + το 2D `SlotSilhouette`. `null` όταν
 * το χτυπημένο material δεν έχει όνομα (unaddressable slot).
 */
function hitMeshSlotName(object: THREE.Object3D, matIndex: number | undefined): string | null {
  if (!(object instanceof THREE.Mesh)) return null;
  const m = object.material;
  const mat = Array.isArray(m) ? (matIndex !== undefined ? m[matIndex] : undefined) : m;
  return mat?.name ? mat.name : null;
}

/** ADR-040 Φ-3D-pointer — one-pass result: hover entity (nullable) + front-most world point. */
export interface BimHitAndWorld {
  /** Tagged entity id of the first hit carrying `userData.bimId`, or null (untagged/helper mesh). */
  readonly bimId: string | null;
  readonly bimType: string | null;
  /** Front-most surface point (closest to camera) — a fresh Vector3, safe to retain. */
  readonly worldPoint: THREE.Vector3;
}

/**
 * ADR-040 Φ-3D-pointer — UNIFIED hover+snap raycast. The hover-highlight pick
 * (`raycastBimGroup`) and the snap world-point (`raycastWorldPoint`) used to fire TWO separate
 * `intersectObjects` passes over the SAME geometry on every move; this does it in ONE.
 *
 * Returns the front-most surface point (mirror `raycastWorldPoint`) AND the first tagged
 * bimId/bimType (mirror `raycastBimGroup`), or null when the ray misses geometry. `bimId` may be
 * null on a hit over an untagged mesh while `worldPoint` is still valid — the caller decides
 * (DXF fallback for hover; the world point still drives the snap engine).
 */
export function raycastBimHitAndWorld(
  group: THREE.Group,
  camera: THREE.Camera,
  domElement: HTMLElement,
  clientX: number,
  clientY: number,
): BimHitAndWorld | null {
  const hits = castThroughCursor(group, camera, domElement, clientX, clientY);
  if (!hits || hits.length === 0) return null;

  // Front-most hit point (intersectObjects is distance-sorted ascending).
  const worldPoint = hits[0].point.clone();

  // First hit whose tagged mesh resolves a bimId (walk up parents) — mirror raycastBimGroup.
  let bimId: string | null = null;
  let bimType: string | null = null;
  for (const hit of hits) {
    const tagged = resolveTaggedBim(hit.object);
    if (tagged) { bimId = tagged.bimId; bimType = tagged.bimType; break; }
  }
  return { bimId, bimType, worldPoint };
}

/**
 * ADR-539 — face-level raycast for Cinema 4D «Polygon Mode». Like `raycastBimGroup`
 * but ALSO resolves the picked `FaceKey` from `hit.face.materialIndex` against the
 * mesh's `userData.faceKeyByMaterialIndex` (set by the faced-prism converter).
 *
 * Φ2 — a FACED face wins over any non-faced hit in front of it: the invisible slab-opening
 * pick-mesh (no `faceKeyByMaterialIndex`) sits over each opening, so a naive «first hit»
 * would let it steal the click on a hole wall and return no faceKey. We therefore iterate
 * the depth-sorted hits and return the FIRST one carrying a faceKey; only if none is faced
 * do we fall back to the first plain entity hit (so a click on a non-faced solid still
 * selects the entity). Active ONLY in Polygon mode (`use-bim3d-pointer-handlers`).
 */
export function raycastBimFace(
  group: THREE.Group,
  camera: THREE.Camera,
  domElement: HTMLElement,
  clientX: number,
  clientY: number,
): RaycastHit | null {
  let entityFallback: RaycastHit | null = null;
  // `?? []` — a bad dom rect (null) yields no hits, so we return the null fallback below.
  for (const hit of castThroughCursor(group, camera, domElement, clientX, clientY) ?? []) {
    // Walk up to the tagged mesh (mirror raycastBimGroup) to resolve bimId/bimType.
    const tagged = resolveTaggedBim(hit.object);
    if (!tagged) continue;
    const { bimId, bimType } = tagged;
    // ADR-539 — faceKey from the hit mesh's group→materialIndex map (faced prism only).
    const faceKeys = hit.object.userData['faceKeyByMaterialIndex'] as readonly string[] | undefined;
    const matIndex = hit.face?.materialIndex;
    const faceKey = faceKeys && matIndex !== undefined ? faceKeys[matIndex] : undefined;
    if (faceKey !== undefined) return { bimId, bimType, faceKey }; // faced face wins immediately
    // ADR-686 — imported mesh: per-slot faceKey από το material name του χτυπημένου slot (front-most
    // slot κερδίζει, mirror του faced). Ο χρήστης στοχεύει το κομμάτι (μπράτσο) κάτω απ' τον κέρσορα.
    if (bimType === 'imported-mesh') {
      const slotName = hitMeshSlotName(hit.object, matIndex);
      if (slotName) return { bimId, bimType, faceKey: slotFaceKey(slotName) };
    }
    // ADR-358 Q19 / ADR-539 Φ6 (Giorgio 2026-07-23) — μια παραμετρική σκάλα ΔΕΝ είναι faced-prism·
    // κρατά τα δικά της tread/riser/landing/waist meshes (`stairComponent` tags). Μεταφέρουμε αυτά
    // τα fields στο fallback ώστε, μέσα στο «ΠΟΛΥΓΩΝΑ», το κλικ σε σκαλί να επιλέγει το sub-element
    // (mirror του `raycastBimGroup`), αντί για ολόκληρη τη σκάλα.
    entityFallback ??= { bimId, bimType, ...stairSubElementFields(tagged.obj) }; // nearest non-faced hit
  }
  return entityFallback;
}

/**
 * Raycast against `group` and return the WORLD-space intersection point of the
 * first surface hit (closest to camera), or null when the ray misses geometry.
 *
 * Used by the Alt+click orbit-pivot feature (ADR-366 §A.6.Q5): the picked point
 * becomes the new camera orbit center. Returns a fresh Vector3 (safe to retain).
 */
export function raycastWorldPoint(
  group: THREE.Group,
  camera: THREE.Camera,
  domElement: HTMLElement,
  clientX: number,
  clientY: number,
): THREE.Vector3 | null {
  const hits = castThroughCursor(group, camera, domElement, clientX, clientY);
  if (!hits) return null;
  // intersectObjects returns hits sorted by distance ascending — first = closest.
  return hits.length > 0 ? hits[0].point.clone() : null;
}

/**
 * Like `raycastWorldPoint`, but on a geometry MISS falls back — in order — to:
 *   1. the horizontal floor plane at `groundY` (when provided), where the DXF
 *      overlay lives (`DxfToThreeConverter` maps DXF → Y-up floor plane at Y=0),
 *      so a click on the DXF wireframe / empty floor yields the REAL point under
 *      the cursor at floor depth — not a point at the wrong depth;
 *   2. a camera-facing plane through `fallbackThrough` (the current orbit target)
 *      for upward / "sky" clicks that never meet the floor in front of the camera.
 *
 * Without (1), Alt+drag on a DXF object orbited around the wrong-depth fallback
 * point → «σε αντικείμενο DXF η περιστροφή έφευγε στο κέντρο» (a BIM mesh hit was
 * fine because it returns the true surface point). ADR-366 §A.6.Q5 v5.
 */
export function raycastWorldPointOrPlane(
  group: THREE.Group,
  camera: THREE.Camera,
  domElement: HTMLElement,
  clientX: number,
  clientY: number,
  fallbackThrough: THREE.Vector3,
  groundY: number | null = null,
): THREE.Vector3 | null {
  // castThroughCursor also leaves `_raycaster.ray` set for the plane fallbacks below.
  const hits = castThroughCursor(group, camera, domElement, clientX, clientY);
  if (!hits) return null;
  if (hits.length > 0) return hits[0].point.clone();

  // (1) DXF / floor-plan click → intersect the real horizontal floor plane.
  if (groundY !== null) {
    _groundCoplanar.set(0, groundY, 0);
    _groundPlane.setFromNormalAndCoplanarPoint(_worldUp, _groundCoplanar);
    if (_raycaster.ray.intersectPlane(_groundPlane, _groundPoint)) return _groundPoint.clone();
  }

  // (2) Upward / empty-sky click → camera-facing plane through the look target.
  camera.getWorldDirection(_planeNormal);
  _plane.setFromNormalAndCoplanarPoint(_planeNormal, fallbackThrough);
  const point = new THREE.Vector3();
  return _raycaster.ray.intersectPlane(_plane, point) ? point : null;
}
