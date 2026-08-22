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
 * ⚠️ **ΜΗΝ γράψεις έκτη**: αν χρειάζεσαι όριο σε XY, κάλεσε το {@link bboxOf} (βαθμωτά,
 * για τοπικό υπολογισμό) ή το {@link planBoundsOf} (σχήμα σημείων, για αποθήκευση).
 *
 * 🔴 **ΔΙΟΡΘΩΣΗ 2026-08-22 (ADR-793)**: αυτή η κεφαλίδα ισχυριζόταν ότι «*το CHECK 3.28
 * (jscpd) το πιάνει ανεξάρτητα από το όνομα*». **Μετρήθηκε — ΔΕΝ το πιάνει.** Έξι ακόμη
 * βρόχοι είχαν ήδη προσγειωθεί (`opening` · `mep-segment` · `mep-fitting` · `railing` ·
 * `opening-info-tag` · `table-entity`), και οι **δύο τελευταίοι** είναι ιδιωτικά
 * `bboxOfCorners` που επιστρέφουν **ακριβώς** το σχήμα του {@link Bbox} με άλλο όνομα.
 * Ο λόγος είναι μηχανικός: `min-tokens: 50` στο `.jscpdrc.json`, οι βρόχοι είναι ~30
 * tokens. *Ένας ισχυρισμός σε σχόλιο δεν είναι φρουρός* (σχήμα CHECK 3.36).
 *
 * ⚠️ Ο πλατύς κανόνας «ποιος διπλώνει min/max XY;» **δοκιμάστηκε και απορρίφθηκε με
 * μέτρηση**: δίνει **79** ευρήματα σε όλο το subapp, ετερογενή (3Δ, screen-space,
 * culling, grid binning) — πολύ πάνω από τον πήχη <10% ψευδώς θετικών.
 */

import type { PlanarPoint, PlanBounds } from '../../types/bim-base';

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
export function bboxOf(pts: readonly PlanarPoint[]): Bbox {
  return bboxOfAll(pts);
}

/**
 * Όριο που χωράει **πολλά** σύνολα σημείων μαζί (άξονας + περίγραμμα + εσωτερικό…),
 * χωρίς ενδιάμεσο `concat`. Ένα πέρασμα ανά σύνολο — και **η μόνη** θέση όπου ζει
 * ο βρόχος: ο {@link bboxOf} είναι η εκφυλισμένη περίπτωση ενός συνόλου, όχι δίδυμο.
 */
export function bboxOfAll(...sets: readonly (readonly PlanarPoint[])[]): Bbox {
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

/**
 * Το ίδιο όριο, στο σχήμα **{@link PlanBounds}** — `{min,max}` με **σημεία**.
 *
 * ⚠️ **ΔΕΝ είναι δεύτερη μηχανή**: καλεί τον **ίδιο** {@link bboxOfAll}, ένα πέρασμα.
 * Είναι **παρουσίαση**, όχι υπολογισμός — και υπάρχει για **έναν** μετρημένο λόγο: το
 * σχήμα με σημεία **ΕΙΝΑΙ ΗΔΗ ΓΡΑΜΜΕΝΟ ΣΤΟ FIRESTORE** ως `geometry.bbox` για τους
 * `floor-finish` · `thermal-space` · `wall-covering`. Το βαθμωτό {@link Bbox} είναι ό,τι
 * θέλει κάθε **τοπικός** υπολογισμός· το `PlanBounds` είναι ό,τι θέλει η **αποθήκευση**.
 *
 * 🔑 Αντικατέστησε το `polygonBbox` (ADR-793), που ήταν το ίδιο περιτύλιγμα **συν το
 * ψέμα** `z: 0` — ένα κουτί που δήλωνε μηδενικό ύψος σε **11** σημεία αποθήκευσης.
 *
 * ⚠️ Κενή είσοδος ⇒ **μηδενικό κουτί στην αρχή** (`0,0`), όχι `±Infinity`: αυτό το
 * σχήμα ταξιδεύει σε **αποθηκευμένο** πεδίο και το `Infinity` **δεν είναι έγκυρο JSON**
 * ούτε γράφεται στο Firestore. Ο αδελφός {@link bboxOf} μένει σκόπιμα ωμός γιατί
 * **δεν** αποθηκεύεται ποτέ.
 */
export function planBoundsOf(pts: readonly PlanarPoint[]): PlanBounds {
  if (pts.length === 0) return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  const { minX, minY, maxX, maxY } = bboxOfAll(pts);
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

/** `true` όταν τα δύο κουτιά τέμνονται (κλειστά διαστήματα — επαφή μετράει). */
export function bboxOverlap(a: Bbox, b: Bbox): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}
