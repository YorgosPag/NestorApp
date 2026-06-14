/**
 * ADR-457 Slice 3 — Column Reinforcement Detail Sheet · 3D perspective capture.
 *
 * Renders a SELF-CONTAINED offscreen mini-scene (faint concrete prism + crimson
 * rebar cage) to a paper-resolution PNG data URL that is placed as a
 * {@link RasterPrimitive} in the sheet's `perspective` region. The SAME data URL
 * feeds the canvas preview AND the jsPDF export (Slice 5) → preview === PDF.
 *
 * geometry-is-SSoT: the cage comes from `buildColumnRebarCage` (the live-3D SSoT)
 * and the concrete outline from `computeColumnGeometry().footprint` — both already
 * positioned in the column's WORLD frame and the SAME unit convention (horizontal
 * via `mmScaleFor`, vertical via `MM_TO_M`), so prism and cage are guaranteed to
 * align. No rebar/footprint geometry is re-derived here.
 *
 * The render is SYNCHRONOUS on purpose: the cage uses an unlit `MeshBasicMaterial`
 * (zero async shader compile) so a single offscreen `render()` is reliably
 * complete in one shot — mirrors `print/capture/capture-3d.ts`. Returns `null`
 * when the column has no buildable cage (non-rectangular / no reinforcement /
 * degenerate height) → the region keeps its heading only.
 *
 * ADR-040: fully offscreen — never touches the live renderer/scene (CHECK 6B/6C/6D
 * safe).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/column-detail-3d-capture
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import * as THREE from 'three';
import type { ColumnEntity } from '../../../types/column-types';
import { computeColumnGeometry } from '../../../geometry/column-geometry';
import { buildColumnRebarCage } from '../../../../bim-3d/converters/column-rebar-3d';

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
/** Margin factor applied to the fit distance so the model never touches edges. */
const FIT_MARGIN = 1.18;

/** Options controlling the offscreen raster resolution. */
export interface ColumnDetail3dCaptureOptions {
  /** Raster width in device pixels. */
  readonly widthPx: number;
  /** Raster height in device pixels. */
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

  // Footprint (world, scene-horizontal units) → THREE.Shape in (X, Y); extrude
  // along +Z then rotate −90° about X so depth becomes +Y (matches the cage's
  // (x, y, −planY) axis convention with the base at y = 0).
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
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
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

/** Places a perspective camera isometrically framing `box`, fitted to aspect. */
function frameCamera(box: THREE.Box3, aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, aspect, 0.01, 1e6);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const center = sphere.center;
  const fovRad = (CAMERA_FOV_DEG * Math.PI) / 180;
  // Fit to the tighter of the two frustum half-angles (handles portrait aspect).
  const vFit = sphere.radius / Math.sin(fovRad / 2);
  const hFovRad = 2 * Math.atan(Math.tan(fovRad / 2) * aspect);
  const hFit = sphere.radius / Math.sin(hFovRad / 2);
  const dist = Math.max(vFit, hFit) * FIT_MARGIN;

  const cosEl = Math.cos(CAMERA_ELEVATION_RAD);
  const dir = new THREE.Vector3(
    cosEl * Math.sin(CAMERA_AZIMUTH_RAD),
    Math.sin(CAMERA_ELEVATION_RAD),
    cosEl * Math.cos(CAMERA_AZIMUTH_RAD),
  );
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.up.set(0, 1, 0);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  return camera;
}

/**
 * Captures the column's reinforcement as an isometric PNG data URL, or `null`
 * when there is no buildable cage. Disposes every GPU resource it creates.
 */
export function captureColumnDetail3d(
  column: ColumnEntity,
  options: ColumnDetail3dCaptureOptions,
): string | null {
  const cage = buildColumnRebarCage(column, 0, column.params.height);
  if (!cage) return null;
  const prism = buildConcretePrism(column);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BG_HEX);
  if (prism) scene.add(prism);
  scene.add(cage);

  const { widthPx, heightPx } = options;
  // Guard the whole GPU path: a failed WebGL context (headless / lost context)
  // degrades to `null` (region shows its heading only) instead of throwing into
  // the host effect — and geometry is always disposed via `finally`.
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
    return renderer.domElement.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    renderer?.dispose();
    disposeOwned(prism);
    disposeCageGeometry(cage);
  }
}
