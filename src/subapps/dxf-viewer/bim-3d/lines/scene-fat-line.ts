/**
 * scene-fat-line — the BIM 3D scene's ONE way to build a screen-space-thick line (ADR-584 / N.18).
 *
 * `LineBasicMaterial.linewidth` is ignored by WebGL (OpenGL core profile / ANGLE cap it at 1 px), so
 * every thick line in a WebGL CAD viewer goes through `LineSegments2` + `LineMaterial`, which
 * expands each segment into a screen-space quad. That pipeline is not one call: it is a geometry, a
 * material, a `resolution` uniform that has to track the viewport, a `linewidth` that has to track
 * the pixel ratio, and an unsubscribe that has to survive disposal. Written out by hand it is ~15
 * lines that LOOK incidental and are in fact a unit-conversion contract — exactly the shape that
 * gets copy-pasted into a sibling and then drifts.
 *
 * ### The unit contract (the reason this module exists at all)
 * The vertex shader does `offset *= linewidth; offset /= resolution.y`. So **`linewidth` is measured
 * in whatever unit `resolution` is measured in** — there is no independent «pixel» in there. The
 * drawing buffer is `CSS × pixelRatio`, therefore:
 *
 *   resolution = CSS × pixelRatio   AND   linewidth = widthPx × pixelRatio
 *
 * Scaling only ONE of them is the classic HiDPI bug (a `2px` line drawn `2×` too thick at dpr 2),
 * and it is why both values are derived HERE from the same snapshot instead of at each call site.
 *
 * ### Who uses it, and who deliberately does not
 * - `bim-3d/edges/bim-3d-edge-overlay-builder` — the «Shaded with Edges» silhouette overlay.
 * - `bim-3d/materials/auto-breakline-materials-3d` — the focused topo candidate's halo + core.
 * - ❌ `canvas-v2/webgl-lines/WebglLineLayerManager` (ADR-639 Στάδιο 5) **stays out, on purpose**:
 *   it is a different scene with a different resolution SSoT (its own 2D viewport, driven per
 *   rAF tick), per-bucket vertex colours, and an LOD `instanceCount` that this module has no
 *   concept of. Folding it in would mean parameterising the *resolution source* and the *lifecycle*
 *   — the over-parameterised factory that is a clone wearing a nice name, not a centralisation.
 *   The duplication that remains between the two is the three literal `new` calls, which is what
 *   the fat-line API costs, not a shared decision.
 *
 * Pure Three.js: no React, no scene mutation — the caller adds the mesh and owns `unsubscribe`.
 *
 * @module bim-3d/lines/scene-fat-line
 * @enterprise ADR-375 — BIM edge overlay · ADR-650 — Topography · ADR-584 — Anti-Duplication
 */

import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { bimEdgeResolutionStore } from '../edges/bim-edge-resolution-store';

/** World-unit dash (metres along the line) — `LineMaterial` supports exactly one dash + one gap. */
export interface FatLineDash {
  readonly dashSize: number;
  readonly gapSize: number;
}

/** Depth-buffer nudge, for a line that must win against its own coplanar faces (Revit edges). */
export interface FatLinePolygonOffset {
  readonly factor: number;
  readonly units: number;
}

export interface SceneFatLineMaterialParams {
  /** On-screen width in CSS px (pre-DPR). The pixel ratio is applied here, never by the caller. */
  readonly widthPx: number;
  /** Line colour as a hex number (`THREE.Color(...).getHex()`). */
  readonly color: number;
  /**
   * 0..1. Rendered through `alphaToCoverage` (MSAA), NOT alpha blending — deliberately: every
   * segment is its own quad with its own round caps, so at a shared vertex two quads overlap almost
   * completely. Under blending that overlap composites twice and beads a brighter dot onto every
   * corner of a translucent halo. Alpha-to-coverage maps a constant alpha to a constant sample
   * mask, so drawing the same colour twice onto the same samples is idempotent — no beads.
   */
  readonly opacity?: number;
  /** false → the line shows THROUGH occluding geometry (selection / x-ray). Default true. */
  readonly depthTest?: boolean;
  /** Dashed line, in world units along the segment (needs `computeLineDistances()` on the mesh). */
  readonly dash?: FatLineDash | null;
  /** Pull the line toward the camera in the depth buffer. Omit for depth-test-free overlays. */
  readonly polygonOffset?: FatLinePolygonOffset | null;
  /**
   * Pin the pixel ratio instead of tracking the store's (test injection). Overrides BOTH the
   * `resolution` scale and `linewidth` — they can never be pinned apart.
   */
  readonly devicePixelRatio?: number;
}

export interface SceneFatLineMaterial {
  readonly material: LineMaterial;
  /**
   * Stop tracking the viewport. Does NOT dispose the material — ownership stays with the caller,
   * because the two users have opposite lifetimes: the edge overlay makes one material per mesh,
   * the topo review makes catalog singletons that live as long as the app.
   */
  readonly unsubscribe: () => void;
}

/**
 * Build a `LineMaterial` whose `resolution` and `linewidth` track the BIM 3D viewport for as long
 * as the returned `unsubscribe` is not called. Both are applied immediately, so a material built
 * before the first resize is already correct.
 */
export function createSceneFatLineMaterial(
  params: SceneFatLineMaterialParams,
): SceneFatLineMaterial {
  const material = new LineMaterial({
    color: params.color,
    depthTest: params.depthTest ?? true,
    // Every fat line here is an OVERLAY on solid geometry: writing depth would let it occlude the
    // very faces it annotates (and z-fight with its own screen-space expansion).
    depthWrite: false,
    transparent: false,
    alphaToCoverage: true,
    ...(params.opacity === undefined ? null : { opacity: params.opacity }),
    ...(params.dash ? { dashed: true, dashSize: params.dash.dashSize, gapSize: params.dash.gapSize } : null),
    ...(params.polygonOffset
      ? {
          polygonOffset: true,
          polygonOffsetFactor: params.polygonOffset.factor,
          polygonOffsetUnits: params.polygonOffset.units,
        }
      : null),
  });

  const applyViewport = (): void => {
    const snapshot = bimEdgeResolutionStore.getSize();
    const ratio = params.devicePixelRatio ?? snapshot.pixelRatio;
    material.resolution.set(snapshot.width * ratio, snapshot.height * ratio);
    material.linewidth = params.widthPx * ratio;
  };

  applyViewport();
  return { material, unsubscribe: bimEdgeResolutionStore.subscribe(applyViewport) };
}

/**
 * Pack a flat `[x,y,z, x,y,z, …]` SEGMENT-PAIR buffer (the `THREE.LineSegments` layout) into a
 * `LineSegments2`. Same input the thin pipeline takes, so a caller can switch a line from thin to
 * fat without touching the code that produced its coordinates.
 */
export function createFatLineMesh(
  positions: Float32Array | readonly number[],
  material: LineMaterial,
): LineSegments2 {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions instanceof Float32Array ? positions : Array.from(positions));
  return new LineSegments2(geometry, material);
}
