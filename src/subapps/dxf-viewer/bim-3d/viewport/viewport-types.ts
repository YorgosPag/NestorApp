/**
 * Viewport types for BIM 3D viewer.
 * PORT_AS_IS from GenArc viewport.types.ts (ADR-366 §8.2 SPEC-3D-004A).
 */

import type * as THREE from 'three';

export type ProjectionMode =
  | 'perspective'
  | 'top'
  | 'bottom'
  | 'front'
  | 'back'
  | 'left'
  | 'right';

export interface ZoomPreset {
  readonly label: string;
  readonly value: number;
}

export interface CameraKeyframe {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
  readonly zoom: number;
}

export type AnimationTickCallback = (
  position: THREE.Vector3,
  target: THREE.Vector3,
  zoom: number,
  progress: number,
) => void;

export type SpeedModifier = 'normal' | 'fast' | 'precise';

export interface ViewportCamera {
  readonly camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  readonly target: THREE.Vector3;
  readonly projectionMode: ProjectionMode;
  readonly setProjection: (mode: ProjectionMode) => void;
  /**
   * ADR-400 §3D — apply an ABSOLUTE camera pose INSTANTLY (no animation), used to
   * restore a persisted 3D view on mount. Switches projection if needed, then sets
   * position + orbit target (+ ortho zoom). Perspective zoom is implicit in the
   * camera→target distance, so `zoom` is only consumed for orthographic projections.
   */
  readonly setPose: (
    position: THREE.Vector3,
    target: THREE.Vector3,
    zoom: number,
    projection: ProjectionMode,
  ) => void;
  readonly getZoom: () => number;
  readonly setZoom: (zoom: number) => void;
  readonly setZoomPreset: (presetIndex: number) => void;
  readonly updateAspect: (width: number, height: number) => void;
  readonly update: () => void;
  readonly dispose: () => void;
  readonly frameBounds: (min: THREE.Vector3, max: THREE.Vector3) => void;
  /**
   * ViewCube HOME button — reset to the home isometric view AND zoom-to-fit the
   * given bounds in one animation, so the drawing is always visible on screen
   * (AutoCAD/Revit "Home" = home orientation + fit extents).
   */
  readonly frameHome: (min: THREE.Vector3, max: THREE.Vector3) => void;
  readonly cancelAnimation: () => void;
  readonly isAnimating: boolean;
  readonly setSpeedModifier: (modifier: SpeedModifier) => void;
  readonly snapToViewDirection: (dir: THREE.Vector3) => void;
  /**
   * ViewCube roll arrows — roll the camera ±90° around the viewing axis,
   * keeping position/target/projection unchanged (the scene appears to rotate
   * 90° on screen). `dirSign` +1 = clockwise, -1 = counter-clockwise.
   */
  readonly rollView: (dirSign: 1 | -1) => void;
  readonly goHome: () => void;
  readonly applyTumble: (dxPx: number, dyPx: number) => void;
  /** ADR-366 Phase 4.5 / A.7.Q4 — screen-space pan (positive dx = view right, positive dy = view up). */
  readonly pan: (dxScreenPx: number, dyScreenPx: number) => void;
  /**
   * ADR-366 §A.6.Q5 — set the orbit pivot (rotation center) to a world point
   * WITHOUT moving the camera. The view stays visually identical; only future
   * tumble/orbit rotates around `point`. Used by Alt+click pivot picking.
   */
  readonly setOrbitPivot: (point: THREE.Vector3) => void;
  /**
   * ADR-402 §Sub-Phase 2 — enable/disable camera navigation (OrbitControls +
   * tumble). The 3D BIM edit gizmos call this to own the pointer during a drag.
   */
  readonly setControlsEnabled: (enabled: boolean) => void;
}

/** All 12 canonical view IDs: 6 ortho face + 6 isometric. */
export type CanonicalViewId =
  | 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'
  | 'iso-ne' | 'iso-nw' | 'iso-se' | 'iso-sw' | 'iso-ue' | 'iso-uw';

/** Subset of CanonicalViewId that maps to an orthographic ProjectionMode. */
export type OrthoCanonicalViewId = Extract<CanonicalViewId,
  'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'>;

export interface CanonicalViewDef {
  readonly id: CanonicalViewId;
  /** Camera-to-target direction (unit vector). Negate for camera-from-target. */
  readonly lookDir: readonly [number, number, number];
  readonly type: 'ortho' | 'iso';
  /** Present only for ortho views; undefined for iso. */
  readonly projectionMode?: OrthoCanonicalViewId;
  /** i18n key within the bim3d namespace. */
  readonly labelKey: string;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface ScreenProjection extends ScreenPoint {
  readonly behindCamera: boolean;
}

export interface ViewportCameraOptions {
  readonly initialPosition: THREE.Vector3;
  readonly initialTarget?: THREE.Vector3;
  readonly onRenderNeeded: () => void;
  readonly onInteractionStart: () => void;
  readonly onInteractionEnd: () => void;
  /** Returns true when reduced motion is active. Checked at animation call time. */
  readonly getReducedMotion?: () => boolean;
  /** ADR-366 §A.6.Q5 — static Alt+left-click in perspective (forwarded to tumble). */
  readonly onAltClick?: (clientX: number, clientY: number) => void;
  /** Alt+left pointer-down → re-centre orbit pivot on the cursor point (forwarded to tumble). */
  readonly onAltPress?: (clientX: number, clientY: number) => void;
  /**
   * ADR-363 Φ1G.5 / §empty-dxf — resolve the world ANCHOR point under the cursor for the Revit
   * surface-anchored wheel zoom. SSoT `raycastWorldPointOrPlane`: BIM surface hit → DXF ground-plane
   * → camera-facing plane through the orbit target. So a BIM surface, the DXF underlay AND empty
   * canvas all yield a real anchor → the ONE exponential dolly runs everywhere (Revit/Figma: zoom in
   * empty space anchors to a work/target plane, never switches to a different zoom mechanism).
   * Returns null only in degenerate cases (canvas not laid out) → the wheel falls back to the default
   * OrbitControls dolly. Optional / back-compat.
   */
  readonly resolveSurfacePoint?: (clientX: number, clientY: number) => THREE.Vector3 | null;
}
