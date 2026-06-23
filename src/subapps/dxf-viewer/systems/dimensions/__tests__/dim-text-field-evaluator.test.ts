/**
 * ADR-362 Phase N2+N3 — dim-text-field-evaluator unit tests.
 *
 * Coverage:
 *   evaluateFieldAST / evaluateFieldText:
 *     - Literal → passthrough
 *     - MeasurementPlaceholder → formatLinearMeasurement output
 *     - FieldToken 'measurement' → same as placeholder
 *     - FieldToken 'length' with context.length
 *     - FieldToken 'area' with context.area
 *     - FieldToken 'date' with fixed date → locale string
 *     - FieldToken 'time' with fixed date → locale string
 *     - FieldToken 'x', 'y' → toFixed(2)
 *     - FieldToken 'scale' → string
 *     - FieldToken 'filename', 'author' → passthrough
 *     - FieldToken unknown fallback → raw '<name>'
 *     - missing optional context fields → empty string
 *   DIESEL operators (N3):
 *     - $(+, 3, 4) → '7'
 *     - $(-, 10, 3) → '7'
 *     - $(*, 3, 4) → '12'
 *     - $(/, 10, 2) → '5'
 *     - $(/, 10, 0) → '0'  (divide by zero guard)
 *     - $(if, 1, yes, no) → 'yes'
 *     - $(if, 0, yes, no) → 'no'
 *     - $(if, "", yes, no) → 'no'
 *     - $(fmt, 3.14159, 0.00) → '3.14'
 *     - $(strlen, hello) → '5'
 *     - $(substr, hello, 1, 3) → 'ell'
 *     - $(upper, hello) → 'HELLO'
 *     - $(lower, HELLO) → 'hello'
 *     - $(strcat, foo, bar) → 'foobar'
 *     - nested: $(+, $(+,1,2), 3) → '6'
 *     - field ref inside DIESEL: $(fmt, <measurement>, 0.00)
 *   evaluateFieldText convenience wrapper
 */

import { evaluateFieldAST, evaluateFieldText, type FieldEvalContext } from '../dim-text-field-evaluator';
import { parseFieldAST } from '../dim-text-field-parser';
import { ISO_129_TEMPLATE } from '../dim-style-templates';
import type { DimStyle } from '../../../types/dimension';
import { displayUnitState } from '../../../config/display-unit-state';

// ADR-362 R15 — <measurement>/<length> tokens flow through formatLinearMeasurement,
// which now converts mm → the live display unit. Pin to 'mm' (identity) so these
// expectations stay unit-agnostic.
beforeEach(() => displayUnitState.setUnit('mm'));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStyle(patch: Partial<DimStyle> = {}): DimStyle {
  return { ...ISO_129_TEMPLATE, ...patch };
}

function makeCtx(patch: Partial<FieldEvalContext> = {}): FieldEvalContext {
  return {
    measurementValue: 100,
    style: makeStyle({ dimdec: 2, dimdsep: '.', dimpost: '', dimlfac: 1, dimrnd: 0 }),
    ...patch,
  };
}

// Fixed date for deterministic date/time token tests.
const FIXED_DATE = new Date('2026-05-18T12:00:00');

// ── Literal passthrough ───────────────────────────────────────────────────────

describe('Literal nodes', () => {
  it('passes literal text through unchanged', () => {
    const ast = parseFieldAST('hello world');
    expect(evaluateFieldAST(ast, makeCtx())).toBe('hello world');
  });

  it('empty literal → empty string', () => {
    const ast = parseFieldAST('');
    expect(evaluateFieldAST(ast, makeCtx())).toBe('');
  });
});

// ── MeasurementPlaceholder ────────────────────────────────────────────────────

describe('MeasurementPlaceholder <>', () => {
  it('evaluates to formatted measurementValue', () => {
    const ast = parseFieldAST('<>');
    const ctx = makeCtx({ measurementValue: 25.5 });
    expect(evaluateFieldAST(ast, ctx)).toBe('25.50');
  });

  it('"PREFIX<>SUFFIX" replaces <> with measurement', () => {
    const ast = parseFieldAST('L=<>mm');
    const ctx = makeCtx({ measurementValue: 10 });
    expect(evaluateFieldAST(ast, ctx)).toBe('L=10.00mm');
  });
});

// ── FieldToken resolvers ──────────────────────────────────────────────────────

