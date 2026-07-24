/**
 * color-math — sRGB transfer functions + WCAG layer (ADR-694 Φ10 test anchors).
 *
 * Δύο δουλειές κάνει αυτό το αρχείο:
 *
 * 1. **Μεταφέρει** τα anchors του πρώην `io/mesh3d-material-import/srgb-linear-unit.ts` (ADR-694 Φ7)
 *    μαζί με τον κώδικά τους στο SSoT. Κλειδώνουν ότι η μεταφορά είναι η **ακριβής** IEC 61966-2-1
 *    piecewise και όχι η προσέγγιση `pow(x, 2.2)`.
 *
 * 2. **Κλειδώνει εκτελεστικά την απόφαση του Φ10**: ότι υπάρχει **ΜΙΑ** σταθερά κατωφλίου
 *    (`0.04045`) και όχι δύο. Ο `describe` «η ενοποίηση της σταθεράς» δεν είναι διακοσμητικός —
 *    τρέχει την **παλιά** υλοποίηση δίπλα στη νέα και απαιτεί ταυτότητα. Χωρίς αυτόν, το επιχείρημα
 *    «είναι ασφαλές» θα ήταν σχόλιο· με αυτόν, είναι απόδειξη που ξανατρέχει σε κάθε commit.
 *
 * @see ../color-math.ts — το σχόλιο-φρουρός με το W3C erratum (Μάιος 2021)
 */

import {
  srgbToLinearUnit,
  linearToSrgbUnit,
  srgbRelativeLuminance,
  contrastRatio,
  contrastRatioRgb,
  parseHex,
} from '../color-math';

describe('sRGB transfer functions — ακριβής IEC 61966-2-1 (SSoT, ADR-694 Φ7α → Φ10)', () => {
  it('τα άκρα είναι ακριβή και το κατώφλι είναι το γραμμικό τμήμα, όχι pow(x,2.2)', () => {
    expect(srgbToLinearUnit(0)).toBe(0);
    expect(srgbToLinearUnit(1)).toBeCloseTo(1, 12);
    expect(linearToSrgbUnit(0)).toBe(0);
    expect(linearToSrgbUnit(1)).toBeCloseTo(1, 12);
    // sRGB 0.02 είναι στο γραμμικό τμήμα: 0.02/12.92, ΟΧΙ 0.02^2.4 (η προσέγγιση 2.2 αστοχεί εδώ).
    expect(srgbToLinearUnit(0.02)).toBeCloseTo(0.02 / 12.92, 12);
    expect(srgbToLinearUnit(0.02)).not.toBeCloseTo(0.02 ** 2.2, 6);
  });

  it('sRGB 128 = ~21.8% φως (η ρίζα ολόκληρου του Φ7)', () => {
    expect(srgbToLinearUnit(128 / 255)).toBeCloseTo(0.2159, 4);
    expect(srgbToLinearUnit(128 / 255)).toBeLessThan(0.5); // ΟΧΙ «μισό φως»
  });

  it('round-trip ταυτότητα + clamp σε ακραία/μη-έγκυρη είσοδο', () => {
    // precision 6: στο ίδιο το σημείο θραύσης (0.04045) οι δύο στρογγυλεμένες σταθερές του προτύπου
    // δεν είναι ακριβώς αντίστροφες (~3e-8) — γνωστό artifact της IEC, αδιάφορο σε 8-bit έξοδο.
    for (const v of [0, 0.001, 0.04045, 0.2, 0.5, 0.9, 1]) {
      expect(linearToSrgbUnit(srgbToLinearUnit(v))).toBeCloseTo(v, 6);
    }
    expect(srgbToLinearUnit(Number.NaN)).toBe(0);
    expect(linearToSrgbUnit(Number.NaN)).toBe(0);
    expect(srgbToLinearUnit(-5)).toBe(0);
    expect(linearToSrgbUnit(5)).toBeCloseTo(1, 12);
    expect(linearToSrgbUnit(Number.POSITIVE_INFINITY)).toBeCloseTo(1, 12);
  });
});

