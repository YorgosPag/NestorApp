/**
 * ADR-362 Phase G2 — dim-text-formatter unit tests.
 *
 * Covers composeFullDimText (new in G2) plus regression coverage for
 * the existing formatToleranceText / formatLimitsText / composePrimaryText.
 */

import {
  composePrimaryText,
  formatToleranceText,
  formatLimitsText,
  formatAlternateUnit,
  composeFullDimText,
  formatLinearMeasurement,
} from '../dim-text-formatter';
import type { DimStyle } from '../../../types/dimension';
import { ISO_129_TEMPLATE } from '../dim-style-templates';
import { displayUnitState } from '../../../config/display-unit-state';

// ADR-362 R15 — formatLinearMeasurement converts mm → the live display unit first.
// These tests assert the DXF formatting pipeline in mm-space, so pin the unit to
// 'mm' (toDisplay is then identity) to keep the expected values unit-agnostic.
beforeEach(() => displayUnitState.setUnit('mm'));

// ──────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeStyle(overrides: Partial<DimStyle> = {}): DimStyle {
  return { ...ISO_129_TEMPLATE, ...overrides };
}

// ──────────────────────────────────────────────────────────────────────────────
// formatAlternateUnit (Phase G3)
// ──────────────────────────────────────────────────────────────────────────────

describe('formatLinearMeasurement — display-unit SSoT (ADR-362 R15)', () => {
  const decimalStyle = makeStyle({ dimlfac: 1, dimrnd: 0, dimlunit: 'decimal', dimdec: 2, dimdsep: ',', dimpost: '' });

  it('renders a canonical-mm measurement in METRES (Giorgio fix): 8808.57mm → "8,81"', () => {
    expect(formatLinearMeasurement(8808.57, decimalStyle, 'm')).toBe('8,81');
  });

  it('same measurement in mm view is unchanged (identity conversion)', () => {
    expect(formatLinearMeasurement(8808.57, decimalStyle, 'mm')).toBe('8808,57');
  });

  it('cm view converts ÷10', () => {
    expect(formatLinearMeasurement(8808.57, decimalStyle, 'cm')).toBe('880,86');
  });

  it('DIMPOST suffix still applied after the unit conversion', () => {
    expect(formatLinearMeasurement(8808.57, makeStyle({ ...decimalStyle, dimpost: '[] m' }), 'm')).toBe('8,81 m');
  });
});

