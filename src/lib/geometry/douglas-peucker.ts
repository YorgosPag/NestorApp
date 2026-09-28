/**
 * =============================================================================
 * DOUGLAS–PEUCKER ΣΕ ΚΛΕΙΣΤΟ ΔΑΚΤΥΛΙΟ (SSoT) — επίπεδο, χωρίς μονάδες
 * =============================================================================
 *
 * 🔑 **Εγγύηση**: κάθε κορυφή που αφαιρείται απέχει **≤ ανοχή** από το τμήμα που την αντικαθιστά. Αυτή η υπόσχεση
 * είναι ο λόγος που ο DP προτιμάται από τον Visvalingam (κριτήριο εμβαδού, καμία υπόσχεση απόστασης).
 *
 * 🔑 **Κλειστός δακτύλιος = δύο αλυσίδες**: ο DP ορίζεται σε γραμμή με δύο άκρα. Σε δακτύλιο κρατάμε δύο σταθερά
 * σημεία — την πρώτη κορυφή και την πιο μακρινή της — και απλοποιούμε τις δύο αλυσίδες ανάμεσά τους. Αλλιώς το
 * τμήμα «τελευταία → πρώτη» είναι σχεδόν μηδενικό και κάθε απόσταση μετριέται ως απόσταση **σημείου**.
 *
 * Ήταν τρεις υλοποιήσεις (ADR-884 §4.14 Γ3 audit): `lib/geo/geo-simplify.ts` (σωστή, δύο αλυσίδες — εδώ μετακόμισε),
 * `dxf-viewer/bim/mesh-library/mesh-silhouette.ts` (πρώτη–τελευταία ως άκρα) και `packages/core/polygon-system`
 * (αναδρομική, ανοιχτή γραμμή — `.claude-rules/pending-ratchet-work.md`). Οι δύο πρώτες καλούν πλέον αυτό.
 *
 * Επαναληπτικό με στοίβα: ακτογραμμή 100.000 κορυφών δεν εξαντλεί τη στοίβα κλήσεων.
 *
 * @module lib/geometry/douglas-peucker
 */

import { distanceToSegment, type PlanarPoint } from './planar-polygon';

/** Σημαδεύει ποιες κορυφές του `[first, last]` μένουν· το `last` μπορεί να είναι `points.length` (= κορυφή 0). */
function markChain(
  points: readonly PlanarPoint[],
  first: number,
  last: number,
  tolerance: number,
  keep: boolean[],
): void {
  const stack: [number, number][] = [[first, last]];
  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number];
    let farthest = -1;
    let farthestDistance = tolerance;
    for (let i = start + 1; i < end; i++) {
      const distance = distanceToSegment(points[i], points[start], points[end % points.length]);
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthest = i;
      }
    }
    if (farthest === -1) continue;
    keep[farthest] = true;
    stack.push([start, farthest], [farthest, end]);
  }
}

/** Η κορυφή που απέχει **περισσότερο** από την πρώτη — το δεύτερο σταθερό σημείο του δακτυλίου. */
function farthestFromFirst(points: readonly PlanarPoint[]): number {
  let index = 0;
  let best = -1;
  for (let i = 1; i < points.length; i++) {
    const distance = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y);
    if (distance > best) {
      best = distance;
      index = i;
    }
  }
  return index;
}

/**
 * Μάσκα «μένει;» ανά κορυφή **ανοιχτού** δακτυλίου (χωρίς επαναλαμβανόμενη τελευταία κορυφή). Χρήσιμη όταν ο
 * καλών απλοποιεί σε **άλλο** πλαίσιο από αυτό που κρατά (γεωγραφικές κορυφές, απλοποίηση σε τοπικά μέτρα).
 * `tolerance ≤ 0` ⇒ μένουν όλες.
 */
export function closedRingKeepMask(points: readonly PlanarPoint[], tolerance: number): boolean[] {
  if (points.length < 3 || !(tolerance > 0)) return points.map(() => true);
  const pivot = farthestFromFirst(points);
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[pivot] = true;
  markChain(points, 0, pivot, tolerance, keep);
  markChain(points, pivot, points.length, tolerance, keep);
  return keep;
}

/**
 * Μάσκα «μένει;» ανά κορυφή **ανοιχτής αλυσίδας** με **σταθερά άκρα** (πρώτη + τελευταία μένουν πάντα).
 *
 * 🔑 **Το τόξο της τοπολογικής απλοποίησης** (ADR-890 §14.3, `scripts/lib/admin-boundaries/shared-arc-simplify.ts`):
 * η κοινή ακμή δύο γειτόνων απλοποιείται **μία** φορά ανάμεσα σε δύο κόμβους, ώστε και οι δύο να πάρουν τις
 * **ίδιες** κορυφές — καμία σχισμή. Τα άκρα είναι κόμβοι· αν έφευγαν, ο τρίτος γείτονας θα έχανε τη γωνία του.
 * Ίδια εγγύηση με τον δακτύλιο: κάθε κορυφή που φεύγει απέχει **≤ ανοχή**. `tolerance ≤ 0` ⇒ μένουν όλες.
 */
export function openChainKeepMask(points: readonly PlanarPoint[], tolerance: number): boolean[] {
  if (points.length < 3 || !(tolerance > 0)) return points.map(() => true);
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  markChain(points, 0, points.length - 1, tolerance, keep);
  return keep;
}

/**
 * Απλοποιεί **ανοιχτή γραμμή** (τα δύο άκρα μένουν πάντα) κρατώντας τις ίδιες τις κορυφές. `tolerance ≤ 0` ή ≤ 2
 * κορυφές ⇒ ως έχει.
 */
export function simplifyPolyline<T extends PlanarPoint>(points: readonly T[], tolerance: number): T[] {
  const keep = openChainKeepMask(points, tolerance);
  return points.filter((_, index) => keep[index]);
}

/**
 * Απλοποιεί **ανοιχτό** δακτύλιο κρατώντας τις ίδιες τις κορυφές (ίδιος τύπος `T`). Μπορεί να επιστρέψει
 * **< 3** κορυφές — τότε το σχήμα είναι μικρότερο από την ανοχή· ο καλών αποφασίζει τι σημαίνει αυτό.
 */
export function simplifyClosedRing<T extends PlanarPoint>(points: readonly T[], tolerance: number): T[] {
  const keep = closedRingKeepMask(points, tolerance);
  return points.filter((_, index) => keep[index]);
}
