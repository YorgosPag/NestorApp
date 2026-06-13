/**
 * Grid justification — canonical CCW unit normal of an axis (ADR-441, Slice 0 relocate).
 *
 * Shared pure helper για ΟΛΑ τα γραμμικά grid-justified entities (foundation strip/
 * tie-beam, beam, wall). Ζούσε private στο `foundation-geometry.ts`· εξάγεται εδώ
 * (neutral `bim/grid/`) ώστε ο shared offset helper (`grid-segment-justification.ts`)
 * + τα beam/wall builders να μην εξαρτώνται από το foundations module.
 *
 * @see ./grid-segment-justification.ts — consumer (linear perpendicular offset)
 * @see ../geometry/foundation-geometry.ts — consumer (buildBandFootprint / stripJustifiedAxis)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { Point2D } from '../../rendering/types/Types';

/**
 * Canonical CCW unit normal of an axis start→end, ORIENTATION-INVARIANT.
 *
 * Η έδραση ('left'/'right') ορίζεται σχετικά με τη φορά σχεδίασης start→end, αλλά αυτή
 * η φορά είναι ΑΥΘΑΙΡΕΤΗ (ο grid builder εκπέμπει +Y/+X, όμως το follow-on-move μπορεί να
 * την αντιστρέψει όταν ένας άξονας προσπεράσει άλλον — τότε ένα raw CCW normal θα γύριζε
 * και η έκκεντρη ζώνη θα προεξείχε προς τη ΛΑΘΟΣ πλευρά). Κανονικοποιώντας την εφαπτομένη
 * εδώ (κατακόρυφη → +Y, οριζόντια → +X) κάθε justification-derived γεωμετρία γίνεται
 * orientation-invariant (Revit Location Line). `null` σε degenerate (μηδενικού μήκους) άξονα.
 */
export function canonicalAxisNormal(start: Point2D, end: Point2D): { nx: number; ny: number } | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  let ux = dx / len, uy = dy / len;
  if (uy < -1e-9 || (Math.abs(uy) <= 1e-9 && ux < 0)) { ux = -ux; uy = -uy; }
  // CCW 90° unit normal (rotate tangent (ux,uy) → (-uy,ux)).
  return { nx: -uy, ny: ux };
}
