/**
 * ADR-375 Phase C.7 — BIM 3D Edge Overlay Builder.
 *
 * Builds a screen-space LineSegments2 edge overlay for a BIM solid mesh.
 *
 * Industry alignment (Phase 1 web research):
 *   - Line2 / LineMaterial / LineSegmentsGeometry from three/examples/jsm/lines:
 *     the standard for thick screen-space lines in WebGL CAD viewers
 *     (Forge, Three.js Editor, Sketchfab). LineBasicMaterial.linewidth is
 *     ignored by WebGL/OpenGL ES → always 1px → not industry-grade.
 *   - EdgesGeometry(geo, 30°) silhouette filter — Revit / ArchiCAD default.
 *     Hides internal triangulation edges, keeps hard corners.
 *   - linewidth × devicePixelRatio for crisp High-DPI output.
 *   - depthTest:true + depthWrite:false: edges visible without z-fighting.
 *   - alphaToCoverage:true: MSAA edge smoothing.
 *
 * Lifecycle: callers attach the returned overlay to the parent mesh via
 * `mesh.add(overlay)`. BimSceneLayer.clearGroup() already traverses children
 * recursively, so disposal is automatic.
 */
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { bimEdgeResolutionStore } from './bim-edge-resolution-store';

/** Fallback color when the resolver returns null (= token-driven). */
const DEFAULT_EDGE_COLOR = '#1a1a1a';

export interface EdgeOverlayOptions {
  /** Screen-space line width in CSS pixels (pre-DPR). */
  lineWidthPx: number;
  /** Hex color or null (null → DEFAULT_EDGE_COLOR). */
  color: string | null;
  /** EdgesGeometry threshold angle in degrees. Default 30° (Revit silhouette). */
  thresholdAngle: number;
  /** false → returns null (caller skips attach). */
  visible: boolean;
  /** Pre-resolved devicePixelRatio (test injection). Default: window.devicePixelRatio. */
  devicePixelRatio?: number;
}

/**
 * Build an edge overlay for the given solid mesh geometry.
 * Returns null when `visible=false` or the geometry has zero edges.
 */
export function buildEdgeOverlay(
  mesh: THREE.Mesh,
  opts: EdgeOverlayOptions,
): LineSegments2 | null {
  if (!opts.visible || opts.lineWidthPx <= 0) return null;
  if (!mesh.geometry) return null;

  const edges = new THREE.EdgesGeometry(mesh.geometry, opts.thresholdAngle);
  const posAttr = edges.attributes['position'];
  if (!posAttr || posAttr.count === 0) {
    edges.dispose();
    return null;
  }

  const positions = new Float32Array(posAttr.array as ArrayLike<number>);
  const lineGeo = new LineSegmentsGeometry();
  lineGeo.setPositions(positions);
  edges.dispose();

  const dpr = opts.devicePixelRatio ?? (
    typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
      ? window.devicePixelRatio
      : 1
  );

  const material = new LineMaterial({
    color: new THREE.Color(opts.color ?? DEFAULT_EDGE_COLOR).getHex(),
    linewidth: opts.lineWidthPx * dpr,
    depthTest: true,
    depthWrite: false,
    transparent: false,
    alphaToCoverage: true,
  });

  const { width, height } = bimEdgeResolutionStore.getSize();
  material.resolution.set(width, height);

  const unsubscribe = bimEdgeResolutionStore.subscribe((w, h) => {
    material.resolution.set(w, h);
  });

  const overlay = new LineSegments2(lineGeo, material);
  overlay.userData['bimEdgeOverlay'] = true;
  overlay.userData['bimEdgeUnsubscribe'] = unsubscribe;
  overlay.computeLineDistances();

  const originalDispose = overlay.geometry.dispose.bind(overlay.geometry);
  overlay.geometry.dispose = () => {
    unsubscribe();
    originalDispose();
  };

  return overlay;
}

/**
 * Attach the overlay as a child of the parent mesh. No-op when overlay is null.
 * Returns the overlay (or null) for convenience.
 */
export function attachEdgeOverlay(
  mesh: THREE.Mesh,
  overlay: LineSegments2 | null,
): LineSegments2 | null {
  if (!overlay) return null;
  mesh.add(overlay);
  return overlay;
}
