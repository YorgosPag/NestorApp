/**
 * ADR-706 — numeric expression evaluator (Figma/Revit-parity calculator input).
 * Guards the safety contract (no eval) and the locale contract (`.` and `,`).
 */

import { evaluateNumericExpression, isNumericExpression } from '../numeric-expression';

describe('evaluateNumericExpression', () => {
  describe('plain literals — both decimal separators', () => {
    it.each([
      ['2.4', 2.4],
      ['2,4', 2.4],
      ['21.5', 21.5],
      ['21,5', 21.5],
      ['0.8', 0.8],
      ['70', 70],
      ['-125,5', -125.5],
    ])('parses %s → %s', (input, expected) => {
      expect(evaluateNumericExpression(input)).toBe(expected);
    });

    it('honours the locale-number SSoT for mixed separators', () => {
      expect(evaluateNumericExpression('1.200,50')).toBe(1200.5);
      expect(evaluateNumericExpression('1,200.50')).toBe(1200.5);
    });
  });

  describe('arithmetic', () => {
    it.each([
      ['1200/2', 600],
      ['18+3', 21],
      ['20-2', 18],
      ['3*7', 21],
      ['2^10', 1024],
      ['(18+3)*2', 42],
      ['2+3*4', 14],
      ['(2+3)*4', 20],
      ['10/4', 2.5],
    ])('evaluates %s → %s', (input, expected) => {
      expect(evaluateNumericExpression(input)).toBe(expected);
    });

    it('evaluates decimal operands written with a comma', () => {
      expect(evaluateNumericExpression('2,4*1,1')).toBeCloseTo(2.64, 10);
    });

    it('respects right-associativity of ^', () => {
      expect(evaluateNumericExpression('2^3^2')).toBe(512);
    });

    it('handles unary minus', () => {
      expect(evaluateNumericExpression('-5')).toBe(-5);
      expect(evaluateNumericExpression('-5+2')).toBe(-3);
      expect(evaluateNumericExpression('3*-2')).toBe(-6);
      expect(evaluateNumericExpression('(-4)*2')).toBe(-8);
    });

    it('ignores surrounding whitespace', () => {
      expect(evaluateNumericExpression('  18 + 3  ')).toBe(21);
    });
  });

  describe('unit-suffixed literals — noise is stripped (ADR-576 contract)', () => {
    // Pasting "21,5 m" or "€ 1.200,50" out of a spec sheet must Just Work.
    it.each([
      ['21,5 m', 21.5],
      ['€ 1.200,50', 1200.5],
      ['70%', 70],
      ['12 τ.μ.', 12],
    ])('parses %p → %s', (input, expected) => {
      expect(evaluateNumericExpression(input)).toBe(expected);
    });
  });

  describe('rejects invalid input with null (never throws)', () => {
    it.each([
      [''],
      ['   '],
      ['abc'],
      ['1/0'],
      ['(1+2'],
      ['1+2)'],
      ['1+'],
      ['*5'],
      ['--'],
      ['alert(1)'],
    ])('rejects %p', (input) => {
      expect(evaluateNumericExpression(input)).toBeNull();
    });

    it('never executes injected code', () => {
      const spy = jest.fn();
      (globalThis as unknown as { __numericFieldPwned?: () => void }).__numericFieldPwned = spy;
      expect(evaluateNumericExpression('__numericFieldPwned()')).toBeNull();
      expect(spy).not.toHaveBeenCalled();
      delete (globalThis as unknown as { __numericFieldPwned?: () => void }).__numericFieldPwned;
    });
  });
});

describe('isNumericExpression', () => {
  it('detects formulas', () => {
    expect(isNumericExpression('1200/2')).toBe(true);
    expect(isNumericExpression('(1+2)')).toBe(true);
  });

  it('treats plain literals as non-formulas', () => {
    expect(isNumericExpression('2,4')).toBe(false);
    expect(isNumericExpression('1.200,50')).toBe(false);
    expect(isNumericExpression('')).toBe(false);
  });
});
