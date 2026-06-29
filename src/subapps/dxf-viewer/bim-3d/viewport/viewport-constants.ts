/**
 * Viewport constants for BIM 3D viewer.
 * PORT_AS_IS from GenArc viewport.constants.ts (ADR-366 §8.2 SPEC-3D-004A).
 * Adapted: removed GenArc @/ aliases, self-contained.
 */

import type { ZoomPreset } from './viewport-types';
import { DXF_TIMING } from '../../config/dxf-timing';
// 🎯 SSoT: το «πόσο ζουμάρει μια εγκοπή» ορίζεται ΜΙΑ φορά για όλη την εφαρμογή (2D + 3D).
import { WHEEL_ZOOM_PER_NOTCH, WHEEL_NOTCH_DELTA_PX } from '../../config/transform-config';

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

// ADR-363 Φ1G.5 — lowered from 1.0 m so the surface-anchored zoom clamp (ZOOM_SURFACE_MARGIN),
// not this orbit-target floor, governs how close you may hug a wall face for detail inspection.
export const PERSP_MIN_DISTANCE = 0.12;
export const PERSP_MAX_DISTANCE = 500;

// ADR-363 Φ1G.5 — Revit-grade surface-anchored wheel zoom (viewport-zoom-surface.ts).
/** Closest the camera may approach the surface under the cursor (metres ≈ 120 mm). Prevents
 *  punch-through: you can hug a face but never enter the solid. Above CAMERA_NEAR (0.1).
 *  (Δοκιμή 0.11 → ο χρήστης έμπαινε μέσα στην οντότητα· 0.12 = ασφαλές κατώφλι.) */
export const ZOOM_SURFACE_MARGIN = 0.12;
/** Geometric base per wheel step (mirrors OrbitControls' 0.95 feel). */
export const ZOOM_WHEEL_BASE = 0.95;
/**
 * Wheel-delta → exponent sensitivity, **ΠΑΡΑΓΩΓΟ του app-wide `WHEEL_ZOOM_PER_NOTCH` SSoT** ώστε το 3D
 * να νιώθει ΙΔΙΑ με το 2D ανά εγκοπή (feel-parity, ΜΙΑ πηγή αλήθειας — άλλαξε εκεί, όχι εδώ).
 *
 * Το 3D dolly-άρει την ΑΠΟΣΤΑΣΗ κάμερας→επιφάνειας· ο οπτικός μεγεθυντικός ≈ 1/distanceFactor. Θέλουμε
 * μία εγκοπή (|deltaY| = WHEEL_NOTCH_DELTA_PX) → distanceFactor = 1/WHEEL_ZOOM_PER_NOTCH, δηλ.
 *   ZOOM_WHEEL_BASE^(notch × sensitivity) = 1 / WHEEL_ZOOM_PER_NOTCH
 *   ⇒ sensitivity = −ln(perNotch) / (notch × ln(base))
 * Το surface-anchoring + margin clamp (ZOOM_SURFACE_MARGIN) μένει → δεν περνάς ποτέ μέσα από τοίχο.
 */
export const ZOOM_WHEEL_SENSITIVITY =
  -Math.log(WHEEL_ZOOM_PER_NOTCH) / (WHEEL_NOTCH_DELTA_PX * Math.log(ZOOM_WHEEL_BASE));
export const ORTHO_MIN_ZOOM = 0.01;
export const ORTHO_MAX_ZOOM = 100;

export const TUMBLE_BASE_SPEED = 0.005;

export const PROJECTION_SWITCH_DURATION_MS = DXF_TIMING.animation.SLOW; // ADR-516
export const FRAME_SCENE_DURATION_MS = DXF_TIMING.animation.SLOW; // ADR-516
export const FRAME_PADDING_FACTOR = 1.1;

export const POI_ARM_LENGTH = 0.15;
export const POI_COLOR: readonly [number, number, number] = [0, 0.706, 0.847];
export const POI_FADE_DELAY_MS = DXF_TIMING.animation.POI_FADE_DELAY; // ADR-516
export const POI_FADE_DURATION_MS = DXF_TIMING.animation.DEFAULT; // ADR-516

export const SNAP_PROXIMITY_THRESHOLD = 0.92;

export const DEFAULT_PAN_SPEED = 1.0;
export const DEFAULT_ROTATE_SPEED = 1.0;
export const DEFAULT_ZOOM_SPEED = 1.0;
export const SPEED_MODIFIER_FAST = 2.0;
export const SPEED_MODIFIER_PRECISE = 0.5;

/** ViewCube is hidden when viewport width drops below this threshold (mobile/dense). */
export const VIEWCUBE_HIDE_WIDTH_PX = 600;

/** Duration for keyboard pan easing animation (matches --cp-duration-fast CSS token). */
export const PAN_ANIMATION_DURATION_MS = DXF_TIMING.animation.FAST; // ADR-516
