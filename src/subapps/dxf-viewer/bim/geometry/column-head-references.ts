/**
 * Column **head reference lines** (ADR-523) — οι ΤΡΕΙΣ παράλληλες γραμμές αναφοράς της κεφαλής
 * (T-shape flange) / του οριζόντιου σκέλους (L-shape) μιας κολόνας, ως signed perpendicular offsets
 * από το ΚΕΝΤΡΟ κατά τον τοπικό άξονα y (scene units) + ημι-μήκος κατά τον τοπικό x.
 *
 * **FULL SSoT reuse:** αντλούν τα μετρικά από τα ΙΔΙΑ `lshapeMetrics`/`tshapeMetrics` που τρέφουν το
 * footprint (`column-geometry.ts`) — μηδέν drift μεταξύ render & reference lines. Pure, side-effect free.
 *
 * @see ./column-geometry.ts — lshapeMetrics/tshapeMetrics (SSoT μετρικά footprint)
 * @see ../columns/column-reference-lines.ts — ο multi-reference matcher που τα καταναλώνει
 * @see docs/centralized-systems/reference/adrs/ADR-523-column-head-multi-reference-snap.md
 */

import type { ColumnLshapeParams, ColumnTshapeParams } from '../types/column-types';
import { lshapeMetrics, tshapeMetrics } from './column-geometry';

/**
 * ADR-523 §L-shape — οι ΤΡΕΙΣ παράλληλες reference lines του **οριζόντιου σκέλους** L-κολόνας ως signed
 * perpendicular offsets από το ΚΕΝΤΡΟ κατά τον τοπικό άξονα y (scene units), + ημι-μήκος σκέλους. Το
 * οριζόντιο σκέλος (κάτω μπάρα) εκτείνεται σε ΟΛΟ το πλάτος `[-hw, hw]` (centered → `alongHalf = hw`),
 * πάχος `armLength`. Reuse `lshapeMetrics` (ΙΔΙΕΣ φόρμουλες με το footprint — μηδέν drift). Index 1 = ο
 * κεντρικός άξονας Γ1 (tie-break). Με `flipY` τα offsets αλλάζουν πρόσημο — ο matcher τα χειρίζεται
 * signed/orientation-agnostic (όπως T-shape).
 */
export interface LshapeHeadReferences {
  /** [νότια Α-Β (έξω άκρη), άξονας Γ1, βόρεια Δ (έσω άκρη)] — signed local-y offsets, scene units. */
  readonly perps: readonly [number, number, number];
  /** Ημι-μήκος οριζόντιου σκέλους κατά τον τοπικό x (along) — scene units. */
  readonly alongHalf: number;
}

export function lshapeHeadReferences(
  width: number,
  depth: number,
  s: number,
  override?: ColumnLshapeParams,
): LshapeHeadReferences {
  const { hd, armLength, hw, ys } = lshapeMetrics(width, depth, s, override);
  return {
    perps: [ys * -hd, ys * (-hd + armLength / 2), ys * (-hd + armLength)],
    alongHalf: hw,
  };
}

/**
 * ADR-523 — οι ΤΡΕΙΣ παράλληλες reference lines της **κεφαλής (flange)** Τ-κολόνας ως signed
 * perpendicular offsets από το ΚΕΝΤΡΟ κατά τον τοπικό άξονα y (scene units), + ημι-μήκος κεφαλής.
 * Reuse `tshapeMetrics` (ΙΔΙΕΣ φόρμουλες με το footprint — μηδέν διπλό math). Με `flipY` τα offsets
 * γίνονται αρνητικά (η κεφαλή στο −y) — ο matcher τα χειρίζεται signed (orientation-agnostic).
 */
export interface TshapeHeadReferences {
  /** [βόρεια 1-2 (έξω άκρη), άξονας Γ, νότια ε (έσω άκρη)] — signed local-y offsets, scene units. */
  readonly perps: readonly [number, number, number];
  /** Ημι-μήκος κεφαλής κατά τον τοπικό x (along) — scene units. */
  readonly alongHalf: number;
}

export function tshapeHeadReferences(
  width: number,
  depth: number,
  s: number,
  override?: ColumnTshapeParams,
): TshapeHeadReferences {
  const { flangeDepth, hd, halfFlange, ys } = tshapeMetrics(width, depth, s, override);
  return {
    perps: [ys * hd, ys * (hd - flangeDepth / 2), ys * (hd - flangeDepth)],
    alongHalf: halfFlange,
  };
}
