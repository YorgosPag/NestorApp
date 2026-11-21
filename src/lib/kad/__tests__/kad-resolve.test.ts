/**
 * Ο κανόνας επίλυσης ΚΑΔ (`src/lib/kad/kad-resolve.ts`) — ADR-372 §8.5 a4 · ADR-ACC-013.
 */

import {
  formatKadGemi,
  isLegacyKadValue,
  isSelectableKad,
  kadDepth,
  normalizeKadInput,
  pickGemiWinner,
  resolveKad,
  toKadSelection,
} from '../kad-resolve';
import { KAD_CATALOG_VERSION } from '../kad-types';
import { EMPTY_KAD_CATALOG } from '../kad-catalog-shape';
import { FIXTURE_CATALOG, fixtureEntry } from './kad-fixture';

describe('normalizeKadInput', () => {
  it.each([
    ['41.00', { kind: 'dotted', code: '41.00', gemi: '41000000' }],
    ['41.00.11 ', { kind: 'dotted', code: '41.00.11', gemi: '41001100' }],
    ['4100', { kind: 'gemi', gemi: '41000000' }],
    ['41000000', { kind: 'gemi', gemi: '41000000' }],
    ['4100 1100', { kind: 'gemi', gemi: '41001100' }],
  ])('δέχεται «%s»', (raw, expected) => {
    expect(normalizeKadInput(raw)).toEqual(expected);
  });

  it.each(['', '   ', '41', 'abc', '410000001', '41..00', '41.00.', '4.100'])('απορρίπτει «%s»', (raw) => {
    expect(normalizeKadInput(raw)).toBeNull();
  });
});

describe('formatKadGemi', () => {
  it('σβήνει τις τελείες και συμπληρώνει δεξιά με 0 ως τα 8 ψηφία', () => {
    expect(formatKadGemi('41.00')).toBe('41000000');
    expect(formatKadGemi('41.00.11')).toBe('41001100');
    expect(formatKadGemi('41.00.11.01')).toBe('41001101');
  });
});

describe('kadDepth / isSelectableKad', () => {
  it('το βάθος ακολουθεί το επίπεδο, από τον τομέα (0)', () => {
    expect(kadDepth('section')).toBe(0);
    expect(kadDepth('class')).toBe(3);
    expect(kadDepth('national')).toBe(6);
  });

  it('επιλέξιμο = τάξη και βαθύτερα', () => {
    expect(isSelectableKad(fixtureEntry('41'))).toBe(false);
    expect(isSelectableKad(fixtureEntry('41.0'))).toBe(false);
    expect(isSelectableKad(fixtureEntry('41.00'))).toBe(true);
    expect(isSelectableKad(fixtureEntry('41.00.11.01'))).toBe(true);
  });
});

describe('pickGemiWinner — ο κανόνας σύγκρουσης των 8 ψηφίων', () => {
  it('ανάμεσα σε επιλέξιμους νικά ο ρηχότερος (43.22.1, όχι 43.22.10)', () => {
    const winner = pickGemiWinner([fixtureEntry('43.22.10'), fixtureEntry('43.22.1')]);
    expect(winner?.code).toBe('43.22.1');
  });

  it('η τάξη νικά τις επικεφαλίδες με το ίδιο 8ψήφιο (41.00, όχι 41 ή 41.0)', () => {
    const winner = pickGemiWinner([fixtureEntry('41'), fixtureEntry('41.0'), fixtureEntry('41.00')]);
    expect(winner?.code).toBe('41.00');
  });

  it('χωρίς επιλέξιμο, νικά ο βαθύτερος (99.0)', () => {
    expect(pickGemiWinner([fixtureEntry('99'), fixtureEntry('99.0')])?.code).toBe('99.0');
  });

  it('κενή λίστα ⇒ null', () => {
    expect(pickGemiWinner([])).toBeNull();
  });
});

describe('resolveKad', () => {
  it('κωδικός με τελείες που υπάρχει αυτούσιος κερδίζει', () => {
    expect(resolveKad(FIXTURE_CATALOG, '41.0')?.code).toBe('41.0');
    expect(resolveKad(FIXTURE_CATALOG, '43.22.10')?.code).toBe('43.22.10');
  });

  it('8 ψηφία ⇒ αποφασίζει ο κανόνας σύγκρουσης', () => {
    expect(resolveKad(FIXTURE_CATALOG, '41000000')?.code).toBe('41.00');
    expect(resolveKad(FIXTURE_CATALOG, '4100')?.code).toBe('41.00');
    expect(resolveKad(FIXTURE_CATALOG, '43221000')?.code).toBe('43.22.1');
  });

  it('άγνωστο ή άκυρο ⇒ null', () => {
    expect(resolveKad(FIXTURE_CATALOG, '12345678')).toBeNull();
    expect(resolveKad(FIXTURE_CATALOG, 'abc')).toBeNull();
    expect(resolveKad(EMPTY_KAD_CATALOG, '41.00')).toBeNull();
  });
});

describe('toKadSelection / isLegacyKadValue', () => {
  it('η επιλογή γράφει κωδικό, περιγραφή και έκδοση καταλόγου', () => {
    expect(toKadSelection(fixtureEntry('41.00'))).toEqual({
      code: '41.00',
      description: 'Περιγραφή 41.00',
      catalog: KAD_CATALOG_VERSION,
    });
  });

  it('τιμή χωρίς σημαία καταλόγου = ΚΑΔ 2008· κενός κωδικός δεν είναι legacy', () => {
    expect(isLegacyKadValue({ code: '41.20.10.01' })).toBe(true);
    expect(isLegacyKadValue({ code: '41.00', catalog: KAD_CATALOG_VERSION })).toBe(false);
    expect(isLegacyKadValue({ code: '  ' })).toBe(false);
  });
});
