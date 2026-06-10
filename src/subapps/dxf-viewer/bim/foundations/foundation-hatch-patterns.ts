/**
 * Foundation concrete hatch (ADR-436, Slice 1).
 *
 * Η θεμελίωση είναι ΠΑΝΤΑ οπλισμένο σκυρόδεμα (RC) → concrete cut hatch =
 * το RC dot-grid plan. Αντί να διπλασιάσουμε τη hatch math (N.0.2 / N.12), αυτό
 * το module ΑΝΑΚΥΚΛΩΝΕΙ το υπάρχον per-material hatch SSoT (`column-hatch-patterns`,
 * που είναι de-facto γενικό material-hatch SSoT — rc/steel/masonry/wood). Εδώ
 * εκθέτουμε μόνο το concrete (RC) preset + τα shared render constants.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4.1
 */

import type { BoundingBox3D } from '../types/bim-base';
import {
  computeHatchPlan,
  HATCH_LINE_WIDTH_PX,
  HATCH_STROKE_RGBA,
  RC_DOT_RADIUS_PX,
  type HatchPlan,
} from '../columns/column-hatch-patterns';

export type { HatchPlan } from '../columns/column-hatch-patterns';

/** Shared faint hatch stroke colour (SSoT). */
export const FOUNDATION_HATCH_STROKE_RGBA = HATCH_STROKE_RGBA;

/** Concrete (RC) hatch stroke width σε CSS px (SSoT). */
export const FOUNDATION_HATCH_LINE_WIDTH_PX = HATCH_LINE_WIDTH_PX.rc;

/** RC dot radius σε CSS px (zoom-invariant, SSoT). */
export const FOUNDATION_HATCH_DOT_RADIUS_PX = RC_DOT_RADIUS_PX;

/**
 * Concrete cut hatch plan για ένα foundation footprint bbox. Always RC
 * (σκυρόδεμα θεμελίωσης) — dot-grid @150mm. Renderer κάνει polygon clip στο
 * πραγματικό footprint + `worldToScreen` per dot.
 */
export function computeFoundationHatchPlan(bbox: BoundingBox3D): HatchPlan {
  return computeHatchPlan(bbox, 'rc');
}
