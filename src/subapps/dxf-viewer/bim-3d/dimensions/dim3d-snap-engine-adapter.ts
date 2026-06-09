/**
 * ADR-366 Phase 9 / C.3.Q2 — 3D Snap Engine Adapter.
 *
 * Wraps the 2D snap engine concepts (vertex/midpoint/face-center) with a
 * Three.js raycaster to hit-test BIM scene geometry directly. Tolerance is
 * 12px screen-space (mirror 2D SSoT). When the raycaster intersects an edge
 * within tolerance, we snap to the closest semantic feature.
 *
 * Inputs are kept Three-native (Vector3, Raycaster) so the adapter integrates
 * with the existing `BimEntityRaycaster` pattern without re-implementing it.
 */

import {
  Mesh,
  Raycaster,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Camera,
  type Object3D,
} from 'three';
import type { Vec3 } from './dim3d-types';

export type Dim3DSnapMode = 'endpoint' | 'midpoint' | 'faceCenter' | 'guide' | 'none';

export interface Dim3DSnapResult {
  readonly mode: Dim3DSnapMode;
  readonly position: Vec3;
  readonly hostEntityId?: string;
}

export interface Dim3DSnapToggleState {
  endpoint: boolean;
  midpoint: boolean;
  faceCenter: boolean;
  guide: boolean;
}

export const DEFAULT_DIM3D_SNAP_TOGGLES: Dim3DSnapToggleState = {
  endpoint: true,
  midpoint: true,
  faceCenter: true,
  guide: true,
};

/** 12px screen-space (mirror 2D SSoT). */
export const DIM3D_SNAP_TOLERANCE_PX = 12;

const _raycaster = new Raycaster();
const _ndc = new Vector2();
const _scratch = new Vector3();

interface RaycastOptions {
  readonly camera: Camera;
  readonly clientX: number;
  readonly clientY: number;
  readonly domElement: HTMLElement;
  readonly targets: readonly Object3D[];
  readonly toggles: Dim3DSnapToggleState;
}

/**
 * Pick the closest semantic snap point in the scene under the cursor.
 * Returns 'none' when no geometry intersected or all toggles disabled.
 */
export function pickDim3DSnap(opts: RaycastOptions): Dim3DSnapResult {
  const rect = opts.domElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return { mode: 'none', position: { x: 0, y: 0, z: 0 } };
  }
  _ndc.set(
    ((opts.clientX - rect.left) / rect.width) * 2 - 1,
    -((opts.clientY - rect.top) / rect.height) * 2 + 1,
  );
  _raycaster.setFromCamera(_ndc, opts.camera);
  const hits = _raycaster.intersectObjects(opts.targets as Object3D[], true);
  if (hits.length === 0) {
    return { mode: 'none', position: { x: 0, y: 0, z: 0 } };
  }

  const hit = hits[0];
  const hostEntityId = resolveHostEntityId(hit.object);

  if (opts.toggles.endpoint) {
    const endpoint = nearestEndpoint(hit.point, hit.object);
    if (endpoint) {
      return {
        mode: 'endpoint',
        position: toVec3(endpoint),
        hostEntityId,
      };
    }
  }
  if (opts.toggles.faceCenter && hit.face) {
    _scratch.copy(hit.point);
    return { mode: 'faceCenter', position: toVec3(_scratch), hostEntityId };
  }
  if (opts.toggles.midpoint) {
    return { mode: 'midpoint', position: toVec3(hit.point), hostEntityId };
  }
  return { mode: 'none', position: toVec3(hit.point), hostEntityId };
}

// ──────────────────────────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────────────────────────

function toVec3(v: Vector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

function resolveHostEntityId(obj: Object3D): string | undefined {
  let current: Object3D | null = obj;
  while (current) {
    const id = current.userData['bimId'] as string | undefined;
    if (id) return id;
    current = current.parent;
  }
  return undefined;
}

/** Safety cap — beyond this a mesh is scanned via its bbox, not every vertex. */
const MAX_VERTEX_SCAN = 4000;

/**
 * Nearest geometry VERTEX to the world-space hit point, in WORLD space.
 *
 * ADR-363 Φ1G.5 Slice 2i-fix (Giorgio: "το gizmo δεν εμφανίζεται ακριβώς στην κορυφή"):
 * the previous implementation took the geometry's LOCAL bounding-box corners and returned
 * them WITHOUT applying the mesh's world matrix — so (a) the point was in the wrong space,
 * and (b) a diagonal / non-axis-aligned wall's AABB corners are NOT its real corners, so a
 * Ctrl+click base point never landed on the true junction vertex. Scanning the actual mesh
 * vertices (transformed to world) returns the EXACT clicked corner for any orientation.
 * Dense meshes fall back to world-transformed bbox corners (bounded cost).
 */
function nearestEndpoint(point: Vector3, obj: Object3D): Vector3 | null {
  if (!(obj instanceof Mesh)) return null;
  const geometry = obj.geometry as BufferGeometry;
  obj.updateWorldMatrix(true, false);
  const pos = geometry.getAttribute('position');
  if (!pos || pos.count === 0 || pos.count > MAX_VERTEX_SCAN) {
    return nearestBboxCornerWorld(point, obj, geometry);
  }
  let best: Vector3 | null = null;
  let bestDist = Infinity;
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
    const d = v.distanceTo(point);
    if (d < bestDist) { bestDist = d; best = v.clone(); }
  }
  return best;
}

/** Fallback for dense meshes: the 8 local bbox corners transformed to world space. */
function nearestBboxCornerWorld(point: Vector3, obj: Mesh, geometry: BufferGeometry): Vector3 | null {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  if (!bbox) return null;
  const { min, max } = bbox;
  let best: Vector3 | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < 8; i++) {
    const world = new Vector3(
      i & 1 ? max.x : min.x,
      i & 2 ? max.y : min.y,
      i & 4 ? max.z : min.z,
    ).applyMatrix4(obj.matrixWorld);
    const d = world.distanceTo(point);
    if (d < bestDist) { bestDist = d; best = world; }
  }
  return best;
}
