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
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { bimEdgeResolutionStore } from './bim-edge-resolution-store';
import { linePatternToDashArray, type LinePatternKey } from '../../config/bim-line-patterns';

/** Fallback color when the resolver returns null (= token-driven). */
const DEFAULT_EDGE_COLOR = '#1a1a1a';

/**
 * ADR-375 Phase C.7 (v2.21) — render the edge overlays AFTER the solid faces
 * (default renderOrder 0). Required because the overlay uses `depthWrite:false`:
 * without a later draw order the faces overdraw the edge pixels and the edges
 * vanish even with a face-side `polygonOffset`. > 0 is enough (faces stay at 0).
 */
const EDGE_OVERLAY_RENDER_ORDER = 1;

/**
 * ADR-375 Phase C.7 (v2.22) — pull the edge lines slightly TOWARD the camera in
 * the depth buffer so they always win the depth test against their own coplanar
 * faces (Revit "Shaded with Edges"). `LineSegments2` expands the line in screen
 * space, which nudges the fragment depth marginally BEHIND the face → under
 * `depthTest:true` the equal/near-equal edge gets rejected and disappears. A
 * negative polygonOffset compensates. Magnitude kept modest so edges that sit
 * behind OTHER solids are still occluded (only-visible edges, no x-ray bleed).
 */
const EDGE_POLYGON_OFFSET_FACTOR = -2;
const EDGE_POLYGON_OFFSET_UNITS = -4;

/**
 * ADR-377 Phase E — px-dash → world-units (meters) conversion for 3D dashes.
 *
 * `linePatternToDashArray` yields canvas px values at the 1:100 / 96-dpi
 * reference. `LineMaterial.dashSize`/`gapSize` are in **world units** (meters,
 * measured along the edge via `computeLineDistances()`). This factor maps the
 * px reference to a metric dash that reads cleanly on architectural solids:
 * 1px → 1cm, so `dashed` [8,4] → 8cm dash / 4cm gap. Visual distinction only —
 * not a metric guarantee (LineMaterial supports a single dash+gap, so multi-
 * segment patterns approximate to their first dash/gap pair).
 */
const DASH_WORLD_SCALE_M = 0.01;

export interface EdgeOverlayOptions {
  /** Screen-space line width in CSS pixels (pre-DPR). */
  lineWidthPx: number;
  /** Hex color or null (null → DEFAULT_EDGE_COLOR). */
  color: string | null;
  /**
   * ADR-377 Phase E — line pattern. 'solid' / undefined → continuous edge.
   * Any dashed/dotted/etc. key → a dashed `LineMaterial` (single dash+gap
   * derived from `linePatternToDashArray`, scaled to world units).
   */
  linePattern?: LinePatternKey;
  /** EdgesGeometry threshold angle in degrees. Default 30° (Revit silhouette). */
  thresholdAngle: number;
  /** false → returns null (caller skips attach). */
  visible: boolean;
  /** Pre-resolved devicePixelRatio (test injection). Default: window.devicePixelRatio. */
  devicePixelRatio?: number;
}

/**
 * Resolve the world-unit dash for a pattern key. Returns null for solid (or any
 * pattern whose first dash is zero-length, e.g. pure-dot — LineMaterial cannot
 * render zero-length caps in 3D, so we fall back to solid).
 */
function resolveWorldDash(
  linePattern: LinePatternKey | undefined,
): { dashSize: number; gapSize: number } | null {
  if (!linePattern || linePattern === 'solid') return null;
  const arr = linePatternToDashArray(linePattern);
  if (arr.length < 2 || arr[0]! <= 0) return null;
  return { dashSize: arr[0]! * DASH_WORLD_SCALE_M, gapSize: arr[1]! * DASH_WORLD_SCALE_M };
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

  const dash = resolveWorldDash(opts.linePattern);
  const material = new LineMaterial({
    color: new THREE.Color(opts.color ?? DEFAULT_EDGE_COLOR).getHex(),
    linewidth: opts.lineWidthPx * dpr,
    depthTest: true,
    depthWrite: false,
    transparent: false,
    alphaToCoverage: true,
    // v2.22 — pull edges forward so they win depth against their own faces.
    polygonOffset: true,
    polygonOffsetFactor: EDGE_POLYGON_OFFSET_FACTOR,
    polygonOffsetUnits: EDGE_POLYGON_OFFSET_UNITS,
    // ADR-377 Phase E — dashed edges (gaps discarded in the shader via USE_DASH).
    // computeLineDistances() below provides the along-edge distance the dash reads.
    ...(dash ? { dashed: true, dashSize: dash.dashSize, gapSize: dash.gapSize } : null),
  });

  const { width, height } = bimEdgeResolutionStore.getSize();
  material.resolution.set(width, height);

  const unsubscribe = bimEdgeResolutionStore.subscribe((w, h) => {
    material.resolution.set(w, h);
  });

  const overlay = new LineSegments2(lineGeo, material);
  overlay.userData['bimEdgeOverlay'] = true;
  overlay.userData['bimEdgeUnsubscribe'] = unsubscribe;
  // ADR-375 Phase C.7 (v2.21) — "Shaded with Edges" depth-correct draw order.
  // The overlay has `depthWrite:false`, so it MUST render AFTER the solid faces:
  // otherwise the faces (drawn later) overwrite the already-painted edge pixels
  // (the v2.20 polygonOffset alone could not win against this draw-order overdraw).
  // renderOrder=1 > the faces' default 0 → edges paint on top; combined with the
  // face-side polygonOffset (MaterialCatalog3D) the depth-test still hides edges
  // that sit behind OTHER solids → Revit "only visible edges".
  overlay.renderOrder = EDGE_OVERLAY_RENDER_ORDER;
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
