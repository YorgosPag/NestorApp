/**
 * ADR-507 Φ5 UI — tests για το gradient build SSoT (build helper + immutable patch).
 */

import {
  buildGradientFromDefaults,
  withGradientPatch,
  DEFAULT_GRADIENT_DEFAULTS,
  type GradientDefaults,
} from '../hatch-gradient-build';
import type { HatchGradient } from '../hatch-gradient';

const TWO_COLOR: GradientDefaults = {
  gradientType: 'linear',
  gradientColor1: '#2980b9',
  gradientColor2: '#ffffff',
  gradientSingleColor: false,
  gradientAngle: 0,
  gradientShift: 0,
};

describe('buildGradientFromDefaults', () => {
  it('builds a two-color gradient with trimmed neutral fields', () => {
    const g = buildGradientFromDefaults(TWO_COLOR);
    expect(g.type).toBe('linear');
    expect(g.color1).toBe('#2980b9');
    expect(g.color2).toBe('#ffffff');
    // angle 0 + non-single → παραλείπονται (neutral).
    expect(g.angleDeg).toBeUndefined();
    expect(g.singleColor).toBeUndefined();
  });

  it('omits color2 + keeps singleColor when single-color', () => {
    const g = buildGradientFromDefaults({ ...TWO_COLOR, gradientSingleColor: true });
    expect(g.singleColor).toBe(true);
    expect(g.color2).toBeUndefined();
    expect(g.color1).toBe('#2980b9');
  });

  it('keeps a non-zero angle', () => {
    const g = buildGradientFromDefaults({ ...TWO_COLOR, gradientAngle: 45 });
    expect(g.angleDeg).toBe(45);
  });

  it('DEFAULT_GRADIENT_DEFAULTS is a linear blue→white two-color', () => {
    const g = buildGradientFromDefaults(DEFAULT_GRADIENT_DEFAULTS);
    expect(g.type).toBe('linear');
    expect(g.color1).toBe('#2980b9');
    expect(g.color2).toBe('#ffffff');
  });
});

describe('withGradientPatch', () => {
  it('rebuilds the whole gradient immutably (does not mutate current)', () => {
    const current: HatchGradient = { type: 'linear', color1: '#2980b9', color2: '#ffffff' };
    const next = withGradientPatch(current, TWO_COLOR, { field: 'type', value: 'spherical' });
    expect(next).not.toBe(current);
    expect(current.type).toBe('linear'); // αμετάβλητο
    expect(next.type).toBe('spherical');
    expect(next.color1).toBe('#2980b9');
    expect(next.color2).toBe('#ffffff');
  });

  it('changing color1 keeps the other fields', () => {
    const current: HatchGradient = { type: 'cylinder', color1: '#2980b9', color2: '#c0392b' };
    const next = withGradientPatch(current, TWO_COLOR, { field: 'color1', value: '#27ae60' });
    expect(next.color1).toBe('#27ae60');
    expect(next.color2).toBe('#c0392b');
    expect(next.type).toBe('cylinder');
  });

  it('recovers color2 from defaults when toggling single-color OFF on a trimmed entity', () => {
    // entity stored as single-color → color2 undefined (trimmed).
    const single: HatchGradient = { type: 'linear', color1: '#2980b9', singleColor: true };
    const next = withGradientPatch(single, TWO_COLOR, { field: 'singleColor', value: false });
    expect(next.singleColor).toBeUndefined();
    // color2 ανακτήθηκε από τα defaults (όχι χαμένο).
    expect(next.color2).toBe('#ffffff');
  });

  it('falls back to defaults when current gradient is undefined', () => {
    const next = withGradientPatch(undefined, TWO_COLOR, { field: 'color2', value: '#000000' });
    expect(next.type).toBe('linear');
    expect(next.color1).toBe('#2980b9');
    expect(next.color2).toBe('#000000');
  });

  it('updates the angle', () => {
    const current: HatchGradient = { type: 'linear', color1: '#2980b9', color2: '#ffffff' };
    const next = withGradientPatch(current, TWO_COLOR, { field: 'angleDeg', value: 90 });
    expect(next.angleDeg).toBe(90);
  });

  it('updates the shift and trims it when zero', () => {
    const current: HatchGradient = { type: 'linear', color1: '#2980b9', color2: '#ffffff' };
    const shifted = withGradientPatch(current, TWO_COLOR, { field: 'shift', value: 0.5 });
    expect(shifted.shift).toBe(0.5);
    // shift 0 → neutral → παραλείπεται (trimmed).
    const reset = withGradientPatch(shifted, TWO_COLOR, { field: 'shift', value: 0 });
    expect(reset.shift).toBeUndefined();
  });
});
