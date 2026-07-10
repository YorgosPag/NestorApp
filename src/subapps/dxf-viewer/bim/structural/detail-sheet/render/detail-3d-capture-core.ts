/**
 * ADR-463 — Shared offscreen 3D-capture scaffolding (detail sheets, SSoT).
 *
 * Τα κοινά building blocks της isometric raster λήψης που μοιράζονται το column
 * (ADR-457) και το footing (ADR-463) perspective capture: ο translucent concrete
 * prism, η isometric κάμερα με tight-fit, η προβολή σε normalised raster space, ο
 * synchronous offscreen render (unlit `MeshBasicMaterial`, mirror
 * `print/capture/capture-3d.ts`) και το dispose των resources που δημιουργεί.
 *
 * **Pure THREE** (zero store/Firestore/DOM-app import) — ADR-040 safe (fully
 * offscreen, ποτέ δεν αγγίζει το live renderer/scene). Πρώην ζούσαν inline στο
 * `column-detail-3d-capture.ts`· εξήχθησαν εδώ (N.0.2). Το column capture migrate-
 * άρεται on-touch (βλ. .claude-rules/pending-ratchet-work.md).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/detail-3d-capture-core
 * @see docs/centralized-systems/reference/adrs/ADR-463-foundation-reinforcement-ux.md
 */

import * as THREE from 'three';
import type { Point2D } from '../../../../rendering/types/Types';
import { finiteBox3FromObject } from '../../../../bim-3d/scene/finite-bounds';

/** mm → metres (the vertical convention shared with the rebar cages). */
export const MM_TO_M = 0.001;
/** White sheet background so the raster blends into the paper. */
export const SCENE_BG_HEX = 0xffffff;
/** Faint concrete edge / face colours (match the 2D plan/elevation outline). */
const CONCRETE_EDGE_HEX = 0xb0b0b0;
const CONCRETE_FACE_HEX = 0xcfcfcf;
const CONCRETE_FACE_OPACITY = 0.12;
/** Isometric framing (Revit-grade): 45° azimuth, ~35° elevation, element upright. */
export const CAMERA_AZIMUTH_RAD = Math.PI / 4;
const CAMERA_ELEVATION_RAD = (35.264 * Math.PI) / 180;
const CAMERA_FOV_DEG = 35;
/** Small margin around the tight projected-bbox fit (headroom for annotations). */
const FIT_MARGIN = 1.06;

/** A point in normalised raster space ([0..1], origin top-left, y-down). */
export type NormPoint = Point2D;

/**
 * Translucent concrete prism (footprint extruded along +height) + crisp edge
 * overlay, in metre coords with the AXIS_FLIP (plan x,y → three x, up, −y) baked
 * by `rotateX(-90°)` — identical world frame as the rebar cages. Returns `null`
 * for a degenerate footprint/height. The caller owns disposal via {@link disposeOwned}.
 */
export function buildConcretePrism(planVertsMetres: readonly Point2D[], heightM: number): THREE.Group | null {
  if (planVertsMetres.length < 3 || heightM <= 0) return null;
  const shape = new THREE.Shape();
  shape.moveTo(planVertsMetres[0].x, planVertsMetres[0].y);
  for (let i = 1; i < planVertsMetres.length; i++) shape.lineTo(planVertsMetres[i].x, planVertsMetres[i].y);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: heightM, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);

  const group = new THREE.Group();
  const faceMat = new THREE.MeshBasicMaterial({
    color: CONCRETE_FACE_HEX, transparent: true, opacity: CONCRETE_FACE_OPACITY,
    depthWrite: false, side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(geo, faceMat));
  const edges = new THREE.EdgesGeometry(geo);
  group.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: CONCRETE_EDGE_HEX })));
  return group;
}

/** Fully disposes a group we own (geometry + materials). No-op for `null`. */
export function disposeOwned(group: THREE.Group | null): void {
  if (!group) return;
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
      obj.geometry.dispose();
      const mat = obj.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
}

