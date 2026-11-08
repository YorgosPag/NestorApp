/**
 * Ο αναλυτής GTIN (ADR-934 §5.1.3, Σ1α). Τα παραδείγματα έχουν **αληθινό** ψηφίο ελέγχου· τα κανονικά παραδείγματα
 * των προτύπων (EAN-13 `4006381333931`, UPC-A `036000291452`, EAN-8 `96385074`, ISBN `9780306406157`) είναι εδώ
 * επίτηδες: αν ο αλγόριθμος αλλάξει, κοκκινίζουν απέναντι σε τιμή που δεν γράψαμε εμείς.
 */

import {
  gs1CheckDigit,
  gtinDigitsOf,
  hasValidGs1CheckDigit,
  isMatchableGtin,
  parseGtin,
  toGtin14,
  type ParsedGtin,
  type ValidGtin,
} from '../gtin';

function valid(input: string): ValidGtin {
  const parsed = parseGtin(input);
  if (parsed.kind !== 'valid') throw new Error(`αναμενόταν έγκυρο: ${input} (${parsed.reason})`);
  return parsed;
}

const reasonOf = (parsed: ParsedGtin): string | null => (parsed.kind === 'invalid' ? parsed.reason : null);

describe('gs1CheckDigit — κανονικά παραδείγματα των προτύπων', () => {
  it.each([
    ['400638133393', 1],
    ['03600029145', 2],
    ['9638507', 4],
    ['978030640615', 7],
  ])('%s → %i', (payload, digit) => {
    expect(gs1CheckDigit(payload)).toBe(digit);
  });

  it('τα αριστερά μηδενικά δεν αλλάζουν το ψηφίο', () => {
    expect(gs1CheckDigit('0400638133393')).toBe(gs1CheckDigit('400638133393'));
  });

  it('hasValidGs1CheckDigit: ένα ψηφίο δεν είναι κωδικός', () => {
    expect(hasValidGs1CheckDigit('7')).toBe(false);
  });
});

describe('parseGtin — απόρριψη, ποτέ «διόρθωση»', () => {
  it.each([
    ['400638133393A', 'format'],
    ['', 'format'],
    ['4006381.333931', 'format'],
    ['1234567', 'length'],
    ['400638133393100', 'length'],
    ['00000000', 'allZero'],
    ['00000000000000', 'allZero'],
    ['4006381333932', 'checkDigit'],
    ['96385075', 'checkDigit'],
  ])('%s → %s', (input, reason) => {
    expect(reasonOf(parseGtin(input))).toBe(reason);
  });
});

describe('parseGtin — κανονικοποίηση εισόδου', () => {
  it('κενά, NBSP και παύλες κάθε είδους αφαιρούνται μόνο στην είσοδο', () => {
    expect(valid(' 4006381 333931 ').gtin14).toBe('04006381333931');
    expect(valid('4006381 333931').gtin14).toBe('04006381333931');
    expect(valid('400–6381–333931').gtin14).toBe('04006381333931');
  });

  it('ψηφία πλήρους πλάτους (PDF/AI) γίνονται ASCII', () => {
    expect(gtinDigitsOf('４００６３８１３３３９３１')).toBe('4006381333931');
  });

  it('τα ψηφία της εμφάνισης μένουν όπως δόθηκαν (χωρίς διαχωριστικά)', () => {
    const parsed = valid('036000 291452');
    expect(parsed.digits).toBe('036000291452');
    expect(parsed.length).toBe(12);
  });
});

describe('GTIN-14 — ένα κλειδί για κάθε μήκος', () => {
  it('το ίδιο προϊόν ως GTIN-13 και ως GTIN-14 με δείκτη 0 έχει το ΙΔΙΟ κλειδί', () => {
    expect(valid('5201234567894').gtin14).toBe(valid('05201234567894').gtin14);
  });

  it.each([
    ['96385074', '00000096385074'],
    ['036000291452', '00036000291452'],
    ['4006381333931', '04006381333931'],
  ])('%s → %s', (input, gtin14) => {
    expect(valid(input).gtin14).toBe(gtin14);
    expect(toGtin14(input)).toBe(gtin14);
  });
});

describe('κατάταξη προθέματος — GTIN-12/13/14', () => {
  it.each([
    ['5201234567894', 'global'],
    ['4006381333931', 'global'],
    ['036000291452', 'global'],
    ['0200000000011', 'restricted-region'],
    ['200000000004', 'restricted-region'],
    ['2012345678903', 'restricted-region'],
    ['0400000000015', 'restricted-company'],
    ['400000000008', 'restricted-company'],
    ['500000000005', 'reserved'],
    ['9510000000012', 'non-trade'],
    ['9520000000011', 'demonstration'],
    ['9780306406157', 'publication'],
    ['9800000000014', 'non-trade'],
    ['9900000000011', 'non-trade'],
  ])('%s → %s', (input, prefixClass) => {
    expect(valid(input).prefixClass).toBe(prefixClass);
  });

  it('το UPC-A που αρχίζει από 0 ΔΕΝ είναι περιορισμένο: το πρόθεμα κρίνεται στα 13 ψηφία', () => {
    expect(valid('020000000015').prefixClass).toBe('global');
  });

  it('GTIN-14: η κατάταξη γίνεται μετά τον δείκτη', () => {
    expect(valid('15201234567891').prefixClass).toBe('global');
  });
});

describe('κατάταξη προθέματος — GTIN-8 έχει ΔΙΚΟ του πίνακα', () => {
  it.each([
    ['96385074', 'global'],
    ['01234565', 'restricted-company'],
    ['20012342', 'restricted-company'],
  ])('%s → %s', (input, prefixClass) => {
    expect(valid(input).prefixClass).toBe(prefixClass);
  });

  it('το GTIN-8 δεν κατατάσσεται μετά το γέμισμα (θα έπεφτε πάντα στο 000)', () => {
    expect(valid('96385074').gtin14.startsWith('000000')).toBe(true);
    expect(valid('96385074').prefixClass).toBe('global');
  });
});

describe('δείκτης GTIN-14', () => {
  it.each([
    ['5201234567894', { kind: 'base' }],
    ['05201234567894', { kind: 'base' }],
    ['15201234567891', { kind: 'packaging', digit: 1 }],
    ['95201234567897', { kind: 'variable-measure' }],
  ])('%s', (input, indicator) => {
    expect(valid(input).indicator).toEqual(indicator);
  });
});

describe('isMatchableGtin — ποιος κωδικός ΜΠΟΡΕΙ να ταυτίσει δύο πωλητές', () => {
  it.each(['5201234567894', '96385074', '9780306406157', '036000291452'])('%s → ναι', (input) => {
    expect(isMatchableGtin(parseGtin(input))).toBe(true);
  });

  it.each(['0200000000011', '2012345678903', '0400000000015', '01234565', '20012342', '9520000000011', '9800000000014', '500000000005'])(
    '%s → όχι (δεν είναι παγκόσμια μοναδικός ή δεν είναι είδος)',
    (input) => {
      expect(isMatchableGtin(parseGtin(input))).toBe(false);
    },
  );

  it('άκυρος κωδικός δεν ταυτίζει ποτέ', () => {
    expect(isMatchableGtin(parseGtin('4006381333932'))).toBe(false);
  });
});
