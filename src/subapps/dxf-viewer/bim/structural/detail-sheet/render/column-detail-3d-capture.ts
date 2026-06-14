/**
 * ADR-457 Slice 3 — Column Reinforcement Detail Sheet · 3D perspective capture.
 *
 * Renders a SELF-CONTAINED offscreen mini-scene (faint concrete prism + crimson
 * rebar cage) to a paper-resolution PNG, AND projects the column's dimension /
 * bar-mark anchor points through the SAME camera into normalised raster space.
 * The perspective region then draws those projections as ordinary 2D `dim` /
 * `text` primitives → the 3D annotations share the EXACT dimension SSoT
 * (`resolveDimGeometry`: identical arrowheads / lines / text) with the plan and
 * elevation views (FULL SSOT). The raster itself carries ONLY the column image.
 *
 * geometry-is-SSoT: cage from `buildColumnRebarCage`, prism from
 * `computeColumnGeometry().footprint`, dim/mark anchors from the matching spec
 * helpers — no geometry re-derived here. The render is SYNCHRONOUS (unlit
 * `MeshBasicMaterial` → reliable one-shot, mirrors `print/capture/capture-3d.ts`).
 *
 * ADR-040: fully offscreen — never touches the live renderer/scene.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/column-detail-3d-capture
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import * as THREE from 'three';
import type { ColumnEntity } from '../../../types/column-types';
import type { Point2D } from '../../../../rendering/types/Types';
import { computeColumnGeometry } from '../../../geometry/column-geometry';
import { buildColumnRebarCage } from '../../../../bim-3d/converters/column-rebar-3d';
import { computeColumnDimSpecs3d } from './column-detail-3d-dims';
import { computeColumnBarMarkSpecs3d } from './column-detail-3d-marks';

/** mm → metres (the vertical convention used by `buildColumnRebarCage`). */
const MM_TO_M = 0.001;
/** Faint concrete outline colour (matches the 2D plan/elevation outline). */
const CONCRETE_EDGE_HEX = 0xb0b0b0;
/** Translucent concrete face colour (subtle volume hint behind the cage). */
const CONCRETE_FACE_HEX = 0xcfcfcf;
const CONCRETE_FACE_OPACITY = 0.12;
/** White sheet background so the raster blends into the paper. */
const SCENE_BG_HEX = 0xffffff;
/** Isometric framing (Revit-grade): 45° azimuth, ~35° elevation, column upright. */
const CAMERA_AZIMUTH_RAD = Math.PI / 4;
const CAMERA_ELEVATION_RAD = (35.264 * Math.PI) / 180;
const CAMERA_FOV_DEG = 35;
/** Small margin around the tight projected-bbox fit (headroom for annotations). */
const FIT_MARGIN = 1.06;

/** A point in normalised raster space ([0..1], origin top-left, y-down). */
export type NormPoint = Point2D;

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

/** The capture result: the column raster + its 2D-overlay annotation projections. */
export interface ColumnDetail3dCapture {
  readonly dataUrl: string;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Projected scene centre — used to offset each dimension outward. */
  readonly centroid: NormPoint;
  readonly dims: readonly ProjectedDim[];
  readonly marks: readonly ProjectedMark[];
}

/** Options controlling the offscreen raster resolution. */
export interface ColumnDetail3dCaptureOptions {
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * Builds the faint concrete prism (footprint extruded along the column height)
 * as a translucent solid + crisp edge overlay, in the SAME world frame/units as
 * the cage. Returns `null` for a degenerate footprint/height.
 */
function buildConcretePrism(column: ColumnEntity): THREE.Group | null {
  const verts = computeColumnGeometry(column.params).footprint.vertices;
  if (verts.length < 3) return null;
  const heightM = Math.max(0, column.params.height) * MM_TO_M;
  if (heightM <= 0) return null;

  const shape = new THREE.Shape();
  shape.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i < verts.length; i++) shape.lineTo(verts[i].x, verts[i].y);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: heightM, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);

  const group = new THREE.Group();
  const faceMat = new THREE.MeshBasicMaterial({
    color: CONCRETE_FACE_HEX,
    transparent: true,
    opacity: CONCRETE_FACE_OPACITY,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(geo, faceMat));
  const edges = new THREE.EdgesGeometry(geo);
  group.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: CONCRETE_EDGE_HEX })));
  return group;
}

/** Fully disposes a group we own (geometry + materials). No-op for `null`. */
function disposeOwned(group: THREE.Group | null): void {
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
 * Disposes ONLY the cage's freshly-built geometry. Its material is a shared
 * module singleton (`REBAR_MATERIAL` in `column-rebar-3d`) reused by the live
 * 3D scene — disposing it would break the live render, so it is left intact.
 */
function disposeCageGeometry(group: THREE.Group): void {
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
function frameCamera(box: THREE.Box3, aspect: number): THREE.PerspectiveCamera {
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
function projectNorm(v: THREE.Vector3, camera: THREE.Camera): NormPoint {
  const p = v.clone().project(camera);
  return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
}

/**
 * Captures the column reinforcement as an isometric PNG plus the projected
 * dimension/bar-mark anchors (normalised raster space), or `null` when there is
 * no buildable cage. Disposes every GPU resource it creates.
 */
export function captureColumnDetail3d(
  column: ColumnEntity,
  options: ColumnDetail3dCaptureOptions,
): ColumnDetail3dCapture | null {
  const cage = buildColumnRebarCage(column, 0, column.params.height);
  if (!cage) return null;
  const prism = buildConcretePrism(column);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BG_HEX);
  if (prism) scene.add(prism);
  scene.add(cage);

  const { widthPx, heightPx } = options;
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    renderer.setSize(widthPx, heightPx, false);
    renderer.setPixelRatio(1);
    renderer.setClearColor(SCENE_BG_HEX, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const box = new THREE.Box3().setFromObject(scene);
    if (box.isEmpty()) return null;
    const camera = frameCamera(box, widthPx / heightPx);
    renderer.render(scene, camera);

    const dims = computeColumnDimSpecs3d(column).map((d) => ({
      a: projectNorm(d.a, camera),
      b: projectNorm(d.b, camera),
      text: d.text,
    }));
    const marks = computeColumnBarMarkSpecs3d(column).map((m) => ({
      pos: projectNorm(m.pos, camera),
      text: m.text,
    }));
    return {
      dataUrl: renderer.domElement.toDataURL('image/png'),
      widthPx,
      heightPx,
      centroid: projectNorm(box.getCenter(new THREE.Vector3()), camera),
      dims,
      marks,
    };
  } catch {
    return null;
  } finally {
    renderer?.dispose();
    disposeOwned(prism);
    disposeCageGeometry(cage);
  }
}
