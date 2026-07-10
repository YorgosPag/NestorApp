/**
 * ADR-509 — color-math SSoT + background-adaptive entity color resolver.
 */

import {
  parseHex,
  rgbToHex,
  contrastRatio,
  luminance601,
  mixHex,
  parseColor,
  rgbaString,
  compositeOverHex,
} from '../color-math';
import {
  adaptColorToBackground,
  adaptEntityColorForCanvas,
  adaptFillTintForCanvas,
  adaptStructuralLineColorForCanvas,
  _clearAdaptiveColorCache,
  MIN_ENTITY_CONTRAST,
  MIN_FILL_CONTRAST,
  FILL_BOOST_MAX_ALPHA,
} from '../adaptive-entity-color';

describe('color-math', () => {
  it('parseHex — 6-digit, 3-digit, invalid', () => {
    expect(parseHex('#2b2f36')).toEqual({ r: 0x2b, g: 0x2f, b: 0x36 });
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('nope')).toBeNull();
  });

  it('rgbToHex round-trips', () => {
    expect(rgbToHex({ r: 43, g: 47, b: 54 })).toBe('#2b2f36');
  });

  it('contrastRatio — black/white = 21, identical = 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5);
    expect(contrastRatio('zzz', '#000')).toBe(1); // 'zzz' = invalid hex → null → 1
  });

  it('luminance601 — black 0, white 1', () => {
    expect(luminance601({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(luminance601({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });

  it('mixHex — endpoints + midpoint', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('parseColor — hex / rgb / rgba / invalid', () => {
    expect(parseColor('#2b2f36')).toEqual({ r: 0x2b, g: 0x2f, b: 0x36, a: 1 });
    expect(parseColor('rgb(120, 144, 156)')).toEqual({ r: 120, g: 144, b: 156, a: 1 });
    expect(parseColor('rgba(120, 144, 156, 0.18)')).toEqual({ r: 120, g: 144, b: 156, a: 0.18 });
    expect(parseColor('nope')).toBeNull();
  });

  it('rgbaString — round-trips channels + alpha (clamped)', () => {
    expect(rgbaString({ r: 120, g: 144, b: 156, a: 0.18 })).toBe('rgba(120, 144, 156, 0.18)');
    expect(rgbaString({ r: 300, g: -5, b: 156.6, a: 2 })).toBe('rgba(255, 0, 157, 1)');
  });

  it('compositeOverHex — alpha-over reuse mixHex (a=0 → bg, a=1 → fg)', () => {
    expect(compositeOverHex({ r: 255, g: 255, b: 255, a: 0 }, '#000000')).toBe('#000000');
    expect(compositeOverHex({ r: 255, g: 255, b: 255, a: 1 }, '#000000')).toBe('#ffffff');
    // 50% white over black → mid grey
    expect(compositeOverHex({ r: 255, g: 255, b: 255, a: 0.5 }, '#000000')).toBe('#808080');
  });
});

describe('adaptFillTintForCanvas (Revit-grade poché)', () => {
  const BLACK = '#000000';
  const WHITE = '#ffffff';

  it('wall body fill rgba(120,144,156,0.18) σε ΜΑΥΡΟ → boost (composited ορατό γκρι)', () => {
    const out = adaptFillTintForCanvas('rgba(120, 144, 156, 0.18)', BLACK);
    expect(out).not.toBe('rgba(120, 144, 156, 0.18)');
    const c = parseColor(out);
    expect(c).not.toBeNull();
    // διατηρεί translucency — ΟΧΙ opaque
    expect(c!.a).toBeLessThanOrEqual(FILL_BOOST_MAX_ALPHA + 1e-9);
    expect(c!.a).toBeGreaterThan(0);
    // το composited σώμα φτάνει το κατώφλι ορατότητας
    expect(contrastRatio(compositeOverHex(c!, BLACK), BLACK)).toBeGreaterThanOrEqual(MIN_FILL_CONTRAST - 0.05);
  });

  it('ίδιο tint σε ΛΕΥΚΟ φόντο → σκουραίνει (προς μαύρο endpoint)', () => {
    const out = adaptFillTintForCanvas('rgba(120, 144, 156, 0.18)', WHITE);
    const c = parseColor(out);
    expect(c).not.toBeNull();
    // composited πρέπει να ξεχωρίζει από το λευκό
    expect(contrastRatio(compositeOverHex(c!, WHITE), WHITE)).toBeGreaterThanOrEqual(MIN_FILL_CONTRAST - 0.05);
  });

  it('ήδη ορατό tint → ΑΥΤΟΥΣΙΟ (κρατά translucency + hue)', () => {
    // αρκετά αδιαφανές ανοιχτό tint σε μαύρο → composited ήδη ≥ κατώφλι
    const input = 'rgba(180, 190, 200, 0.7)';
    if (contrastRatio(compositeOverHex(parseColor(input)!, BLACK), BLACK) >= MIN_FILL_CONTRAST) {
      expect(adaptFillTintForCanvas(input, BLACK)).toBe(input);
    }
  });

  it('hue preservation — slate παραμένει μπλε-ίσκιος (b ≥ r) μετά το boost σε μαύρο', () => {
    const c = parseColor(adaptFillTintForCanvas('rgba(120, 144, 156, 0.18)', BLACK))!;
    expect(c.b).toBeGreaterThanOrEqual(c.r);
  });

  it('άκυρο input → αυτούσιο (no throw)', () => {
    expect(adaptFillTintForCanvas('not-a-color', BLACK)).toBe('not-a-color');
  });

  it('idempotent-ish — re-adapt του αποτελέσματος δεν μειώνει contrast κάτω από το κατώφλι', () => {
    const once = adaptFillTintForCanvas('rgba(120, 144, 156, 0.18)', BLACK);
    const twice = adaptFillTintForCanvas(once, BLACK);
    const c = parseColor(twice)!;
    expect(contrastRatio(compositeOverHex(c, BLACK), BLACK)).toBeGreaterThanOrEqual(MIN_FILL_CONTRAST - 0.05);
  });
});

describe('adaptColorToBackground', () => {
  const BLACK = '#000000';
  const WHITE = '#ffffff';

  it('near-black wall #2b2f36 on black → ΠΡΟΣΑΡΜΟΖΕΤΑΙ (γίνεται ορατό)', () => {
    const out = adaptColorToBackground('#2b2f36', BLACK);
    expect(out).not.toBe('#2b2f36');
    expect(contrastRatio(out, BLACK)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST - 0.05);
  });

  it('amber beam #b07d1f on black → ΑΥΤΟΥΣΙΟ (ήδη ορατό)', () => {
    expect(adaptColorToBackground('#b07d1f', BLACK)).toBe('#b07d1f');
  });

  it('steel-blue column #2f6690 on black → ΑΥΤΟΥΣΙΟ (contrast ≥ 3)', () => {
    expect(adaptColorToBackground('#2f6690', BLACK)).toBe('#2f6690');
  });

  it('white on black → ΑΥΤΟΥΣΙΟ (max contrast)', () => {
    expect(adaptColorToBackground(WHITE, BLACK)).toBe(WHITE);
  });

  it('near-white on WHITE bg → ΠΡΟΣΑΡΜΟΖΕΤΑΙ (σκουραίνει)', () => {
    const out = adaptColorToBackground('#f2f2f2', WHITE);
    expect(out).not.toBe('#f2f2f2');
    expect(contrastRatio(out, WHITE)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST - 0.05);
  });

  it('idempotent — προσαρμοσμένο χρώμα δεν ξαναλλάζει', () => {
    const once = adaptColorToBackground('#2b2f36', BLACK);
    expect(adaptColorToBackground(once, BLACK)).toBe(once);
  });

  // ADR-531 Φ5b.6 — Τέκτων hatch: χλωμό πράσινο <color>C0DCC0 πάνω σε λευκό <raster_bgcolor>
  // FFFFFF = 1.47:1 (αόρατο). Ο HatchRenderer προσαρμόζει το χρώμα γραμμών ενάντια στο ΦΟΝΤΟ →
  // ορατό ΚΑΙ πράσινο (hue-safe): σκουραίνει, το πράσινο κανάλι μένει κυρίαρχο.
  it('Τέκτων hatch χλωμό πράσινο #C0DCC0 σε λευκό → ορατό + παραμένει πράσινο', () => {
    const out = adaptColorToBackground('#C0DCC0', WHITE, MIN_ENTITY_CONTRAST);
    expect(out).not.toBe('#C0DCC0');
    expect(contrastRatio(out, WHITE)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST - 0.05);
    const rgb = parseHex(out);
    expect(rgb).not.toBeNull();
    if (rgb) expect(rgb.g).toBeGreaterThan(Math.max(rgb.r, rgb.b)); // hue-safe: πράσινο κυρίαρχο
  });

  it('άκυρο input → αυτούσιο (no throw)', () => {
    expect(adaptColorToBackground('zzz', BLACK)).toBe('zzz');
  });
});

describe('adaptEntityColorForCanvas (live bg = #000000 σε test/jsdom)', () => {
  beforeEach(() => _clearAdaptiveColorCache());

  it('near-black τοίχος προσαρμόζεται στο default μαύρο canvas', () => {
    const out = adaptEntityColorForCanvas('#2b2f36');
    expect(out).not.toBe('#2b2f36');
  });

  it('cache — δεύτερη κλήση ίδιο αποτέλεσμα', () => {
    const a = adaptEntityColorForCanvas('#2b2f36');
    const b = adaptEntityColorForCanvas('#2b2f36');
    expect(a).toBe(b);
  });

  it('minContrast param (WALL_LINE_CONTRAST) → πιο φωτεινό από το default', () => {
    const standard = adaptEntityColorForCanvas('#2b2f36');
    const brighter = adaptEntityColorForCanvas('#2b2f36', 4.5);
    expect(brighter).not.toBe(standard);
    expect(contrastRatio(brighter, '#000000')).toBeGreaterThan(contrastRatio(standard, '#000000'));
    expect(contrastRatio(brighter, '#000000')).toBeGreaterThanOrEqual(4.5 - 0.05);
  });

  it('minContrast = διαφορετικό κλειδί cache (δεν μολύνει το default)', () => {
    const def = adaptEntityColorForCanvas('#2b2f36');
    adaptEntityColorForCanvas('#2b2f36', 4.5);
    expect(adaptEntityColorForCanvas('#2b2f36')).toBe(def);
  });
});

describe('adaptStructuralLineColorForCanvas (φωτεινό γκρι, hue-safe)', () => {
  beforeEach(() => _clearAdaptiveColorCache());
  const BRIGHT = 9.0;

  it('δομικό γκρι #2b2f36 → ΣΑΦΩΣ φωτεινό (πιο ανοιχτό από default 3.0)', () => {
    const out = adaptStructuralLineColorForCanvas('#2b2f36', BRIGHT);
    expect(out).toBe(adaptEntityColorForCanvas('#2b2f36', BRIGHT));
    expect(contrastRatio(out, '#000000')).toBeGreaterThan(contrastRatio(adaptEntityColorForCanvas('#2b2f36'), '#000000'));
    expect(contrastRatio(out, '#000000')).toBeGreaterThanOrEqual(BRIGHT - 0.1);
  });

  it('γκρι interior #6b7280 → ανοίγει (low saturation → bright path)', () => {
    const out = adaptStructuralLineColorForCanvas('#6b7280', BRIGHT);
    expect(out).toBe(adaptEntityColorForCanvas('#6b7280', BRIGHT));
    expect(out).not.toBe('#6b7280');
  });

  it('ΖΩΗΡΟ κόκκινο override #FF0000 → ΜΕΝΕΙ κόκκινο (ΟΧΙ ξέπλυμα προς λευκό)', () => {
    // saturation 1.0 ≥ threshold → standard path· #FF0000 contrast≈5.25 ≥ 3.0 → αυτούσιο.
    expect(adaptStructuralLineColorForCanvas('#FF0000', BRIGHT)).toBe('#FF0000');
  });

  it('non-hex (rgba) → pass-through', () => {
    expect(adaptStructuralLineColorForCanvas('rgba(1,2,3,0.5)', BRIGHT)).toBe('rgba(1,2,3,0.5)');
  });
});
