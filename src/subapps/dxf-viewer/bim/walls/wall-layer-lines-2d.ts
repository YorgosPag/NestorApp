/**
 * Wall per-layer boundary lines — 2D plan (ADR-413/447 · ADR-449 junction parity).
 *
 * Σε κάτοψη ο πολυστρωματικός (DNA) τοίχος ζωγραφιζόταν ως **ΕΝΑ σκέτο ορθογώνιο**
 * (`WallRenderer.drawFootprint`) — το per-material hatch παρακάμπτεται για DNA τοίχους
 * (`drawMaterialHatch`: `if (wall.params.dna) return`). Έτσι ο σοβάς του τοίχου ΔΕΝ φαινόταν
 * στην κάτοψη, σε αντίθεση με την κολόνα που δείχνει ρητό finish περίγραμμα (ADR-449
 * `drawStructuralFinishSkin2D`) → ασύμμετρη ανάγνωση στη συμβολή τοίχου↔κολόνας.
 *
 * Revit-grade λύση (compound structure σε plan): ζωγραφίζουμε τις **εσωτερικές γραμμές
 * διαχωρισμού στρώσεων** — μία πολυγραμμή παράλληλη στις παρειές σε κάθε σύνορο στρώσης
 * (εξωτ. σοβάς | πυρήνας | εσωτ. σοβάς). Έτσι η ζώνη σοβά γίνεται ορατή κατά μήκος της όψης,
 * συνεπές με την κολόνα.
 *
 * Pure geometry — μηδέν THREE / store / ctx. REUSE `buildupBoundaryFractions` (SSoT στο
 * `layered-buildup.ts`, το ίδιο που τρέφει το 3Δ per-layer split) — μηδέν νέα μαθηματικά.
 *
 * @see bim/types/layered-buildup.ts — `buildupBoundaryFractions` (fraction SSoT)
 * @see bim-3d/converters/wall-layer-geometry.ts — 3Δ per-layer split (ίδιο fraction math)
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures.md
 */

import type { Point3D } from '../types/bim-base';
import { buildupBoundaryFractions, type BuildupThicknessSource } from '../types/layered-buildup';

/** Γραμμικό interp δύο plan σημείων (z=0 — οι παρειές είναι 2Δ footprints). */
function lerpPt(o: Point3D, i: Point3D, t: number): Point3D {
  return { x: o.x + (i.x - o.x) * t, y: o.y + (i.y - o.y) * t, z: 0 };
}

/**
 * Πολυγραμμές των **εσωτερικών** συνόρων στρώσεων ενός DNA τοίχου σε κάτοψη.
 *
 * Για κάθε εσωτερικό σύνορο (fraction `f1..f(n-1)`, εξαιρώντας 0=outer & 1=inner που είναι
 * ΗΔΗ οι παρειές του `drawFootprint`) παράγει μία πολυγραμμή `lerp(outer[i], inner[i], f)`
 * ανά αντίστοιχη κορυφή — παράλληλη στις παρειές, στο βάθος της στρώσης. Outer & inner edge
 * έχουν αντίστοιχες κορυφές (`offsetAxisToEdges`) → index-wise interpolation.
 *
 * Επιστρέφει `[]` όταν ο τοίχος είναι μονόστρωτος (≤1 σύνορο) ή εκφυλισμένος.
 */
export function wallLayerBoundaryPolylines(
  outer: readonly Point3D[],
  inner: readonly Point3D[],
  dna: BuildupThicknessSource,
): Point3D[][] {
  const n = Math.min(outer.length, inner.length);
  if (n < 2) return [];
  const fracs = buildupBoundaryFractions(dna); // [0, f1, …, 1]
  const lines: Point3D[][] = [];
  for (let k = 1; k < fracs.length - 1; k++) {
    const f = fracs[k];
    if (f <= 1e-6 || f >= 1 - 1e-6) continue; // σύνορο πάνω σε παρειά → ήδη ζωγραφισμένο
    const poly: Point3D[] = [];
    for (let i = 0; i < n; i++) poly.push(lerpPt(outer[i], inner[i], f));
    lines.push(poly);
  }
  return lines;
}
