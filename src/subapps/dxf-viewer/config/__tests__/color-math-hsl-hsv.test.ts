/**
 * color-math — 8-digit alpha + HSL/HSV SSoT (ADR-573).
 *
 * These primitives were absorbed from `ui/color/utils` so the colour-picker superset
 * lives in one module. Locks parseHexAlpha + the conversion round-trips.
 */

import {
  parseHexAlpha,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
  rgbToHex,
} from '../color-math';

describe('parseHexAlpha — 3/6/8-digit', () => {
  it('6-digit → a=1', () => {
    expect(parseHexAlpha('#2b2f36')).toEqual({ r: 0x2b, g: 0x2f, b: 0x36, a: 1 });
  });
  it('3-digit shorthand → a=1', () => {
    expect(parseHexAlpha('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });
  it('8-digit → alpha byte / 255', () => {
    const c = parseHexAlpha('#12345680');
    expect(c).not.toBeNull();
    expect(c!.a).toBeCloseTo(128 / 255, 6);
    expect([c!.r, c!.g, c!.b]).toEqual([0x12, 0x34, 0x56]);
  });
  it('invalid → null (non-throwing)', () => {
    expect(parseHexAlpha('nope')).toBeNull();
    expect(parseHexAlpha('#zzzzzz')).toBeNull();
  });
});

describe('HSL round-trips', () => {
  it('pure red', () => {
    const hsl = rgbToHsl({ r: 255, g: 0, b: 0 });
    expect(hsl.h).toBeCloseTo(0, 5);
    expect(hsl.s).toBeCloseTo(100, 5);
    expect(hsl.l).toBeCloseTo(50, 5);
  });
  it('pure green hex round-trips through HSL', () => {
    const rgb = hslToRgb(rgbToHsl({ r: 0, g: 255, b: 0 }));
    expect(rgbToHex(rgb)).toBe('#00ff00');
  });
  it('grey → s=0', () => {
    expect(rgbToHsl({ r: 128, g: 128, b: 128 }).s).toBeCloseTo(0, 5);
  });
});

describe('HSV round-trips', () => {
  it('pure blue', () => {
    const hsv = rgbToHsv({ r: 0, g: 0, b: 255 });
    expect(hsv.h).toBeCloseTo(240, 5);
    expect(hsv.s).toBeCloseTo(100, 5);
    expect(hsv.v).toBeCloseTo(100, 5);
  });
  it('arbitrary colour round-trips through HSV', () => {
    const rgb = hsvToRgb(rgbToHsv({ r: 43, g: 47, b: 54 }));
    expect(rgbToHex(rgb)).toBe('#2b2f36');
  });
  it('black → v=0', () => {
    expect(rgbToHsv({ r: 0, g: 0, b: 0 }).v).toBeCloseTo(0, 5);
  });
});