/**
 * Disposes ONLY a cage's freshly-built geometry. Its material is a shared module
 * singleton (`REBAR_MATERIAL` in `rebar-3d-shared`) reused by the live 3D scene —
 * disposing it would break the live render, so it is left intact.
 */
export function disposeCageGeometry(group: THREE.Group): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) obj.geometry.dispose();
  });
}

/** Isometric view direction (camera → model is −dir). */
function isoDirection(): THREE.Vector3 {
  const cosEl = Math.cos(CAMERA_ELEVATION_RAD);
  return new THREE.Vector3(
    cosEl * Math.sin(CAMERA_AZIMUTH_RAD),
    Math.sin(CAMERA_ELEVATION_RAD),
    cosEl * Math.cos(CAMERA_AZIMUTH_RAD),
  );
}

/**
 * Places a perspective camera isometrically with a TIGHT fit: the model's eight
 * box corners are projected into the (distance-independent) view frame and the
 * camera distance is solved so the projected extent fills both axes.
 */
export function frameCamera(box: THREE.Box3, aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, aspect, 0.01, 1e6);
  const center = box.getCenter(new THREE.Vector3());
  const dir = isoDirection();

  camera.position.copy(center).add(dir);
  camera.up.set(0, 1, 0);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const invQ = camera.quaternion.clone().invert();

  let maxX = 0, maxY = 0, maxZ = 0;
  const corner = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    corner.set(
      i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z,
    ).sub(center).applyQuaternion(invQ);
    maxX = Math.max(maxX, Math.abs(corner.x));
    maxY = Math.max(maxY, Math.abs(corner.y));
    maxZ = Math.max(maxZ, Math.abs(corner.z));
  }
  const tanV = Math.tan((CAMERA_FOV_DEG * Math.PI) / 180 / 2);
  const tanH = tanV * aspect;
  const dist = Math.max(maxX / tanH, maxY / tanV) * FIT_MARGIN + maxZ;

  camera.position.copy(center).addScaledVector(dir, dist);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  return camera;
}

/** Projects a world point to normalised raster space ([0..1], y-down). */
export function projectNorm(v: THREE.Vector3, camera: THREE.Camera): NormPoint {
  const p = v.clone().project(camera);
  return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
}

/**
 * Synchronously renders a scene to a paper-resolution PNG data URL. Creates +
 * disposes its own `WebGLRenderer` (preserveDrawingBuffer for `toDataURL`).
 * Returns `null` on context-creation failure. The caller frames the camera with
 * {@link frameCamera} and is responsible for disposing the scene's own objects.
 */
export function renderSceneToDataUrl(
  scene: THREE.Scene, camera: THREE.Camera, widthPx: number, heightPx: number,
): string | null {
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    renderer.setSize(widthPx, heightPx, false);
    renderer.setPixelRatio(1);
    renderer.setClearColor(SCENE_BG_HEX, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    renderer?.dispose();
  }
}

// ── Projected annotations + capture orchestration (ADR-622) ───────────────────

/** A dimension projected to normalised raster space (measured endpoints + text). */
export interface ProjectedDim {
  readonly a: NormPoint;
  readonly b: NormPoint;
  readonly text: string;
}

/** A bar mark projected to normalised raster space. */
export interface ProjectedMark {
  readonly pos: NormPoint;
  readonly text: string;
}

/** A detail-sheet 3D capture: the raster + its 2D-overlay annotation projections. */
export interface Detail3dCapture {
  readonly dataUrl: string;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Projected scene centre — used to offset each dimension outward. */
  readonly centroid: NormPoint;
  readonly dims: readonly ProjectedDim[];
  readonly marks: readonly ProjectedMark[];
}

/** A dimension spec measured in world metres (3D endpoints + value text). */
export interface DimSpec3d {
  readonly a: THREE.Vector3;
  readonly b: THREE.Vector3;
  readonly text: string;
}

