/**
 * ADR-933 — Μέθοδος «Ορθογώνια» της εντολής «Περιοχή» (ArchiCAD Zone «Rectangular»).
 *
 * Δύο αντίθετες γωνίες → δακτύλιος 4 κορυφών. ΕΝΑΣ υπολογισμός για την προεπισκόπηση (rubber
 * band) ΚΑΙ για την αποθήκευση — ό,τι βλέπει ο άνθρωπος είναι ό,τι γράφεται. Η γεωμετρία
 * ανατίθεται στο BIM SSoT `rectangleCorners` (κανονικοποίηση δεξιά→αριστερά / κάτω→πάνω, CCW).
 */

import { rectangleCorners } from '../bim/walls/wall-from-entity';

type Tuple = [number, number];

/** Δακτύλιος του ορθογωνίου των δύο γωνιών· `null` όταν είναι εκφυλισμένο (μηδενικό πλάτος ή ύψος). */
export function regionRectangleRing(
  first: readonly [number, number],
  opposite: { readonly x: number; readonly y: number },
): Tuple[] | null {
  const corners = rectangleCorners({
    corner1: { x: first[0], y: first[1] },
    corner2: { x: opposite.x, y: opposite.y },
  });
  if (corners.length < 4) return null;
  if (first[0] === opposite.x || first[1] === opposite.y) return null;
  return corners.map((c) => [c.x, c.y] as Tuple);
}
