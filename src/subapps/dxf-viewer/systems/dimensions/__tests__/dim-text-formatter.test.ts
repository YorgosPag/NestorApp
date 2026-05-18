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
  composeFullDimText,
} from '../dim-text-formatter';
import type { DimStyle } from '../../../types/dimension';
import { ISO_129_TEMPLATE } from '../dim-style-templates';

// ──────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeStyle(overrides: Partial<DimStyle> = {}): DimStyle {
  return { ...ISO_129_TEMPLATE, ...overrides };
}

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
