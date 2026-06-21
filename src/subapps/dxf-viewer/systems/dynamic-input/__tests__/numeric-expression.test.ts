/**
 * Unit tests — numeric-expression (ADR-510 Φ1, E2: math in numeric fields).
 */

import { evalExpr } from '../numeric-expression';

describe('evalExpr', () => {
  describe('plain numbers (parity with parseFloat for valid input)', () => {
    it('parses an integer', () => expect(evalExpr('1500')).toBe(1500));
    it('parses a decimal', () => expect(evalExpr('3.25')).toBe(3.25));
    it('parses a leading-dot decimal', () => expect(evalExpr('.5')).toBe(0.5));
    it('parses a negative number', () => expect(evalExpr('-200')).toBe(-200));
    it('parses a unary-plus number', () => expect(evalExpr('+42')).toBe(42));
    it('tolerates surrounding whitespace', () => expect(evalExpr('  12  ')).toBe(12));
  });

  describe('addition / subtraction', () => {
    it('adds', () => expect(evalExpr('1500+300')).toBe(1800));
    it('subtracts', () => expect(evalExpr('1500-300')).toBe(1200));
    it('chains left-to-right', () => expect(evalExpr('10+5-3')).toBe(12));
    it('handles spaces around operators', () => expect(evalExpr('1500 + 300')).toBe(1800));
  });

  describe('multiplication / division + precedence', () => {
    it('multiplies', () => expect(evalExpr('6*7')).toBe(42));
    it('divides', () => expect(evalExpr('3000/2')).toBe(1500));
    it('applies * before +', () => expect(evalExpr('2+3*4')).toBe(14));
    it('applies / before -', () => expect(evalExpr('20-10/2')).toBe(15));
  });

  describe('parentheses + unary', () => {
    it('respects parentheses', () => expect(evalExpr('(2+3)*4')).toBe(20));
    it('nests parentheses', () => expect(evalExpr('((1+2)*(3+4))')).toBe(21));
    it('applies unary minus to a group', () => expect(evalExpr('-(5+5)')).toBe(-10));
    it('combines unary and binary', () => expect(evalExpr('10*-2')).toBe(-20));
  });

  describe('invalid input → null', () => {
    it('rejects empty string', () => expect(evalExpr('')).toBeNull());
    it('rejects whitespace only', () => expect(evalExpr('   ')).toBeNull());
    it('rejects letters', () => expect(evalExpr('abc')).toBeNull());
    it('rejects a trailing operator', () => expect(evalExpr('1500+')).toBeNull());
    it('rejects two numbers without an operator', () => expect(evalExpr('1 2')).toBeNull());
    // Note: chained unary signs ARE valid (calculator semantics): 1++2 → 1+(+2) → 3.
    it('treats a chained sign as unary (1+-2 → -1)', () => expect(evalExpr('1+-2')).toBe(-1));
    it('rejects unbalanced parens', () => expect(evalExpr('(1+2')).toBeNull());
    it('rejects a stray closing paren', () => expect(evalExpr('1+2)')).toBeNull());
    it('rejects division by zero', () => expect(evalExpr('5/0')).toBeNull());
    it('rejects a bare operator', () => expect(evalExpr('*')).toBeNull());
    it('rejects mixed garbage', () => expect(evalExpr('12x3')).toBeNull());
  });
});
