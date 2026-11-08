/**
 * @fileoverview **ΑΝΕΞΑΡΤΗΤΕΣ ΜΟΝΑΔΕΣ ΤΗΣ ΤΟΠΙΚΗΣ H0** (SSoT, ADR-929 §6.9 #19 — ο εκτιμητής E4 του #18).
 * @module lib/geometry/registration/registration-units
 *
 * 🔴 **Γιατί υπάρχει.** Η ουρά Poisson-binomial υποθέτει ανεξάρτητα τμήματα. Οι δύο παρειές ενός τοίχου όμως πετυχαίνουν ή
 * αποτυγχάνουν **μαζί**: όταν η μία βρίσκει μελάνι σε μια μετατόπιση, η άλλη (σε απόσταση < 2r + W) το βρίσκει κι αυτή. Το NFA
 * μετρούσε το ίδιο γεγονός δύο φορές. Ο συντελεστής Kish (Var/Σp(1−p)) το διόρθωνε συνολικά και επικυρώθηκε μόνο 16/26 σωστά.
 *
 * 🔑 **Μονάδα = ομάδα τμημάτων που πετυχαίνουν μαζί εκ κατασκευής**: παράλληλα (≤ `unitParallelDeg`), αντικριστά (οι
 * προβολές επικαλύπτονται) και πιο κοντά από 2r + W — δηλαδή αρκετά κοντά ώστε το probe του ενός να φτάνει το μελάνι του
 * άλλου. Η μονάδα «πέτυχε» όταν πέτυχε τουλάχιστον `segmentHitShare` του **μήκους** της (ο ίδιος κανόνας κλάσματος με τα
 * δείγματα ενός τμήματος). Η p κάθε μονάδας μετριέται από τις **ίδιες** μετατοπίσεις — καμία παραμετρική υπόθεση.
 * Μετρημένο (§6.9 #18–#19): NFA ≤ 0 σε 26/26 + 32/32 σωστά, 1/33 λάθος· το μόνο που έμεινε το κόβει ο λόγος Lowe.
 *
 * 📐 Είναι η ιδέα του «effective number of independent tests» (Cheverud 2001 · Li & Ji 2005), αλλά από τη **γεωμετρία** του
 * probe αντί για εκτίμηση ιδιοτιμών: οι δύο εκτιμητές ιδιοτιμών (E2, E3) πέρασαν κι αυτοί, αλλά δέχτηκαν 3–4/33 λάθος ζεύγη.
 */

import { createDisjointSets } from '../../algorithms/disjoint-sets';
import type { ImageSegment, SegmentProbe } from './registration-null-model';
import { parallelOverlapGap } from './registration-quality';
import type { RegisterOptions } from './registration-types';

/**
 * Οι ανεξάρτητες μονάδες: κάθε μονάδα = δείκτες τμημάτων σε αύξουσα σειρά· οι μονάδες με τη σειρά του πρώτου τους τμήματος.
 * Ντετερμινιστικό· O(S²) ζεύγη (S ≤ `maxSegments`).
 */
export function independentUnits(segs: readonly ImageSegment[], q: SegmentProbe, o: RegisterOptions): number[][] {
  const sets = createDisjointSets(segs.length);
  const reach = 2 * q.radius + q.strokeWidthPx;
  const tolerance = (o.acceptance.unitParallelDeg * Math.PI) / 180;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const gap = parallelOverlapGap(segs[i], segs[j], tolerance) ?? parallelOverlapGap(segs[j], segs[i], tolerance);
      if (gap !== null && gap < reach) sets.union(i, j);
    }
  }
  return sets.groups();
}

/** Πέτυχε η μονάδα; ⇔ το μήκος των τμημάτων της που πέτυχαν ≥ `share` × το συνολικό της μήκος. */
export function unitSucceeded(
  unit: readonly number[], segs: readonly ImageSegment[], hit: (segment: number) => boolean, share: number,
): boolean {
  let total = 0;
  let hitLength = 0;
  for (const i of unit) {
    total += segs[i].lengthPx;
    if (hit(i)) hitLength += segs[i].lengthPx;
  }
  return total > 0 && hitLength >= share * total;
}
