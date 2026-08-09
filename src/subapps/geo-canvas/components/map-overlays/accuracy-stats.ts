/**
 * 🎯 SSoT — ΣΤΑΤΙΣΤΙΚΑ ΑΚΡΙΒΕΙΑΣ ΣΗΜΕΙΩΝ ΕΛΕΓΧΟΥ
 *
 * Ο **ένας** υπολογισμός «πόσο ακριβή είναι τα σημεία ελέγχου;» για τα overlays του χάρτη.
 *
 * ⚠️ ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ: το CHECK 3.28 (jscpd) το έπιασε ως **structural clone**
 * — ο ίδιος `useMemo` ήταν γραμμένος **δύο φορές**, στο `GeoAccuracyLegend.tsx` και στο
 * `GeoStatusBar.tsx`, με **ταυτόσημη λογική** και μόνη διαφορά την προβολή: το πρώτο
 * επέστρεφε `{avg, best, worst}`, το δεύτερο `{avg, best}`. Το `worst` είναι δωρεάν όταν
 * έχεις ήδη τον πίνακα, οπότε ο SSoT τα επιστρέφει **και τα τρία** και κάθε καταναλωτής
 * παίρνει όσα δείχνει. Ο κλώνος **προϋπήρχε** (επαληθεύτηκε με `git show HEAD:` — τα δύο
 * μπλοκ ήταν byte-identical με το HEAD)· εξήχθη εδώ κατά τον κανόνα N.0.2 (Boy Scout).
 *
 * ⚠️ ΜΗΝ τον ξαναγράψεις inline. Δύο αντίγραφα σημαίνει ότι η επόμενη αλλαγή στο κριτήριο
 * ακρίβειας θα εφαρμοστεί στο ένα από τα δύο, **σιωπηλά** — και τα δύο overlays ζωγραφίζουν
 * στον **ίδιο** χάρτη, δίπλα-δίπλα, όπου η ασυμφωνία είναι ορατή στον χρήστη.
 *
 * @module subapps/geo-canvas/components/map-overlays/accuracy-stats
 */

import type { FloorPlanControlPoint } from '../../floor-plan-system/types/control-points';

/** Στατιστικά ακρίβειας, ήδη μορφοποιημένα για εμφάνιση (2 δεκαδικά, μέτρα). */
export interface AccuracyStats {
  /** Μέση ακρίβεια. */
  readonly avg: string;
  /** Η **καλύτερη** μέτρηση — δηλαδή η **μικρότερη** τιμή σφάλματος. */
  readonly best: string;
  /** Η **χειρότερη** μέτρηση — δηλαδή η **μεγαλύτερη** τιμή σφάλματος. */
  readonly worst: string;
}

/**
 * Υπολογίζει τα στατιστικά ακρίβειας ενός συνόλου σημείων ελέγχου.
 *
 * Επιστρέφει `null` — **όχι μηδενικά** — όταν δεν υπάρχει τίποτα να μετρηθεί: ούτε σημεία,
 * ούτε σημείο με αριθμητική `accuracy`. Το `null` σημαίνει «δεν ξέρω», ενώ ένα `0.00` θα
 * διαβαζόταν ως «τέλεια ακρίβεια» — το ακριβώς αντίθετο.
 */
export function computeAccuracyStats(
  controlPoints: readonly FloorPlanControlPoint[] | undefined,
): AccuracyStats | null {
  if (!controlPoints || controlPoints.length === 0) return null;

  const accuracyValues = controlPoints
    .map(cp => cp.accuracy)
    .filter((value): value is number => typeof value === 'number');
  if (accuracyValues.length === 0) return null;

  const total = accuracyValues.reduce((sum, acc) => sum + acc, 0);

  return {
    avg: (total / accuracyValues.length).toFixed(2),
    best: Math.min(...accuracyValues).toFixed(2),
    worst: Math.max(...accuracyValues).toFixed(2),
  };
}