describe('η ενοποίηση της σταθεράς — 0.03928 → 0.04045 (ADR-694 Φ10)', () => {
  /**
   * Η **παλιά** υλοποίηση, αυτούσια όπως ζούσε σε `color-math.linearizeChannel` και
   * `useContrast.getRelativeLuminance` πριν το Φ10 — με το κατώφλι `0.03928` που το W3C απέσυρε
   * τον Μάιο 2021. Ζει **μόνο** εδώ, ως μάρτυρας σύγκρισης.
   */
  function legacyLinearizeChannel(c: number): number {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }

  /**
   * **Ο φρουρός.** Η ασφάλεια της αλλαγής δεν είναι γνώμη: για κάθε δυνατό byte καναλιού οι δύο
   * σταθερές δίνουν **ταυτόσημο** αποτέλεσμα (`toBe`, όχι `toBeCloseTo` — bit-for-bit).
   *
   * Ο λόγος είναι αριθμητικός: το byte 10 δίνει `10/255 = 0.039216`, **κάτω** κι από τα δύο
   * κατώφλια· το byte 11 δίνει `11/255 = 0.043137`, **πάνω** κι από τα δύο. Κανένα byte δεν πέφτει
   * μέσα στη ζώνη διαφωνίας `(0.03928, 0.04045]` — άρα κανένα δεν αλλάζει κλάδο.
   */
  it('για ΚΑΘΕ byte 0..255 οι δύο σταθερές είναι bit-for-bit ταυτόσημες', () => {
    for (let c = 0; c <= 255; c++) {
      expect(srgbToLinearUnit(c / 255)).toBe(legacyLinearizeChannel(c));
    }
  });

  it('κανένα byte δεν πέφτει μέσα στη ζώνη διαφωνίας (0.03928, 0.04045]', () => {
    const inBand = Array.from({ length: 256 }, (_, c) => c).filter(
      (c) => c / 255 > 0.03928 && c / 255 <= 0.04045,
    );

    expect(inBand).toEqual([]);
    // Οι δύο γείτονες που περιβάλλουν τη ζώνη, ρητά:
    expect(10 / 255).toBeLessThanOrEqual(0.03928); // γραμμικός κλάδος και στις δύο
    expect(11 / 255).toBeGreaterThan(0.04045); // εκθετικός κλάδος και στις δύο
  });

  it('το WCAG luminance μένει αναλλοίωτο σε πραγματικά χρώματα', () => {
    const legacyLuminance = (r: number, g: number, b: number): number =>
      0.2126 * legacyLinearizeChannel(r) +
      0.7152 * legacyLinearizeChannel(g) +
      0.0722 * legacyLinearizeChannel(b);

    for (const [r, g, b] of [
      [0, 0, 0], [255, 255, 255], [10, 10, 10], [11, 11, 11],
      [128, 128, 128], [232, 147, 74], [0, 51, 102], [26, 43, 60],
    ] as const) {
      expect(srgbRelativeLuminance({ r, g, b })).toBe(legacyLuminance(r, g, b));
    }
  });
});

describe('WCAG στρώμα πάνω στο EOTF (ADR-694 Φ10)', () => {
  it('γνωστές τιμές αναφοράς: μαύρο 0, λευκό 1, contrast λευκού/μαύρου 21:1', () => {
    expect(srgbRelativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(srgbRelativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 12);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
  });

  it('συμμετρικό ως προς τη σειρά των ορισμάτων (L1≥L2 πάντα)', () => {
    expect(contrastRatio('#1a2b3c', '#e8f4f8')).toBe(contrastRatio('#e8f4f8', '#1a2b3c'));
  });

  it('`contrastRatio` (hex) delegateάρει στο `contrastRatioRgb` — ένα math, δύο συμβόλαια', () => {
    const a = parseHex('#3ca03c');
    const b = parseHex('#e29032');

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(contrastRatio('#3ca03c', '#e29032')).toBe(contrastRatioRgb(a!, b!));
  });

  it('άκυρο hex → 1 (συντηρητικό «μηδέν contrast»), ενώ το Rgb μονοπάτι δεν έχει τέτοιο fallback', () => {
    expect(contrastRatio('όχι-χρώμα', '#ffffff')).toBe(1);
    // Το `contrastRatioRgb` δέχεται ήδη αναλυμένα κανάλια → ο caller κρατά το δικό του συμβόλαιο
    // σφάλματος (π.χ. το `useContrast` κάνει throw/catch → ratio 0). Βλ. ADR-694 Φ10.
    expect(contrastRatioRgb({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })).toBeCloseTo(21, 10);
  });
});
