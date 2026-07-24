/**
 * texture-average-color — ADR-691 Φ3. Το **αντιπροσωπευτικό χρώμα** μιας υφής (`#rrggbb`),
 * υπολογισμένο από τα ίδια της τα bytes.
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
 * ## Γιατί εδώ (και όχι σε pure module)
 *
 * Απαιτεί αποκωδικοποίηση εικόνας (JPEG/PNG) → browser API. Ζει δίπλα στο
 * {@link ./texture-content-hash} που είναι επίσης browser-only (Web Crypto), και **injectάρεται**
 * στον καθαρό orchestrator ώστε εκείνος να μένει testable χωρίς DOM.
 *
 * **Μηδέν dependency (N.5):** `createImageBitmap` + `OffscreenCanvas`, native και τα δύο.
 *
 * @see ./import-embedded-materials — ο καταναλωτής (γράφει το αποτέλεσμα στο `appearance`)
 * @see ./texture-content-hash — ο αδελφός browser-only helper (ίδιο μοτίβο DI)
 * @see docs/centralized-systems/reference/adrs/ADR-691-imported-mesh-embedded-material-extraction.md
 */

import { rgbUnitToHex } from './rgb-unit-hex';

/**
 * Πλευρά του καμβά υποδειγματοληψίας. Δεν χρειάζεται η πλήρης ανάλυση: ο μέσος όρος 16×16
 * (=256 δείγματα, με το ίδιο το GPU/canvas filtering να κάνει τη σμίκρυνση) είναι οπτικά
 * ταυτόσημος με τον μέσο όρο 1024×1024, σε κλάσμα του χρόνου/μνήμης.
 */
const SAMPLE_SIZE = 16;

/**
 * Κάτω όριο alpha ώστε ένα διάφανο pixel να μη «βάφει» τον μέσο όρο. Μια υφή φύλλου με
 * διάφανο φόντο (πολύ συνηθισμένο σε βλάστηση) αλλιώς θα έβγαινε ξεπλυμένη προς το μαύρο.
 */
const MIN_ALPHA = 8;

/** Ο μέσος όρος των **αδιαφανών** pixel, σε 0..1 ανά κανάλι· `null` όταν όλα είναι διάφανα. */
function averageOpaqueRgb(data: Uint8ClampedArray): readonly [number, number, number] | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < MIN_ALPHA) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count += 1;
  }
  if (count === 0) return null;
  const scale = 1 / (count * 255);
  return [r * scale, g * scale, b * scale];
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
      const rgb = averageOpaqueRgb(ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
      // Τα bytes της εικόνας είναι ήδη sRGB (όπως τα βλέπει ο χρήστης) — καμία μετατροπή
      // χώρου εδώ· μόνο η μονάδα (0..1 → hex) μέσω του SSoT.
      return rgb ? rgbUnitToHex(rgb) : null;
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}
