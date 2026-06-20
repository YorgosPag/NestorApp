/**
 * ADR-509 — color-math SSoT + background-adaptive entity color resolver.
 */

import {
  parseHex,
  rgbToHex,
  contrastRatio,
  luminance601,
  mixHex,
} from '../color-math';
import {
  adaptColorToBackground,
  adaptEntityColorForCanvas,
  _clearAdaptiveColorCache,
  MIN_ENTITY_CONTRAST,
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
});
