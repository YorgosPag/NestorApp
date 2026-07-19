/**
 * ADR-449 — segment axis (μοναδιαία κατεύθυνση a→b + μήκος): pure SSoT.
 *
 * ΕΝΑ σημείο για το «unit direction ενός finish segment» — κοινό σε `structural-finish-merge`
 * (collinear-run detection), `structural-finish-attribution` (override-edge projection) και
 * `structural-finish-outline-geometry` (flush-collinear corner). Πριν την κεντρικοποίηση ήταν
 * τρία σχεδόν πανομοιότυπα ιδιωτικά `unitDir`/`axisOf`/`segUnitDir` (N.18 sibling clones).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

interface Pt {
  readonly x: number;
  readonly y: number;
}

/** Μοναδιαία κατεύθυνση a→b + μήκος (canvas units). */
export interface SegAxis {
  readonly x: number;
  readonly y: number;
  readonly len: number;
}

/** Μοναδιαία κατεύθυνση a→b + μήκος, ή `null` αν εκφυλισμένο (μηδενικό μήκος). */
export function segmentAxis(a: Pt, b: Pt): SegAxis | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  return { x: dx / len, y: dy / len, len };
}
