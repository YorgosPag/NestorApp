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
  readonly getZoom: () => number;
  readonly setZoom: (zoom: number) => void;
  readonly setZoomPreset: (presetIndex: number) => void;
  readonly updateAspect: (width: number, height: number) => void;
  readonly update: () => void;
  readonly dispose: () => void;
  readonly frameBounds: (min: THREE.Vector3, max: THREE.Vector3) => void;
  readonly cancelAnimation: () => void;
  readonly isAnimating: boolean;
  readonly setSpeedModifier: (modifier: SpeedModifier) => void;
  readonly snapToViewDirection: (dir: THREE.Vector3) => void;
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
