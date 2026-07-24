/**
 * texture-average-color — ADR-691 Φ3 / ADR-694 Φ7. Το **αντιπροσωπευτικό χρώμα** μιας υφής
 * (`#rrggbb`), υπολογισμένο από τα ίδια της τα bytes — **gamma-correct** και **alpha-weighted**.
 *
 * ## Γιατί χρειάζεται (ground truth 2026-07-24, `abricos_gerbera`)
 *
 * Ένα υλικό **με υφή** δεν έχει χρήσιμο «χρώμα» στο αρχείο: ο C4D γράφει `Color 204,204,204`
 * (γκρι) και αφήνει το πορτοκαλί στο `Abricos_full_color.jpg`. Το ίδιο περνά και στο glTF ως
 * `baseColorFactor ≈ [0.8,0.8,0.8]`. Άρα όποιος ζητήσει «τι χρώμα είναι αυτό το υλικό;» —
 * το swatch της μπάρας, ο 2Δ color resolver, το flat fallback — παίρνει **γκρι**, ενώ το
 * υλικό είναι ολοφάνερα πορτοκαλί.
 *
 * Οι μεγάλοι λύνουν το ίδιο πρόβλημα με τον ίδιο τρόπο: το Revit δείχνει στο Material Browser
 * το **μέσο χρώμα** ενός image appearance asset· ο C4D κάνει το ίδιο στο Material Manager
 * preview. Δεν είναι «μαντεψιά» — είναι η μοναδική απάντηση που υπάρχει, και βγαίνει από τα
 * δεδομένα.
 *
 * ## ADR-694 Φ7 — γιατί ο μέσος όρος γίνεται σε **γραμμικό** φως
 *
 * Μέχρι το Φ7 ο μέσος όρος γινόταν πάνω σε ωμές sRGB τιμές. Αυτό είναι καταγεγραμμένο λάθος: το
 * sRGB `128` δεν είναι 50% φως αλλά **~21.8%**, άρα ο μέσος όρος έβγαινε συστηματικά
 * **σκουρότερος/λασπωμένος**. Απόδειξη: μισή μαύρη / μισή λευκή υφή έδινε `#808080`, ενώ το
 * πραγματικό μέσο φως (0.5) είναι `#bcbcbc`. Η αλυσίδα τώρα είναι
 * `sRGB → linear (EOTF) → μέσος όρος → sRGB (OETF)` μέσω του SSoT {@link ./srgb-linear-unit}.
 *
 * ## ADR-694 Φ7 — alpha ως **βάρος**, όχι ως διακόπτης
 *
 * Ένα ημιδιαφανές pixel συνεισφέρει τόσο φως όσο και το alpha του (premultiplied-aware μέσος όρος,
 * iquilezles.org/articles/premultipliedalpha). Πριν, κάθε pixel πάνω από ένα κατώφλι μετρούσε με
 * **πλήρες** βάρος → τα μαλακά άκρα μιας υφής φύλλου έβαφαν τον μέσο όρο σαν να ήταν συμπαγή.
 * Τα **ολικά** διάφανα (alpha ≈ 0) παραμένουν αγνοημένα: το RGB τους είναι σκουπίδια (ό,τι έτυχε
 * να μείνει στον encoder), όχι χρώμα.
 *
 * ## Γιατί εδώ (και όχι σε pure module)
 *
 * Το **decode** απαιτεί browser API. Ο **υπολογισμός** όμως είναι καθαρός: εξάγεται ρητά ως
 * {@link averageColorHexOfPixels} (δέχεται `Uint8ClampedArray` RGBA) ώστε τα maths να ελέγχονται
 * με jest χωρίς DOM. Το module injectάρεται στον orchestrator ώστε κι εκείνος να μένει testable.
 *
 * **Μηδέν dependency (N.5):** `createImageBitmap` + `OffscreenCanvas`, native και τα δύο.
 *
 * @see ./srgb-linear-unit — οι ακριβείς sRGB ↔ linear συναρτήσεις μεταφοράς (SSoT, Φ7)
 * @see ./import-embedded-materials — ο καταναλωτής (γράφει το αποτέλεσμα στο `appearance`)
 * @see ./texture-content-hash — ο αδελφός browser-only helper (ίδιο μοτίβο DI)
 * @see docs/centralized-systems/reference/adrs/ADR-691-imported-mesh-embedded-material-extraction.md
 */

import { rgbUnitToHex } from './rgb-unit-hex';
import { srgbToLinearUnit, linearToSrgbUnit } from './srgb-linear-unit';

