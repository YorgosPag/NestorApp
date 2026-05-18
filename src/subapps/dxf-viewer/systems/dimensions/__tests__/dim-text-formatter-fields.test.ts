/**
 * ADR-362 Phase O3 — dim-text-formatter field-token passthrough tests.
 *
 * `composePrimaryText` does NOT evaluate field tokens (e.g. `<measurement>`,
 * `<length>`, `<area>`). Evaluation lives in `dim-text-field-evaluator.ts`
 * (Phase N2+N3). The formatter only substitutes the `<>` placeholder; all
 * other tokens pass through verbatim. These tests pin that contract.
 *
 * Additional edge-case coverage for `composeFullDimText` (zero measurement,
 * negative value, field token with active tolerance).
 */

import { composePrimaryText, composeFullDimText } from '../dim-text-formatter';
import type { DimStyle } from '../../../types/dimension';
import { ISO_129_TEMPLATE } from '../dim-style-templates';

function makeStyle(overrides: Partial<DimStyle> = {}): DimStyle {
  return {
    ...ISO_129_TEMPLATE,
    dimlfac: 1,
    dimrnd: 0,
    dimlunit: 'decimal',
    dimdec: 2,
    dimdsep: '.',
    dimpost: '',
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// composePrimaryText — field token passthrough
// ──────────────────────────────────────────────────────────────────────────────

describe('composePrimaryText — field token passthrough', () => {
  it('<measurement> passes through verbatim (not a <> substitution target)', () => {
    expect(composePrimaryText(100, makeStyle(), '<measurement>')).toBe('<measurement>');
  });

  it('<length> passes through verbatim', () => {
    expect(composePrimaryText(50, makeStyle(), '<length>')).toBe('<length>');
  });

  it('<area> passes through verbatim', () => {
    expect(composePrimaryText(200, makeStyle(), '<area>')).toBe('<area>');
  });

  it('<angle> passes through verbatim', () => {
    expect(composePrimaryText(90, makeStyle(), '<angle>')).toBe('<angle>');
  });

  it('<scale> passes through verbatim', () => {
    expect(composePrimaryText(10, makeStyle(), '<scale>')).toBe('<scale>');
  });

  it('<filename>, <date>, <time>, <author> pass through verbatim', () => {
    for (const token of ['<filename>', '<date>', '<time>', '<author>']) {
      expect(composePrimaryText(1, makeStyle(), token)).toBe(token);
    }
  });

  it('all 12 known field tokens listed in FIELD_TOKEN_NAMES pass through verbatim', () => {
    const tokens = [
      '<measurement>', '<length>', '<area>', '<angle>',
      '<perimeter>', '<x>', '<y>', '<scale>',
      '<filename>', '<date>', '<time>', '<author>',
    ];
    for (const token of tokens) {
      expect(composePrimaryText(10, makeStyle(), token)).toBe(token);
    }
  });

  it('<> adjacent to field token — only <> is substituted', () => {
    // "50.00<length>" — <> → measured value, <length> stays
    const result = composePrimaryText(50, makeStyle({ dimdec: 2 }), '<><length>');
    expect(result).toBe('50.00<length>');
  });

  it('prefix + <> + field token suffix', () => {
    const result = composePrimaryText(75, makeStyle({ dimdec: 2 }), 'L=<>mm <scale>');
    expect(result).toBe('L=75.00mm <scale>');
  });

  it('DIESEL expression passes through verbatim', () => {
    // DIESEL eval happens in dim-text-field-evaluator, not dim-text-formatter
    expect(composePrimaryText(100, makeStyle(), '$(+,1,2)')).toBe('$(+,1,2)');
  });

  it('nested DIESEL passes through verbatim', () => {
    expect(composePrimaryText(50, makeStyle(), '$(+,$(+,1,2),3)')).toBe('$(+,$(+,1,2),3)');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// composeFullDimText — edge cases
// ──────────────────────────────────────────────────────────────────────────────

describe('composeFullDimText — edge cases', () => {
  it('zero measurement → formatted as 0.00', () => {
    const result = composeFullDimText(0, makeStyle({ dimdec: 2 }));
    expect(result.primary).toBe('0.00');
    expect(result.tolerancePlus).toBeUndefined();
  });

  it('negative measurement → passes through formatter (edge case)', () => {
    const result = composeFullDimText(-10, makeStyle({ dimdec: 1 }));
    expect(result.primary).toBe('-10.0');
  });

  it('field token userText with tolerance — primary is token, tolerances still computed', () => {
    const style = makeStyle({
      dimtol: true,
      dimtm: -0.1,
      dimtp: 0.1,
      dimtdec: 1,
      dimdsep: '.',
    });
    const result = composeFullDimText(100, style, '<measurement>');
    expect(result.primary).toBe('<measurement>');
    expect(result.tolerancePlus).toBe('+0.1');
    expect(result.toleranceMinus).toBe('-0.1');
  });

  it('field token userText with limits — primary is token, limits still computed', () => {
    const style = makeStyle({
      dimlim: true,
      dimtol: false,
      dimtp: 0.5,
      dimtm: -0.5,
    });
    const result = composeFullDimText(10, style, '<length>');
    expect(result.primary).toBe('<length>');
    expect(result.limitsUpper).toBeDefined();
    expect(result.limitsLower).toBeDefined();
  });

  it('very large measurement → no overflow in formatting', () => {
    const result = composeFullDimText(1_000_000, makeStyle({ dimdec: 0 }));
    expect(result.primary).toBe('1000000');
  });

  it('dimlfac=0.001 scales measurement correctly', () => {
    const result = composeFullDimText(1000, makeStyle({ dimlfac: 0.001, dimdec: 2 }));
    expect(result.primary).toBe('1.00');
  });
});