describe('formatAlternateUnit', () => {
  it('returns null when dimalt=false', () => {
    expect(formatAlternateUnit(100, makeStyle({ dimalt: false }))).toBeNull();
  });

  it('returns value wrapped in [...] when dimalt=true', () => {
    const style = makeStyle({
      dimalt: true,
      dimaltf: 25.4,
      dimaltrnd: 0,
      dimaltu: 'decimal',
      dimaltd: 2,
      dimdsep: '.',
      dimapost: '',
    });
    const result = formatAlternateUnit(1, style);
    // 1mm × 25.4 = 25.4 inches → "[25.40]"
    expect(result).toBe('[25.40]');
  });

  it('applies dimapost suffix inside brackets', () => {
    const style = makeStyle({
      dimalt: true,
      dimaltf: 1,
      dimaltrnd: 0,
      dimaltu: 'decimal',
      dimaltd: 0,
      dimdsep: '.',
      dimapost: '[]in',
    });
    const result = formatAlternateUnit(100, style);
    expect(result).toBe('[100in]');
  });

  it('respects dimaltrnd rounding', () => {
    const style = makeStyle({
      dimalt: true,
      dimaltf: 1,
      dimaltrnd: 5,
      dimaltu: 'decimal',
      dimaltd: 0,
      dimdsep: '.',
      dimapost: '',
    });
    const result = formatAlternateUnit(13, style);
    // 13 rounded to nearest 5 = 15
    expect(result).toBe('[15]');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// formatToleranceText (regression)
// ──────────────────────────────────────────────────────────────────────────────

describe('formatToleranceText', () => {
  it('returns null when dimtol=false', () => {
    expect(formatToleranceText(makeStyle({ dimtol: false }))).toBeNull();
  });

  it('returns +/− strings when dimtol=true', () => {
    const result = formatToleranceText(
      makeStyle({ dimtol: true, dimtp: 0.1, dimtm: -0.05, dimtdec: 2, dimdsep: '.' }),
    );
    expect(result).not.toBeNull();
    expect(result?.plus).toBe('+0.10');
    expect(result?.minus).toBe('-0.05');
  });

  it('uses absolute value of dimtm (stored negative)', () => {
    const result = formatToleranceText(
      makeStyle({ dimtol: true, dimtp: 0.2, dimtm: -0.2, dimtdec: 1, dimdsep: '.' }),
    );
    expect(result?.minus).toBe('-0.2');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// formatLimitsText (regression)
// ──────────────────────────────────────────────────────────────────────────────

describe('formatLimitsText', () => {
  it('returns null when dimlim=false', () => {
    expect(formatLimitsText(100, makeStyle({ dimlim: false }))).toBeNull();
  });

  it('upper = measurement + dimtp, lower = measurement + dimtm', () => {
    const style = makeStyle({
      dimlim: true,
      dimtp: 0.5,
      dimtm: -0.3,
      dimlfac: 1,
      dimrnd: 0,
      dimlunit: 'decimal',
      dimdec: 2,
      dimdsep: '.',
      dimpost: '',
    });
    const result = formatLimitsText(10, style);
    expect(result?.upper).toBe('10.50');
    expect(result?.lower).toBe('9.70');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// composeFullDimText — no tolerance/limits
// ──────────────────────────────────────────────────────────────────────────────

describe('composeFullDimText — plain (no tolerance/limits)', () => {
  it('returns only primary when dimtol=false and dimlim=false', () => {
    const style = makeStyle({ dimtol: false, dimlim: false });
    const result = composeFullDimText(100, style);
    expect(result.primary).toBe(composePrimaryText(100, style));
    expect(result.tolerancePlus).toBeUndefined();
    expect(result.toleranceMinus).toBeUndefined();
    expect(result.limitsUpper).toBeUndefined();
    expect(result.limitsLower).toBeUndefined();
  });

  it('empty userText propagates to primary=""', () => {
    const result = composeFullDimText(100, makeStyle(), '');
    expect(result.primary).toBe('');
    expect(result.tolerancePlus).toBeUndefined();
  });

  it('custom userText with <> token substituted in primary', () => {
    const style = makeStyle({
      dimtol: false, dimlim: false,
      dimlfac: 1, dimrnd: 0, dimlunit: 'decimal', dimdec: 0, dimdsep: '.', dimpost: '',
    });
    const result = composeFullDimText(50, style, 'L=<>mm');
    expect(result.primary).toBe('L=50mm');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// composeFullDimText — tolerance mode (DIMTOL=true)
// ──────────────────────────────────────────────────────────────────────────────

describe('composeFullDimText — tolerance mode', () => {
  it('populates tolerancePlus and toleranceMinus when dimtol=true', () => {
    const style = makeStyle({
      dimtol: true, dimlim: false,
      dimtp: 0.1, dimtm: -0.05, dimtdec: 2, dimdsep: '.',
    });
    const result = composeFullDimText(100, style);
    expect(result.tolerancePlus).toBe('+0.10');
    expect(result.toleranceMinus).toBe('-0.05');
    expect(result.limitsUpper).toBeUndefined();
    expect(result.limitsLower).toBeUndefined();
  });

  it('primary is still the formatted measurement with dimtol=true', () => {
    const style = makeStyle({
      dimtol: true, dimlim: false, dimtp: 0.05, dimtm: -0.05, dimtdec: 2,
      dimlfac: 1, dimrnd: 0, dimlunit: 'decimal', dimdec: 2, dimdsep: '.', dimpost: '',
    });
    const result = composeFullDimText(25, style);
    expect(result.primary).toBe('25.00');
  });

  it('symmetric tolerance (plus=minus) both present', () => {
    const style = makeStyle({
      dimtol: true, dimlim: false, dimtp: 0.05, dimtm: -0.05, dimtdec: 2, dimdsep: '.',
    });
    const result = composeFullDimText(100, style);
    expect(result.tolerancePlus).toBe('+0.05');
    expect(result.toleranceMinus).toBe('-0.05');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// composeFullDimText — limits mode (DIMLIM=true)
// ──────────────────────────────────────────────────────────────────────────────

describe('composeFullDimText — limits mode', () => {
  it('populates limitsUpper and limitsLower when dimlim=true', () => {
    const style = makeStyle({
      dimlim: true, dimtol: false,
      dimtp: 0.5, dimtm: -0.3,
      dimlfac: 1, dimrnd: 0, dimlunit: 'decimal', dimdec: 2, dimdsep: '.', dimpost: '',
    });
    const result = composeFullDimText(10, style);
    expect(result.limitsUpper).toBe('10.50');
    expect(result.limitsLower).toBe('9.70');
    expect(result.tolerancePlus).toBeUndefined();
    expect(result.toleranceMinus).toBeUndefined();
  });

  it('DIMLIM overrides DIMTOL when both true', () => {
    const style = makeStyle({
      dimlim: true, dimtol: true,
      dimtp: 0.1, dimtm: -0.1, dimtdec: 2,
      dimlfac: 1, dimrnd: 0, dimlunit: 'decimal', dimdec: 2, dimdsep: '.', dimpost: '',
    });
    const result = composeFullDimText(20, style);
    expect(result.limitsUpper).toBeDefined();
    expect(result.limitsLower).toBeDefined();
    expect(result.tolerancePlus).toBeUndefined();
    expect(result.toleranceMinus).toBeUndefined();
  });

  it('primary is present even in limits mode (renderer ignores it)', () => {
    const style = makeStyle({
      dimlim: true, dimtol: false, dimtp: 1, dimtm: -1,
      dimlfac: 1, dimrnd: 0, dimlunit: 'decimal', dimdec: 0, dimdsep: '.', dimpost: '',
    });
    const result = composeFullDimText(10, style);
    expect(result.primary).toBeDefined();
  });
});
