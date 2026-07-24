/**
 * srgb-linear-unit — ADR-694 Φ7. **ΕΝΑ** SSoT για τις δύο συναρτήσεις μεταφοράς (transfer
 * functions) του χώρου sRGB, ανά κανάλι, σε μονάδα `0..1`:
 *
 *   - **EOTF** (`srgbToLinearUnit`): sRGB κωδικοποιημένη τιμή → **γραμμική ένταση φωτός**.
 *   - **OETF** (`linearToSrgbUnit`): γραμμική ένταση φωτός → sRGB κωδικοποιημένη τιμή.
 *
 * ## Γιατί υπάρχει (ADR-694 Φ7 — ground truth)
 *
 * Το sRGB **δεν είναι γραμμικό**: η τιμή `128` δεν είναι «μισό φως» αλλά **~21.8%** — άρα κάθε
 * πράξη που *μέσο-όρου* (blend, resize, μέσο χρώμα υφής) πάνω σε ωμές sRGB τιμές βγάζει
 * συστηματικά **σκουρότερο/λασπωμένο** αποτέλεσμα. Ο σωστός κύκλος είναι πάντα
 * `sRGB → linear → πράξη → sRGB`.
 *
 * Πηγές: BlurHash `Algorithm.md` («virtually all image processing algorithms assume linearly
 * encoded light intensities»), NVIDIA GPU Gems 3 §24 «The Importance of Being Linear»,
 * LearnOpenGL «Gamma Correction».
 *
 * ## Γιατί **ακριβής** και όχι `pow(x, 2.2)`
 *
 * Η προσέγγιση `2.2` αστοχεί αισθητά στα σκοτεινά (η πραγματική sRGB έχει **γραμμικό** τμήμα κάτω
 * από το κατώφλι) — ακριβώς εκεί που οι υφές έχουν τις σκιές τους. Εδώ υλοποιείται η κανονική
 * IEC 61966-2-1 piecewise μορφή.
 *
 * ## Γιατί εδώ (N.18 — μηδέν sibling clone)
 *
 * Το ίδιο math χρειάζεται **τουλάχιστον** σε δύο σημεία της εισαγωγής υλικών: το μέσο χρώμα υφής
 * ({@link ./texture-average-color}) και η μετατροπή του glTF `baseColorFactor` (linear by spec) σε
 * `#rrggbb`. Καθαρή αριθμητική, μηδέν DOM — άρα testable χωρίς browser.
 *
 * @see ./rgb-unit-hex — ο αδελφός helper (μονάδα `0..1` → CSS hex· ΧΩΡΙΣ αλλαγή χώρου χρώματος)
 * @see ./texture-average-color — ο πρώτος καταναλωτής (μέσο χρώμα υφής, gamma-correct)
 * @see docs/centralized-systems/reference/adrs/ADR-694-storage-asset-custody-and-material-identity.md §Φ7
 */

/**
 * Ασφαλές clamp στο `0..1`. `NaN` → `0` (ποτέ δεν διαρρέει `NaN` στο hex)· `±Infinity` πέφτει
 * φυσιολογικά στα άκρα μέσω των συγκρίσεων.
 */
function clampUnit(value: number): number {
  if (Number.isNaN(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * sRGB (0..1) → **γραμμική** ένταση φωτός (0..1). IEC 61966-2-1 EOTF:
 * `c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`.
 */
export function srgbToLinearUnit(component: number): number {
  const c = clampUnit(component);
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Γραμμική ένταση φωτός (0..1) → sRGB (0..1). IEC 61966-2-1 OETF:
 * `l <= 0.0031308 ? l*12.92 : 1.055*l^(1/2.4) - 0.055`.
 */
export function linearToSrgbUnit(component: number): number {
  const l = clampUnit(component);
  return l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
}
