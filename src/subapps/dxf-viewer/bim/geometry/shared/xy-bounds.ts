/**
 * **ΤΟ ΑΞΟΝΟ-ΕΥΘΥΓΡΑΜΜΙΣΜΕΝΟ ΟΡΘΟΓΩΝΙΟ ΣΤΟ XY — ΜΙΑ ΦΟΡΑ.**
 *
 * @module bim/geometry/shared/xy-bounds
 * @related ADR-583 (CHECK 3.28) · ADR-749 (μία μηχανή, μία αλήθεια)
 *
 * Το «πέρασε τα σημεία, κράτα min/max σε x και y» ήταν γραμμένο **πέντε** φορές:
 * `member-column-cutback.bboxOf` · `structural-finish-horizontal-obstacles.bboxOf`
 * (**byte-identical** μεταξύ τους) και **τρεις ενσωματωμένες** επαναλήψεις μέσα στα
 * `computeBbox` των δοκών/τοίχων και στο `materializeColumnLocalPolygonMm`.
 *
 * ⚠️ **ΔΕΝ είναι δεύτερη αυθεντία δίπλα στο {@link footprintBounds}** — άλλη ερώτηση:
 * εκείνο ρωτά «ποια είναι η έκταση **πολυγώνου**» και περνά από τον `projectPolygonOnAxis`
 * (επιστρέφει `null` για <3 κορυφές, γιατί δύο σημεία δεν είναι πολύγωνο). Εδώ η ερώτηση
 * είναι «ποιο κουτί χωράει **αυτά τα σημεία**», όποια κι αν είναι — άξονας δοκού, τμήμα,
 * μεμονωμένη κορυφή. Δύο σημεία **έχουν** κουτί.
 *
 * ⚠️ **ΜΗΝ γράψεις έκτη**: αν χρειάζεσαι όριο σε XY, κάλεσε το {@link bboxOf}. Το
 * CHECK 3.28 (jscpd, token-based) το πιάνει ανεξάρτητα από το όνομα που θα του δώσεις.
 */

/** Άξονο-ευθυγραμμισμένο όριο στο επίπεδο XY. Το z **δεν** συμμετέχει ποτέ. */
export interface Bbox {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/**
 * Όριο που χωράει **όλα** τα σημεία. Κενή είσοδος ⇒ `±Infinity` — **σκόπιμα ωμό**:
 * ο καλών ξέρει αν το κενό σύνολο είναι νόμιμο στο δικό του πλαίσιο, το όριο όχι.
 */
export function bboxOf(pts: readonly { readonly x: number; readonly y: number }[]): Bbox {
  return bboxOfAll(pts);
}

/**
 * Όριο που χωράει **πολλά** σύνολα σημείων μαζί (άξονας + περίγραμμα + εσωτερικό…),
 * χωρίς ενδιάμεσο `concat`. Ένα πέρασμα ανά σύνολο — και **η μόνη** θέση όπου ζει
 * ο βρόχος: ο {@link bboxOf} είναι η εκφυλισμένη περίπτωση ενός συνόλου, όχι δίδυμο.
 */
export function bboxOfAll(
  ...sets: readonly (readonly { readonly x: number; readonly y: number }[])[]
): Bbox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const set of sets) {
    for (const p of set) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return { minX, maxX, minY, maxY };
}

/** `true` όταν τα δύο κουτιά τέμνονται (κλειστά διαστήματα — επαφή μετράει). */
export function bboxOverlap(a: Bbox, b: Bbox): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}
