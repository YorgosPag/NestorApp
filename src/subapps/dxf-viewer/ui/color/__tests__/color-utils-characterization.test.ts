/**
 * CHARACTERIZATION tests — `ui/color/utils` (Color-Conversion SSoT consolidation).
 *
 * Κλειδώνουν την ΤΩΡΙΝΗ (pre-refactor) συμπεριφορά του color-picker superset ΠΡΙΝ
 * αυτό γίνει thin adapter πάνω στο `config/color-math`. Ο SKOPOS: μετά το Phase B
 * (extend color-math + adapters) αυτά ΠΡΕΠΕΙ να μείνουν πράσινα — αποδεικνύοντας
 * value-preserving migration (throw-contract, 8-digit alpha, rgbToHex options,
 * parseColor +HSL/HSV shape).
 *
 * ΜΗΝ «χαλαρώσεις» αυτά τα assertions για να περάσει ο refactor — αν αλλάξει έξοδος,
 * είναι regression (ή συνειδητή αλλαγή με έγκριση).
 */

import { parseHex, parseColor, rgbToHex, isValidHex, normalizeHex } from '../utils';

describe('ui/color/utils — parseHex (superset: 8-digit alpha, THROWS)', () => {
  it('6-digit → {r,g,b,a:1}', () => {
    expect(parseHex('#2b2f36')).toEqual({ r: 0x2b, g: 0x2f, b: 0x36, a: 1 });
  });

  it('3-digit shorthand expands', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it('8-digit → alpha parsed as byte/255 (SUPERSET vs color-math)', () => {
    // #RRGGBBAA — alpha 0x80 = 128/255
    const c = parseHex('#12345680');
    expect(c.r).toBe(0x12);
    expect(c.g).toBe(0x34);
    expect(c.b).toBe(0x56);
    expect(c.a).toBeCloseTo(128 / 255, 6);
  });

  it('THROWS on invalid hex (consumers rely on try/catch: aci.findClosestAci, LegacyGridAdapter)', () => {
    expect(() => parseHex('nope')).toThrow(/Invalid hex color/);
    expect(() => parseHex('#zz')).toThrow();
  });
});

describe('ui/color/utils — rgbToHex (FormatOptions: alpha/uppercase/short)', () => {
  it('default → lowercase #rrggbb, no alpha', () => {
    expect(rgbToHex({ r: 43, g: 47, b: 54 })).toBe('#2b2f36');
  });

  it('uppercase option', () => {
    expect(rgbToHex({ r: 43, g: 47, b: 54 }, { uppercase: true })).toBe('#2B2F36');
  });

  it('alpha option appends AA only when a≠1', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0, a: 0.5 }, { alpha: true })).toBe('#ff000080');
    expect(rgbToHex({ r: 255, g: 0, b: 0, a: 1 }, { alpha: true })).toBe('#ff0000');
  });

  it('short option collapses #RRGGBB → #RGB when possible', () => {
    expect(rgbToHex({ r: 255, g: 255, b: 255 }, { short: true })).toBe('#fff');
    expect(rgbToHex({ r: 43, g: 47, b: 54 }, { short: true })).toBe('#2b2f36'); // not collapsible
  });

  it('clamps out-of-range channels', () => {
    expect(rgbToHex({ r: 300, g: -5, b: 128 })).toBe('#ff0080');
  });
});

describe('ui/color/utils — parseColor (ParseResult, never throws, +HSL/HSV)', () => {
  it('valid hex → ParseResult with hex/rgb/hsl/hsv/alpha', () => {
    const res = parseColor('#ff0000');
    expect(res.valid).toBe(true);
    if (!res.valid) return;
    expect(res.color.hex).toBe('#ff0000');
    expect(res.color.rgb).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(res.color.hsl.h).toBeCloseTo(0, 5);
    expect(res.color.hsl.s).toBeCloseTo(100, 5);
    expect(res.color.hsl.l).toBeCloseTo(50, 5);
    expect(res.color.hsv.v).toBeCloseTo(100, 5);
    expect(res.color.alpha).toBe(1);
  });

  it('rgb() string → valid', () => {
    const res = parseColor('rgb(0, 128, 255)');
    expect(res.valid).toBe(true);
    if (!res.valid) return;
    expect(res.color.rgb).toMatchObject({ r: 0, g: 128, b: 255 });
  });

  it('hsl() string → valid (SUPERSET vs color-math.parseColor)', () => {
    const res = parseColor('hsl(120, 100%, 50%)');
    expect(res.valid).toBe(true);
    if (!res.valid) return;
    expect(res.color.rgb.r).toBeCloseTo(0, 0);
    expect(res.color.rgb.g).toBeCloseTo(255, 0);
    expect(res.color.rgb.b).toBeCloseTo(0, 0);
  });

  it('invalid → {valid:false, error} (never throws)', () => {
    const res = parseColor('banana');
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(typeof res.error).toBe('string');
  });
});

describe('ui/color/utils — isValidHex / normalizeHex', () => {
  it('isValidHex: 3/6/8-digit ok, others no', () => {
    expect(isValidHex('#fff')).toBe(true);
    expect(isValidHex('#2b2f36')).toBe(true);
    expect(isValidHex('#12345680')).toBe(true);
    expect(isValidHex('nope')).toBe(false);
  });

  it('normalizeHex: valid → normalized, invalid → passthrough (no throw)', () => {
    expect(normalizeHex('#FFF')).toBe('#ffffff');
    expect(normalizeHex('nope')).toBe('nope');
  });
});