/**
 * Πλευρά του καμβά υποδειγματοληψίας (`SAMPLE_SIZE²` δείγματα).
 *
 * **Γιατί 64 και όχι η πλήρης ανάλυση (ADR-694 Φ7):** το ίδιο το `drawImage` downscale φιλτράρει
 * σε **sRGB** — δηλαδή εισάγει το ΙΔΙΟ gamma σφάλμα που διορθώνουμε παρακάτω, μία φορά ακόμη, και
 * δεν υπάρχει canvas API που να ζητά γραμμικό resample. Το σφάλμα αυτό είναι ανάλογο της
 * **διακύμανσης μέσα σε κάθε κουτί** του φίλτρου: όσο λιγότερα source pixels πέφτουν σε κάθε
 * output texel, τόσο μικρότερο. Το 16 → 64 δεκαεξαπλασιάζει τα δείγματα (256 → 4096) και μειώνει
 * αντίστοιχα το πλάτος του κουτιού, με κόστος **16 KB** RGBA και ένα `getImageData` — πρακτικά
 * μηδέν. Πλήρης εξάλειψη θα απαιτούσε decode σε πλήρη ανάλυση (μια υφή 4096² = **67 MB** ανά
 * υλικό, σε import με δεκάδες υλικά) — δυσανάλογο για μία τιμή swatch, οπότε **δεν** γίνεται.
 * Το υπόλοιπο σφάλμα είναι ορατό μόνο σε υφές με ακραία τοπική αντίθεση (σκακιέρα), όπου καμία
 * μονή τιμή δεν είναι έτσι κι αλλιώς «σωστή».
 */
const SAMPLE_SIZE = 64;

/**
 * Κάτω όριο alpha κάτω από το οποίο ένα pixel αγνοείται **εντελώς**: πρακτικά αόρατο, και το RGB
 * του δεν είναι χρώμα αλλά ό,τι έτυχε να αφήσει ο encoder. Πάνω από αυτό, το alpha μετράει ως
 * **βάρος** (δεν υπάρχει δεύτερο κατώφλι — βλ. {@link averageOpaqueLinearRgb}).
 */
const MIN_ALPHA = 8;

/**
 * Ο **alpha-weighted** μέσος όρος σε **γραμμικό** φως (0..1 ανά κανάλι)· `null` όταν κανένα pixel
 * δεν έχει ορατό alpha (ολικά διάφανη εικόνα).
 */
function averageOpaqueLinearRgb(data: Uint8ClampedArray): readonly [number, number, number] | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < MIN_ALPHA) continue;
    const w = alpha / 255;
    r += srgbToLinearUnit(data[i] / 255) * w;
    g += srgbToLinearUnit(data[i + 1] / 255) * w;
    b += srgbToLinearUnit(data[i + 2] / 255) * w;
    weight += w;
  }
  if (weight === 0) return null;
  return [r / weight, g / weight, b / weight];
}

/**
 * **Ο καθαρός πυρήνας (ADR-694 Φ7)** — RGBA pixels (όπως τα δίνει το `getImageData().data`) →
 * αντιπροσωπευτικό `#rrggbb`, ή `null` αν όλα τα pixels είναι διάφανα.
 *
 * Χωρίς DOM, χωρίς I/O, ντετερμινιστικό: εδώ ζει ΟΛΟ το χρωματομετρικό συμβόλαιο (gamma-correct
 * μέσος όρος + alpha weighting) και εδώ ελέγχεται με jest.
 */
export function averageColorHexOfPixels(data: Uint8ClampedArray): string | null {
  const linear = averageOpaqueLinearRgb(data);
  if (!linear) return null;
  // Επιστροφή στον χώρο που περιμένει το UI (CSS hex = sRGB) μέσω του SSoT της μεταφοράς,
  // και μετά μόνο αλλαγή μονάδας (0..1 → hex) μέσω του SSoT του hex.
  return rgbUnitToHex(linear.map(linearToSrgbUnit));
}

/**
 * Το αντιπροσωπευτικό `#rrggbb` μιας εικόνας-υφής, ή `null` όταν δεν μπορεί να υπολογιστεί
 * (κατεστραμμένα bytes, headless περιβάλλον χωρίς `OffscreenCanvas`, ολικά διάφανη εικόνα).
 *
 * **Ποτέ δεν πετά:** ο καλών το χρησιμοποιεί ως *βελτίωση*· η αποτυχία σημαίνει απλώς ότι το
 * υλικό μένει χωρίς `appearance` — ακριβώς η προηγούμενη συμπεριφορά, καμία παλινδρόμηση.
 */
export async function averageColorHexOfImage(image: Blob): Promise<string | null> {
  try {
    if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') return null;
    const bitmap = await createImageBitmap(image);
    try {
      const canvas = new OffscreenCanvas(SAMPLE_SIZE, SAMPLE_SIZE);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      return averageColorHexOfPixels(ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}