/** A bar-mark spec measured in world metres (3D position + text). */
export interface MarkSpec3d {
  readonly pos: THREE.Vector3;
  readonly text: string;
}

/** Project measured dimension specs through the capture camera into raster space. */
export function projectDims(specs: readonly DimSpec3d[], camera: THREE.Camera): ProjectedDim[] {
  return specs.map((d) => ({ a: projectNorm(d.a, camera), b: projectNorm(d.b, camera), text: d.text }));
}

/** Project measured bar-mark specs through the capture camera into raster space. */
export function projectMarks(specs: readonly MarkSpec3d[], camera: THREE.Camera): ProjectedMark[] {
  return specs.map((m) => ({ pos: projectNorm(m.pos, camera), text: m.text }));
}

/** World direction that projects to screen-right in the iso view (camera-right). */
const SCREEN_RIGHT = new THREE.Vector3(
  Math.cos(CAMERA_AZIMUTH_RAD), 0, -Math.sin(CAMERA_AZIMUTH_RAD),
).normalize();

/** Bounding box (metre coords) of a plan vertex set (XY footprint). */
function planBbox(verts: readonly Point2D[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * The three footprint dimension specs (X along the base front, Y along the base
 * side, H up the screen-right corner) as measured 3D points — shared by the
 * beam / footing / slab captures. AXIS_FLIP: plan (x, y) → three (x, 0, −y).
 */
export function bboxDimSpecs(
  vertsM: readonly Point2D[],
  dimsMm: { readonly x: number; readonly y: number; readonly h: number },
  heightM: number,
): DimSpec3d[] {
  const bb = planBbox(vertsM);
  const bl = new THREE.Vector3(bb.minX, 0, -bb.minY);
  const br = new THREE.Vector3(bb.maxX, 0, -bb.minY);
  const tr = new THREE.Vector3(bb.maxX, 0, -bb.maxY);
  const tl = new THREE.Vector3(bb.minX, 0, -bb.maxY);
  const rightCorner = [bl, br, tr, tl].reduce(
    (best, p) => (p.dot(SCREEN_RIGHT) > best.dot(SCREEN_RIGHT) ? p : best), bl,
  );
  return [
    { a: bl, b: br, text: String(Math.round(dimsMm.x)) },
    { a: br, b: tr, text: String(Math.round(dimsMm.y)) },
    { a: rightCorner.clone(), b: rightCorner.clone().setY(heightM), text: String(Math.round(dimsMm.h)) },
  ];
}

/**
 * Assemble the offscreen mini-scene (faint concrete prism + rebar cage), frame it
 * isometrically, render it to a paper-resolution PNG, and project the annotations
 * `project` returns through the SAME camera — the shared capture flow for every
 * detail sheet. Returns `null` on degenerate bounds / render failure. Disposes the
 * prism fully + the cage's geometry only (its material is a shared singleton).
 */
export function captureDetail3d(
  objects: { readonly cage: THREE.Group; readonly prism: THREE.Group | null },
  widthPx: number,
  heightPx: number,
  project: (camera: THREE.Camera) => { dims: readonly ProjectedDim[]; marks: readonly ProjectedMark[] },
): Detail3dCapture | null {
  const { cage, prism } = objects;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BG_HEX);
  if (prism) scene.add(prism);
  scene.add(cage);

  try {
    const box = finiteBox3FromObject(scene);
    if (!box) return null;
    const camera = frameCamera(box, widthPx / heightPx);
    const dataUrl = renderSceneToDataUrl(scene, camera, widthPx, heightPx);
    if (!dataUrl) return null;

    const { dims, marks } = project(camera);
    return {
      dataUrl,
      widthPx,
      heightPx,
      centroid: projectNorm(box.getCenter(new THREE.Vector3()), camera),
      dims,
      marks,
    };
  } finally {
    disposeOwned(prism);
    disposeCageGeometry(cage);
  }
}
