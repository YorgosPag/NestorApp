/**
 * @fileoverview **Η ΕΙΚΟΝΑ ΩΣ PIXEL** (SSoT): RGBA γραμμή-προς-γραμμή, όπως το δίνει το `getImageData`. Ο **ένας** τύπος
 * εικόνας για κάθε επεξεργασία raster του έργου: ανίχνευση χώρων (ADR-884 §4.14) και αναγνώριση κάτοψης (ADR-929 Φ1+).
 * @module lib/geometry/raster/plan-raster
 *
 * 🔑 **Γιατί εδώ**: γεννήθηκε στο `lib/spatial-tour/space-detect/` για τον ανιχνευτή χώρων· η αναγνώριση κάτοψης (ADR-929
 *   §6.1 #5) τον χρειάζεται στην ευθυγράμμιση και στη γεωμετρία. Ένας τύπος για το ίδιο buffer σε **ουδέτερο** σημείο, δίπλα
 *   στα εργαλεία που τον καταναλώνουν (Otsu · μορφολογία · συνιστώσες), ώστε κανείς να μη φτιάξει δεύτερο.
 * 📏 Αρχή πάνω-αριστερά, `y` προς τα κάτω (χώρος `raster-px`, ADR-794). Κανάλι άλφα **πάντα** παρόν.
 */

/** Η εικόνα όπως τη δίνει το `getImageData` (RGBA, γραμμή-προς-γραμμή). */
export interface PlanRaster {
  readonly rgba: Uint8ClampedArray | Uint8Array;
  readonly width: number;
  readonly height: number;
}

/**
 * Εικόνα για **αναγνώριση**, που μπορεί να έχει άλλη ανάλυση από τα `naturalBounds` του υποβάθρου (ADR-929 §6.16 βήμα 4: μια
 * σάρωση PDF αποδίδεται στην εγγενή της ανάλυση για το OCR, ενώ η οθόνη μένει στην απόδοση ×2).
 * 📏 `naturalPerRasterPx`: πόσα px των `naturalBounds` αντιστοιχούν σε 1 px αυτής της εικόνας (`1` = ίδια ανάλυση). Η απεικόνιση
 *   είναι ομοιόμορφη κλίμακα με αρχή την πάνω-αριστερή γωνία: `natural = raster × naturalPerRasterPx` (συνεχή px).
 */
export interface RecognitionRaster {
  readonly raster: PlanRaster;
  readonly naturalPerRasterPx: number;
}

/** Νέα κενή (λευκή, αδιαφανής) εικόνα — το «χαρτί» κάθε μετασχηματισμού που γεμίζει ό,τι πέφτει έξω από την πηγή. */
export function blankPlanRaster(width: number, height: number): PlanRaster & { readonly rgba: Uint8ClampedArray } {
  const rgba = new Uint8ClampedArray(width * height * 4);
  rgba.fill(255);
  return { rgba, width, height };
}
