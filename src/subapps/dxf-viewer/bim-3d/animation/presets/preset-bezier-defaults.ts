/**
 * ADR-366 §C.1.Q4 — CSS-standard bezier control points για κάθε easing preset.
 *
 * Όταν user ανοίγει τον BezierCurveEditor (Προχωρημένα expander), η αρχική
 * καμπύλη αντιστοιχεί στο preset που είχε ήδη επιλέξει — visual continuity
 * (Chrome DevTools / Material Motion convention).
 *
 * Mapping references:
 *  - linear:         CSS spec
 *  - ease-in/out:    CSS spec (cubic-bezier(0.42, 0, 0.58, 1) etc)
 *  - quart variants: Penner → bezier approximation (visual fit)
 *  - smooth-step:    Hermite cubic approximation
 *  - elastic:        Back-out approximation για editable starting point
 */

import type { BezierControlPoints, EasingPresetId } from '../animation-types';

export const PRESET_BEZIER_MAPPING: Readonly<Record<EasingPresetId, BezierControlPoints>> =
  Object.freeze({
    'linear': { p1: [0.25, 0.25], p2: [0.75, 0.75] },
    'ease-in': { p1: [0.42, 0], p2: [1, 1] },
    'ease-out': { p1: [0, 0], p2: [0.58, 1] },
    'ease-in-out': { p1: [0.42, 0], p2: [0.58, 1] },
    'ease-in-quart': { p1: [0.5, 0], p2: [0.75, 0] },
    'ease-out-quart': { p1: [0.25, 1], p2: [0.5, 1] },
    'smooth-step': { p1: [0.4, 0], p2: [0.6, 1] },
    'elastic': { p1: [0.68, -0.55], p2: [0.265, 1.55] },
  });

/** Resolve canonical bezier control points για ένα preset id. */
export function getPresetBezier(id: EasingPresetId): BezierControlPoints {
  return PRESET_BEZIER_MAPPING[id] ?? PRESET_BEZIER_MAPPING['linear'];
}
