/**
 * marquee-3d-hit-test.ts — window/crossing hit resolution for the 3D marquee (ADR-692).
 *
 * The verdict rule and the screen-space intersection primitives are REUSED from the 2D
 * marquee SSoT (`systems/selection/marquee-direction` + `universal-marquee-geometry`) —
 * this module only adds the 3D-specific step: projecting each entity's world geometry to
 * screen space via the live camera (`viewport/coordinate-transforms.worldToScreen`).
 *
 * Pipeline per entity (a `userData.bimId`-tagged subtree of `bimLayer.group`):
 *   1. broad phase — union the world-space AABB of its meshes (BVH bounds already cached);
 *   2. project the 8 AABB corners to screen px;
 *   3. WINDOW  (L→R): keep it only if EVERY corner lands inside the rectangle
 *                     (all corners in ⇒ the convex silhouette is fully enclosed);
 *      CROSSING (R→L): keep it if the convex hull of the projected corners intersects
 *                     the rectangle (touch test — matches the 2D `polygonIntersectsRectangle`).
 *
 * This is a "select-through" test (occlusion-agnostic): an entity hidden behind another is
 * still selected if its projection falls in the box — the CAD default (Revit/AutoCAD). The
 * pixel-exact "visible-only" variant arrives in ADR-692 Φ2 (GPU id-pass).
 */

import * as THREE from 'three';
import type { Point2D } from '../../../rendering/types/Types';
import {
  getMarqueeSelectionType,
  type MarqueeSelectionType,
} from '../../../systems/selection/marquee-direction';
import { isFullyInsideWithTolerance } from '../../../systems/selection/universal-marquee-geometry';
import { worldToScreen } from '../../viewport/coordinate-transforms';
import { screenBounds, polylineIntersectsRect, screenRectFromPoints } from './marquee-screen-geometry';

export interface MarqueeHitInput {
  /** `manager.bimLayer.group` (or any tagged root). */
  group: THREE.Object3D;
  camera: THREE.Camera;
  /** The WebGL canvas (`manager.getRendererCanvas()`), for the client-rect. */
  canvas: HTMLElement;
  /** Drag anchor + live pointer, CLIENT px. */
  startPt: Point2D;
  endPt: Point2D;
  /** WINDOW slack in px (tiny entities fall back to intersect). Default 0.5. */
  tolerance?: number;
}

export interface MarqueeHitResult {
  ids: string[];
  selectionType: MarqueeSelectionType;
}

export interface BimTag {
  id: string;
  type: string;
}

/**
 * Walk the parent chain to the nearest `userData.bimId` owner (mirrors the raycaster).
 * Exported for the GPU id-pass (`marquee-gpu-id-pass`), which must tag the EXACT same
 * subtrees this CPU test tags — a second copy there would silently drift (N.18).
 */
export function resolveBimTag(obj: THREE.Object3D): BimTag | null {
  let node: THREE.Object3D | null = obj;
  while (node) {
    const id = node.userData?.['bimId'];
    if (typeof id === 'string' && id.length > 0) {
      const type = node.userData?.['bimType'];
      return { id, type: typeof type === 'string' ? type : '' };
    }
    node = node.parent;
  }
  return null;
}

/** Effective visibility: false if the object or any ancestor up to `root` is hidden. */
function isEffectivelyVisible(obj: THREE.Object3D, root: THREE.Object3D): boolean {
  let node: THREE.Object3D | null = obj;
  while (node) {
    if (!node.visible) return false;
    if (node === root) break;
    node = node.parent;
  }
  return true;
}

/** Accumulate one world-space AABB per bimId across all its (visible) meshes. */
function collectEntityBoxes(
  group: THREE.Object3D,
): Map<string, THREE.Box3> {
  const boxes = new Map<string, THREE.Box3>();
  const tmp = new THREE.Box3();
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!isEffectivelyVisible(mesh, group)) return;
    const tag = resolveBimTag(mesh);
    if (!tag) return;
    const geom = mesh.geometry;
    if (!geom.boundingBox) geom.computeBoundingBox();
    if (!geom.boundingBox) return;
    tmp.copy(geom.boundingBox).applyMatrix4(mesh.matrixWorld);
    if (tmp.isEmpty()) return;
    const existing = boxes.get(tag.id);
    if (existing) existing.union(tmp);
    else boxes.set(tag.id, tmp.clone());
  });
  return boxes;
}

const CORNER_SIGNS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
  [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
];

/** Project the 8 corners of a world AABB to screen px. Returns null if any corner is behind. */
function projectBoxCorners(
  box: THREE.Box3,
  camera: THREE.Camera,
  canvas: HTMLElement,
): Point2D[] | null {
  const pts: Point2D[] = [];
  const v = new THREE.Vector3();
  for (const [sx, sy, sz] of CORNER_SIGNS) {
    v.set(sx ? box.max.x : box.min.x, sy ? box.max.y : box.min.y, sz ? box.max.z : box.min.z);
    const screen = worldToScreen(v, camera, canvas);
    if (!screen) return null; // corner behind camera → not fully projectable
    pts.push(screen);
  }
  return pts;
}

/** Monotone-chain convex hull (screen space). Pure geometry — no external dep. */
function convexHull(points: Point2D[]): Point2D[] {
  if (points.length < 3) return points.slice();
  const pts = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o: Point2D, a: Point2D, b: Point2D): number =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point2D[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point2D[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Resolve the set of BIM entity ids whose projected geometry satisfies the marquee.
 * Pure/read-only — the caller applies the ids to the selection store.
 */
export function collectBimMarqueeHits(input: MarqueeHitInput): MarqueeHitResult {
  const { group, camera, canvas, startPt, endPt, tolerance = 0.5 } = input;
  const selectionType = getMarqueeSelectionType(startPt.x, endPt.x);
  const isCrossing = selectionType === 'crossing';
  const marqueeBounds = screenRectFromPoints(startPt, endPt);

  const ids: string[] = [];
  const boxes = collectEntityBoxes(group);
  for (const [id, box] of boxes) {
    const corners = projectBoxCorners(box, camera, canvas);
    if (!corners) continue; // partially/fully behind camera → not selectable this drag
    if (isCrossing) {
      // Το κυρτό περίβλημα ΕΙΝΑΙ κλειστό σχήμα → πλήρες polygon-vs-rect (κοινό primitive με το DXF).
      if (polylineIntersectsRect(convexHull(corners), true, marqueeBounds)) ids.push(id);
    } else {
      // WINDOW: every projected corner inside ⇒ convex silhouette fully enclosed.
      const bounds = screenBounds(corners);
      if (bounds && isFullyInsideWithTolerance(bounds, marqueeBounds, tolerance)) ids.push(id);
    }
  }
  return { ids, selectionType };
}
