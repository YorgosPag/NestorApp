/**
 * ADR-900 §3.8 — άγκυρα του SSoT του ΚΑΕΚ.
 *
 * Κ1 μορφές εισόδου · Κ2 απορρίψεις · Κ3 κανονική μορφή · Κ4 ανάλυση ψηφίων · Κ5 εύρεση σε κείμενο.
 */
import {
  canonicalKaek,
  findKaekCodes,
  formatKaek,
  isValidKaek,
  parcelKaekOf,
  parseKaek,
} from '../kaek';

describe('ΚΑΕΚ — Κ1 αποδεκτές μορφές', () => {
  it.each([
    ['050681726003', '050681726003'],
    ['050681726003/0/1', '050681726003/0/1'],
    ['050681726003/1/12', '050681726003/1/12'],
    ['05 068 17 26 003', '050681726003'],
    ['05-068-17-26-003/0/2', '050681726003/0/2'],
    ['0506817260030003', '050681726003/0/3'],
  ])('%s ⇒ %s', (input, expected) => {
    expect(canonicalKaek(input)).toBe(expected);
  });
});

describe('ΚΑΕΚ — Κ2 απορρίψεις', () => {
  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['05068172600', 'malformed'],
    ['0506817260031', 'malformed'],
    ['050681726003/0', 'malformed'],
    ['050681726003/0/12345', 'malformed'],
    ['050681726003/12345/1', 'malformed'],
    ['05068172600A', 'malformed'],
    ['000000000000', 'zero-parcel'],
  ])('%j ⇒ %s', (input, reason) => {
    const result = parseKaek(input);
    expect(result).toEqual({ kind: 'invalid', reason });
    expect(isValidKaek(input)).toBe(false);
  });
});

describe('ΚΑΕΚ — Κ3 κανονική μορφή', () => {
  it('ίδια ιδιοκτησία από δύο μορφές ⇒ ΙΔΙΟ κείμενο (σύγκριση = ισότητα)', () => {
    expect(canonicalKaek('0506817260030001')).toBe(canonicalKaek('050681726003/0/1'));
  });

  it('τα μηδενικά μπροστά στους αριθμούς ιδιοκτησίας δεν αλλάζουν την ταυτότητα', () => {
    expect(canonicalKaek('050681726003/00/01')).toBe('050681726003/0/1');
  });

  it('formatKaek ∘ parseKaek είναι ταυτοτική στην κανονική μορφή', () => {
    const result = parseKaek('050681726003/2/7');
    if (result.kind !== 'parsed') throw new Error('αναμενόταν ανάλυση');
    expect(formatKaek(result.kaek)).toBe('050681726003/2/7');
  });
});

describe('ΚΑΕΚ — Κ4 ανάλυση ψηφίων', () => {
  it('νομός·δήμος·τομέας·ενότητα·α/α', () => {
    const result = parseKaek('050681726003/0/4');
    if (result.kind !== 'parsed') throw new Error('αναμενόταν ανάλυση');
    expect(result.kaek).toEqual({
      parcel: '050681726003',
      prefecture: '05',
      municipality: '068',
      sector: '17',
      unitBlock: '26',
      serial: '003',
      unit: { vertical: 0, horizontal: 4 },
    });
    expect(parcelKaekOf(result.kaek)).toBe('050681726003');
  });

  it('κωδικός γεωτεμαχίου ⇒ unit === null', () => {
    const result = parseKaek('050681726003');
    expect(result.kind === 'parsed' && result.kaek.unit).toBeNull();
  });
});

describe('ΚΑΕΚ — Κ5 εύρεση σε ελεύθερο κείμενο', () => {
  it('βρίσκει, κανονικοποιεί, αφαιρεί διπλότυπα', () => {
    const text = 'ΚΑΕΚ: 050681726003 / 0 / 1 — ίδιο: 050681726003/0/1 · γεωτεμάχιο 180411302004';
    expect(findKaekCodes(text)).toEqual(['050681726003/0/1', '180411302004']);
  });

  it('δεν κόβει ΚΑΕΚ από μακρύτερο αριθμό (πρωτόκολλο, κωδικός επαλήθευσης)', () => {
    expect(findKaekCodes('Αρ. πρωτ. 12345678901234567')).toEqual([]);
  });
});
