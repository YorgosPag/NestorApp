/**
 * Tests for the canonical comma→dot normalizer SSoT (`normalizeNumber`) and
 * `isValidNumber`. Guards the `/,/g` superset semantics that let ONE normalizer
 * cover both single decimals and multi-comma arithmetic expressions
 * (RadialCommandRing `evalExpr`), so every migrated site behaves identically.
 */

import { normalizeNumber, isValidNumber } from '../number';

describe('normalizeNumber', () => {
  it('replaces a single decimal comma with a dot', () => {
    expect(normalizeNumber('1,5')).toBe('1.5');
    expect(normalizeNumber('0,25')).toBe('0.25');
    expect(normalizeNumber('-3,14')).toBe('-3.14');
  });

  it('replaces EVERY comma (expression superset), not just the first', () => {
    // The RadialCommandRing feeds arithmetic expressions to evalExpr; each
    // operand can carry its own el-GR decimal comma.
    expect(normalizeNumber('1,5+2,5')).toBe('1.5+2.5');
    expect(normalizeNumber('1,2*3,4-0,6')).toBe('1.2*3.4-0.6');
  });

  it('leaves dot-decimal and integer input unchanged', () => {
    expect(normalizeNumber('1.5')).toBe('1.5');
    expect(normalizeNumber('42')).toBe('42');
    expect(normalizeNumber('')).toBe('');
  });
});

describe('isValidNumber', () => {
  it('accepts integers, decimals, negatives and zero (comma or dot)', () => {
    expect(isValidNumber('42')).toBe(true);
    expect(isValidNumber('1,5')).toBe(true);
    expect(isValidNumber('1.5')).toBe(true);
    expect(isValidNumber('-7')).toBe(true);
    expect(isValidNumber('0')).toBe(true);
    expect(isValidNumber('0,0')).toBe(true);
  });

  it('rejects empty, lone separators and non-numeric input', () => {
    expect(isValidNumber('')).toBe(false);
    expect(isValidNumber('-')).toBe(false);
    expect(isValidNumber('.')).toBe(false);
    expect(isValidNumber('abc')).toBe(false);
    expect(isValidNumber('1,2,3')).toBe(false);
  });
});
