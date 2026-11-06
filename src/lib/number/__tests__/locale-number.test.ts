import { normalizeDecimalString, parseLocaleNumber, parseStrictDecimal, strictDecimalString } from '../locale-number';
import { parseGreekDecimal } from '../greek-decimal';

describe('normalizeDecimalString — auto-detect', () => {
  it('treats a single comma as the decimal (el-GR keyboard)', () => {
    expect(normalizeDecimalString('12,50')).toBe('12.50');
    expect(normalizeDecimalString('125500,50')).toBe('125500.50');
  });

  it('treats a single dot as the decimal', () => {
    expect(normalizeDecimalString('12.5')).toBe('12.5');
    expect(normalizeDecimalString('125500.50')).toBe('125500.50');
  });

  it('uses the last-occurring separator as the decimal when both are present', () => {
    expect(normalizeDecimalString('1.200,50')).toBe('1200.50'); // el-GR rendered value
    expect(normalizeDecimalString('1,200.50')).toBe('1200.50'); // US rendered value
    expect(normalizeDecimalString('125.500,50')).toBe('125500.50');
  });

  it('treats a repeated separator as thousands grouping', () => {
    expect(normalizeDecimalString('1.200.000')).toBe('1200000');
    expect(normalizeDecimalString('1,200,000')).toBe('1200000');
  });

  it('preserves in-progress trailing separators', () => {
    expect(normalizeDecimalString('12,')).toBe('12.');
    expect(normalizeDecimalString('12.')).toBe('12.');
  });

  it('preserves a leading minus sign', () => {
    expect(normalizeDecimalString('-125,5')).toBe('-125.5');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeDecimalString('')).toBe('');
    expect(normalizeDecimalString('   ')).toBe('');
  });
});

describe('normalizeDecimalString — fixed-locale mode', () => {
  it("comma-decimal mode strips dots as thousands", () => {
    expect(normalizeDecimalString('1.234,56', { decimalSeparator: ',' })).toBe('1234.56');
    expect(normalizeDecimalString('1.234', { decimalSeparator: ',' })).toBe('1234');
  });

  it("dot-decimal mode strips commas as thousands", () => {
    expect(normalizeDecimalString('1,234.56', { decimalSeparator: '.' })).toBe('1234.56');
    expect(normalizeDecimalString('1,234', { decimalSeparator: '.' })).toBe('1234');
  });
});

describe('parseLocaleNumber', () => {
  it('parses el-GR and US formatted numbers', () => {
    expect(parseLocaleNumber('1.200,50')).toBe(1200.5);
    expect(parseLocaleNumber('1,200.50')).toBe(1200.5);
    expect(parseLocaleNumber('12,50')).toBe(12.5);
    expect(parseLocaleNumber('12.50')).toBe(12.5);
    expect(parseLocaleNumber('1200')).toBe(1200);
  });

  it('strips currency symbols and whitespace', () => {
    expect(parseLocaleNumber('€ 12,50')).toBe(12.5);
    expect(parseLocaleNumber('$1200')).toBe(1200);
    expect(parseLocaleNumber('12.50 €')).toBe(12.5);
  });

  it('handles negatives', () => {
    expect(parseLocaleNumber('-125,5')).toBe(-125.5);
  });

  it('returns null for empty / unparseable / lone-minus input', () => {
    expect(parseLocaleNumber('')).toBeNull();
    expect(parseLocaleNumber('abc')).toBeNull();
    expect(parseLocaleNumber('-')).toBeNull();
    expect(parseLocaleNumber('€')).toBeNull();
  });

  it('supports fixed bank-locale modes', () => {
    expect(parseLocaleNumber('1.234,56', { decimalSeparator: ',' })).toBe(1234.56);
    expect(parseLocaleNumber('1,234.56', { decimalSeparator: '.' })).toBe(1234.56);
  });
});

describe('parity with legacy accounting parsers', () => {
  // Legacy parseAutoAmount: last-separator = decimal, auto-detect Greek vs US.
  const legacyAutoCases: Array<[string, number | null]> = [
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1234,56', 1234.56],
    ['1234.56', 1234.56],
    ['-50,00', -50],
    ['', null],
    ['-', null],
  ];
  it.each(legacyAutoCases)('parseAutoAmount(%s) === %s', (input, expected) => {
    expect(parseLocaleNumber(input)).toBe(expected);
  });

  // Legacy parseBankDecimal: fixed decimal separator, NaN → 0.
  it('parseBankDecimal Greek fixed mode', () => {
    expect(parseLocaleNumber('1.234,56', { decimalSeparator: ',' }) ?? 0).toBe(1234.56);
    expect(parseLocaleNumber('', { decimalSeparator: ',' }) ?? 0).toBe(0);
  });
});

describe('parseGreekDecimal — thin wrapper regression', () => {
  it('matches the documented examples', () => {
    expect(parseGreekDecimal('1.200,50')).toBe(1200.5);
    expect(parseGreekDecimal('12,50')).toBe(12.5);
    expect(parseGreekDecimal('12.50')).toBe(12.5);
    expect(parseGreekDecimal('1200')).toBe(1200);
    expect(parseGreekDecimal('')).toBeNull();
  });
});

describe('parseStrictDecimal — ΜΟΝΟ αν το κείμενο είναι ολόκληρο αριθμός (ADR-759 §2β.5 · ADR-923 §23.2 K2)', () => {
  it.each([
    ['1.364,05', 1364.05],
    ['12,5', 12.5],
    ['12.5', 12.5],
    ['1.200.000', 1200000],
    ['  39 ', 39],
    ['+4', 4],
    ['−3,5', -3.5],
  ])('%p → %p', (input, expected) => {
    expect(parseStrictDecimal(input)).toBe(expected);
  });

  it.each(['', ' ', 'κατά ΝΟΚ', '11 μ.', '0x10', '1e3', ',5', '2,', 'Infinity', '12 345', '--2', '1,2,3'])(
    '🔴 %p ⇒ null — ποτέ αριθμός που κανείς δεν έγραψε',
    (input) => {
      expect(parseStrictDecimal(input)).toBeNull();
    },
  );

  it('null / undefined ⇒ null, ποτέ 0', () => {
    expect(parseStrictDecimal(null)).toBeNull();
    expect(parseStrictDecimal(undefined)).toBeNull();
  });

  it('η μηχανική μορφή κρατά τα τελικά μηδενικά (ακρίβεια του προμηθευτή)', () => {
    expect(strictDecimalString('2,50')).toBe('2.50');
    expect(strictDecimalString('−1.200,50')).toBe('-1200.50');
  });
});