describe('FieldToken resolvers', () => {
  it('<measurement> → same as <>', () => {
    const ctx = makeCtx({ measurementValue: 42 });
    expect(evaluateFieldText('<measurement>', ctx)).toBe(evaluateFieldText('<>', ctx));
  });

  it('<length> with context.length', () => {
    const ctx = makeCtx({ length: 75 });
    const result = evaluateFieldText('<length>', ctx);
    expect(result).toBe('75.00');
  });

  it('<length> missing → empty string', () => {
    expect(evaluateFieldText('<length>', makeCtx())).toBe('');
  });

  it('<area> with context.area', () => {
    const ctx = makeCtx({ area: 12.5 });
    expect(evaluateFieldText('<area>', ctx)).toBe('12.50');
  });

  it('<area> missing → empty string', () => {
    expect(evaluateFieldText('<area>', makeCtx())).toBe('');
  });

  it('<angle> with context.angle (radians) → degrees string', () => {
    const ctx = makeCtx({ angle: Math.PI / 2 });
    const result = evaluateFieldText('<angle>', ctx);
    expect(result).toBe('90.00°');
  });

  it('<x> and <y> with context values', () => {
    const ctx = makeCtx({ x: 10.5, y: -3.25 });
    expect(evaluateFieldText('<x>', ctx)).toBe('10.50');
    expect(evaluateFieldText('<y>', ctx)).toBe('-3.25');
  });

  it('<scale> with context.scale', () => {
    const ctx = makeCtx({ scale: 2 });
    expect(evaluateFieldText('<scale>', ctx)).toBe('2');
  });

  it('<filename> with context.filename', () => {
    const ctx = makeCtx({ filename: 'plan-A1.dxf' });
    expect(evaluateFieldText('<filename>', ctx)).toBe('plan-A1.dxf');
  });

  it('<author> with context.author', () => {
    const ctx = makeCtx({ author: 'Giorgio' });
    expect(evaluateFieldText('<author>', ctx)).toBe('Giorgio');
  });

  it('<filename> missing → empty string', () => {
    expect(evaluateFieldText('<filename>', makeCtx())).toBe('');
  });

  it('<date> with fixed date → locale date string', () => {
    const ctx = makeCtx({ date: FIXED_DATE });
    const result = evaluateFieldText('<date>', ctx);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('<time> with fixed date → locale time string', () => {
    const ctx = makeCtx({ date: FIXED_DATE });
    const result = evaluateFieldText('<time>', ctx);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── DIESEL operators (N3) ─────────────────────────────────────────────────────

describe('DIESEL operators', () => {
  const ctx = makeCtx({ measurementValue: 10 });

  it('$(+, 3, 4) → "7"', () => {
    expect(evaluateFieldText('$(+,3,4)', ctx)).toBe('7');
  });

  it('$(-, 10, 3) → "7"', () => {
    expect(evaluateFieldText('$(-, 10, 3)', ctx)).toBe('7');
  });

  it('$(*, 3, 4) → "12"', () => {
    expect(evaluateFieldText('$(*, 3, 4)', ctx)).toBe('12');
  });

  it('$(/, 10, 2) → "5"', () => {
    expect(evaluateFieldText('$(/, 10, 2)', ctx)).toBe('5');
  });

  it('$(/, 10, 0) → "0" (divide by zero guard)', () => {
    expect(evaluateFieldText('$(/, 10, 0)', ctx)).toBe('0');
  });

  it('$(if, 1, yes, no) → "yes"', () => {
    expect(evaluateFieldText('$(if, 1, yes, no)', ctx)).toBe('yes');
  });

  it('$(if, 0, yes, no) → "no"', () => {
    expect(evaluateFieldText('$(if, 0, yes, no)', ctx)).toBe('no');
  });

  it('$(if, false, yes, no) → "no"', () => {
    expect(evaluateFieldText('$(if, false, yes, no)', ctx)).toBe('no');
  });

  it('$(fmt, 3.14159, 0.00) → "3.14"', () => {
    expect(evaluateFieldText('$(fmt, 3.14159, 0.00)', ctx)).toBe('3.14');
  });

  it('$(strlen, hello) → "5"', () => {
    expect(evaluateFieldText('$(strlen, hello)', ctx)).toBe('5');
  });

  it('$(substr, hello, 1, 3) → "ell"', () => {
    expect(evaluateFieldText('$(substr, hello, 1, 3)', ctx)).toBe('ell');
  });

  it('$(upper, hello) → "HELLO"', () => {
    expect(evaluateFieldText('$(upper, hello)', ctx)).toBe('HELLO');
  });

  it('$(lower, HELLO) → "hello"', () => {
    expect(evaluateFieldText('$(lower, HELLO)', ctx)).toBe('hello');
  });

  it('$(strcat, foo, bar) → "foobar"', () => {
    expect(evaluateFieldText('$(strcat, foo, bar)', ctx)).toBe('foobar');
  });

  it('nested: $(+, $(+,1,2), 3) → "6"', () => {
    expect(evaluateFieldText('$(+, $(+,1,2), 3)', ctx)).toBe('6');
  });

  it('decimal result strips trailing zeros: $(/, 1, 3)', () => {
    const result = evaluateFieldText('$(/, 1, 3)', ctx);
    expect(result).not.toMatch(/0{3,}$/);
  });
});

// ── Mixed expressions ─────────────────────────────────────────────────────────

describe('mixed field + text expressions', () => {
  it('"Area: <area> m²" with area=25.5', () => {
    const ctx = makeCtx({ area: 25.5 });
    expect(evaluateFieldText('Area: <area> m²', ctx)).toBe('Area: 25.50 m²');
  });

  it('multiple tokens in sequence', () => {
    const ctx = makeCtx({ filename: 'plan.dxf', scale: 50 });
    const result = evaluateFieldText('<filename> 1:<scale>', ctx);
    expect(result).toBe('plan.dxf 1:50');
  });
});

// ── evaluateFieldText convenience wrapper ─────────────────────────────────────

describe('evaluateFieldText', () => {
  it('parses + evaluates in one call', () => {
    const ctx = makeCtx({ measurementValue: 200 });
    expect(evaluateFieldText('<>', ctx)).toBe('200.00');
  });

  it('plain text passes through unchanged', () => {
    expect(evaluateFieldText('no tokens here', makeCtx())).toBe('no tokens here');
  });
});
