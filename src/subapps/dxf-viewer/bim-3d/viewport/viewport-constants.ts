/**
 * Viewport constants for BIM 3D viewer.
 * PORT_AS_IS from GenArc viewport.constants.ts (ADR-366 §8.2 SPEC-3D-004A).
 * Adapted: removed GenArc @/ aliases, self-contained.
 */

import type { ZoomPreset } from './viewport-types';

export const ZOOM_PRESETS: readonly ZoomPreset[] = [
  { label: '12.5%', value: 0.125 },
  { label: '25%',   value: 0.25 },
  { label: '50%',   value: 0.5 },
  { label: '75%',   value: 0.75 },
  { label: '100%',  value: 1.0 },
  { label: '150%',  value: 1.5 },
  { label: '200%',  value: 2.0 },
  { label: '400%',  value: 4.0 },
  { label: '800%',  value: 8.0 },
] as const;

export const DEFAULT_PERSPECTIVE_FOV = 50;
export const DEFAULT_CAMERA_DISTANCE = 22.0;
export const DEFAULT_ORTHO_SIZE = 15.0;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 1000;

export const ORTHO_CAMERA_DIRECTIONS: Readonly<Record<string, readonly [number, number, number]>> = {
  top:    [0,  1,  0],
  bottom: [0, -1,  0],
  front:  [0,  0,  1],
  back:   [0,  0, -1],
  left:   [-1, 0,  0],
  right:  [1,  0,  0],
} as const;

export const ORTHO_CAMERA_UP: Readonly<Record<string, readonly [number, number, number]>> = {
  top:    [0, 0, -1],
  bottom: [0, 0,  1],
  front:  [0, 1,  0],
  back:   [0, 1,  0],
  left:   [0, 1,  0],
  right:  [0, 1,  0],
} as const;

export const PERSP_MIN_DISTANCE = 1.0;
export const PERSP_MAX_DISTANCE = 500;
export const ORTHO_MIN_ZOOM = 0.01;
export const ORTHO_MAX_ZOOM = 100;

export const TUMBLE_BASE_SPEED = 0.005;
export const TUMBLE_DAMPING = 0.08;

export const PROJECTION_SWITCH_DURATION_MS = 400;
export const FRAME_SCENE_DURATION_MS = 500;
export const FRAME_PADDING_FACTOR = 1.1;

export const POI_ARM_LENGTH = 0.15;
export const POI_COLOR: readonly [number, number, number] = [0, 0.706, 0.847];
export const POI_FADE_DELAY_MS = 1500;
export const POI_FADE_DURATION_MS = 300;

export const SNAP_PROXIMITY_THRESHOLD = 0.92;

export const DEFAULT_PAN_SPEED = 1.0;
export const DEFAULT_ROTATE_SPEED = 1.0;
export const DEFAULT_ZOOM_SPEED = 1.0;
export const SPEED_MODIFIER_FAST = 2.0;
export const SPEED_MODIFIER_PRECISE = 0.5;
