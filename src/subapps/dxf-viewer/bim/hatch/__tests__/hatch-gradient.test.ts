/**
 * Hatch Gradient SSoT — ADR-507 Φ5.
 */

import { describe, it, expect } from '@jest/globals';
import {
  normalizeGradientType, isRadialGradientType, applyTint, resolveGradientStops,
  type HatchGradient,
} from '../hatch-gradient';

describe('hatch-gradient', () => {
  it('normalizeGradientType — case-insensitive + fallback linear', () => {
    expect(normalizeGradientType('SPHERICAL')).toBe('spherical');
    expect(normalizeGradientType('Linear')).toBe('linear');
    expect(normalizeGradientType('UNKNOWN_X')).toBe('linear');
    expect(normalizeGradientType(undefined)).toBe('linear');
  });

  it('isRadialGradientType — μόνο spherical/invspherical/hemispherical/curved', () => {
    expect(isRadialGradientType('spherical')).toBe(true);
    expect(isRadialGradientType('hemispherical')).toBe(true);
    expect(isRadialGradientType('curved')).toBe(true);
    expect(isRadialGradientType('invspherical')).toBe(true);
    expect(isRadialGradientType('linear')).toBe(false);
    expect(isRadialGradientType('cylinder')).toBe(false);
  });

  it('applyTint — tint=1 → ίδιο χρώμα, tint=0 → λευκό', () => {
    expect(applyTint('#FF0000', 1)).toBe('#FF0000');
    expect(applyTint('#FF0000', 0)).toBe('#FFFFFF');
  });

  it('resolveGradientStops — two-color linear → 2 stops', () => {
    const g: HatchGradient = { type: 'linear', color1: '#FF0000', color2: '#0000FF' };
    const stops = resolveGradientStops(g);
    expect(stops).toEqual([
      { offset: 0, color: '#FF0000' }, { offset: 1, color: '#0000FF' },
    ]);
  });

  it('resolveGradientStops — invcylinder → ανεστραμμένα symmetric stops', () => {
    const g: HatchGradient = { type: 'invcylinder', color1: '#FF0000', color2: '#0000FF' };
    const stops = resolveGradientStops(g);
    expect(stops.map((s) => s.color)).toEqual(['#0000FF', '#FF0000', '#0000FF']);
  });

  it('resolveGradientStops — invspherical → c2→c1', () => {
    const g: HatchGradient = { type: 'invspherical', color1: '#FF0000', color2: '#0000FF' };
    expect(resolveGradientStops(g).map((s) => s.color)).toEqual(['#0000FF', '#FF0000']);
  });

  it('resolveGradientStops — single-color → c1 → tinted(c1)', () => {
    const g: HatchGradient = { type: 'linear', color1: '#FF0000', singleColor: true, tint: 0 };
    const stops = resolveGradientStops(g);
    expect(stops[0].color).toBe('#FF0000');
    expect(stops[1].color).toBe('#FFFFFF'); // tint=0 → λευκό
  });
});
