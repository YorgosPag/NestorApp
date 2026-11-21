/**
 * Ο αναγνώστης σχήματος του `kad-2025.json` (`src/lib/kad/kad-catalog-shape.ts`) — ADR-372 §8.5 a4 · ADR-ACC-013.
 */

import { EMPTY_KAD_CATALOG, indexKadCatalog, readKadCatalog } from '../kad-catalog-shape';
import { FIXTURE_ENTRIES } from './kad-fixture';

const META = {
  source: 'ΑΑΔΕ Α.1003/2026',
  fek: 'Β΄ 235/2026',
  url: 'https://www.aade.gr/',
  sha256: 'abc',
  effectiveFrom: '2026-03-01',
  generatedAt: '2026-11-21',
  count: 2,
};

const VALID_ROW = { code: '41.00', gemi: '41000000', description: 'Κατασκευή κτιρίων', level: 'class', parent: '41.0' };
const SECTION_ROW = { code: 'F', gemi: null, description: 'Κατασκευές', level: 'section', parent: null };

describe('indexKadCatalog', () => {
  it('ευρετηριάζει κάθε κωδικό και κρατά ΕΝΑΝ νικητή ανά 8ψήφιο', () => {
    const catalog = indexKadCatalog(null, FIXTURE_ENTRIES);
    expect(catalog.byCode.size).toBe(FIXTURE_ENTRIES.length);
    expect(catalog.byGemi.get('41000000')?.code).toBe('41.00');
    expect(catalog.byGemi.get('43221000')?.code).toBe('43.22.1');
  });

  it('ο τομέας (χωρίς 8ψήφιο) δεν μπαίνει στο ευρετήριο ΓΕΜΗ', () => {
    const catalog = indexKadCatalog(null, FIXTURE_ENTRIES);
    expect([...catalog.byGemi.values()].some((entry) => entry.code === 'F')).toBe(false);
  });
});

describe('readKadCatalog', () => {
  it('διαβάζει έγκυρο αρχείο με τα meta του', () => {
    const catalog = readKadCatalog({ meta: META, entries: [SECTION_ROW, VALID_ROW] });
    expect(catalog?.entries).toHaveLength(2);
    expect(catalog?.meta?.fek).toBe('Β΄ 235/2026');
    expect(catalog?.byGemi.get('41000000')?.code).toBe('41.00');
  });

  it('απορρίπτει μόνο τις γραμμές με άγνωστο σχήμα — όχι όλο το αρχείο', () => {
    const catalog = readKadCatalog({
      meta: META,
      entries: [
        VALID_ROW,
        { ...VALID_ROW, code: '41.00.1', level: 'not-a-level' },
        { ...VALID_ROW, code: '41.00.2', gemi: '4100' },
        { ...VALID_ROW, code: 42 },
        null,
      ],
    });
    expect(catalog?.entries.map((entry) => entry.code)).toEqual(['41.00']);
  });

  it('meta με λάθος σχήμα ⇒ meta null, γραμμές κρατιούνται', () => {
    const catalog = readKadCatalog({ meta: { source: 'x' }, entries: [VALID_ROW] });
    expect(catalog?.meta).toBeNull();
    expect(catalog?.entries).toHaveLength(1);
  });

  it.each([
    ['όχι αντικείμενο', 'κείμενο'],
    ['χωρίς entries', { meta: META }],
    ['καμία έγκυρη γραμμή', { meta: META, entries: [{ code: 1 }] }],
    ['κενό entries', { meta: META, entries: [] }],
  ])('%s ⇒ null («δεν ξέρω»)', (_label, payload) => {
    expect(readKadCatalog(payload)).toBeNull();
  });
});

describe('EMPTY_KAD_CATALOG', () => {
  it('είναι κενός: καμία γραμμή, κανένα ευρετήριο, κανένα meta', () => {
    expect(EMPTY_KAD_CATALOG.entries).toHaveLength(0);
    expect(EMPTY_KAD_CATALOG.byCode.size).toBe(0);
    expect(EMPTY_KAD_CATALOG.byGemi.size).toBe(0);
    expect(EMPTY_KAD_CATALOG.meta).toBeNull();
  });
});
