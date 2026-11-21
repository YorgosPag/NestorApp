/**
 * @fileoverview **Οι σταθερές της πλαισίωσης κάμερας** — ό,τι χρειάζεται το `viewport-framing` και τίποτε άλλο.
 * @module lib/three/camera/framing-constants
 * @related ADR-920 §14.5 · ADR-366 §8.2 (προέλευση: `dxf-viewer/bim-3d/viewport/viewport-constants.ts`)
 *
 * 🔑 **Μετακόμιση, όχι αντίγραφο**: ζούσαν στο `viewport-constants.ts` του viewer, που όμως εισάγει το `DXF_TIMING` του
 * subapp και άρα δεν μπορεί να μπει ολόκληρο στο `lib`. Το `viewport-constants.ts` τις **επανεξάγει**, οπότε οι
 * καταναλωτές του viewer δεν άλλαξαν.
 */

/** Μισό ύψος του ορθογραφικού frustum σε `zoom = 1`. */
export const DEFAULT_ORTHO_SIZE = 15.0;

/** Το «πάνω» της κάμερας για κάθε ορθογραφική όψη (Y-up· στην κάτοψη ο βορράς = −Z). */
export const ORTHO_CAMERA_UP: Readonly<Record<string, readonly [number, number, number]>> = {
  top:    [0, 0, -1],
  bottom: [0, 0,  1],
  front:  [0, 1,  0],
  back:   [0, 1,  0],
  left:   [0, 1,  0],
  right:  [0, 1,  0],
} as const;

/** Περιθώριο γύρω από το πλαισιωμένο κουτί (10 %). */
export const FRAME_PADDING_FACTOR = 1.1;
