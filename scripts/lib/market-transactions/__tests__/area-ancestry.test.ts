/**
 * `groupByAreaAncestry` (ADR-889 §4 · ADR-890 §16): κάθε πρόγονος με σελίδα παίρνει τις **εγγραφές** των φύλλων του —
 * όχι τα στατιστικά τους — χωρίς να μετρηθεί καμία δύο φορές.
 */

import { hasAreaMarketPage } from '@/types/area-market';

import { groupByAreaAncestry, type AncestryArea } from '../area-ancestry';

const HIERARCHY: Readonly<Record<string, AncestryArea>> = {
  'decentralized:1': { level: 2, parentId: null },
  'region:1': { level: 3, parentId: 'decentralized:1' },
  'regional_unit:11': { level: 4, parentId: 'region:1' },
  'municipality:1101': { level: 5, parentId: 'regional_unit:11' },
  'municipal_unit:110101': { level: 6, parentId: 'municipality:1101' },
  'municipal_unit:110102': { level: 6, parentId: 'municipality:1101' },
  // Δήμος **χωρίς** Δ.Ε.: είναι ο ίδιος φύλλο.
  'municipality:1102': { level: 5, parentId: 'regional_unit:11' },
};

function areaOf(id: string): AncestryArea {
  const area = HIERARCHY[id];
  if (area === undefined) throw new Error(`άγνωστη περιοχή ${id}`);
  return area;
}

const LEAVES = new Map<string, readonly number[]>([
  ['municipal_unit:110101', [1, 2]],
  ['municipal_unit:110102', [3]],
  ['municipality:1102', [4, 5]],
]);

describe('groupByAreaAncestry', () => {
  const groups = groupByAreaAncestry(LEAVES, areaOf, hasAreaMarketPage);

  it('κάθε πρόγονος με σελίδα παίρνει τις εγγραφές όλων των φύλλων του', () => {
    expect(groups.get('municipality:1101')).toEqual([1, 2, 3]);
    expect(groups.get('regional_unit:11')).toEqual([1, 2, 3, 4, 5]);
    expect(groups.get('region:1')).toEqual([1, 2, 3, 4, 5]);
  });

  it('τα φύλλα κρατούν τις δικές τους, με την αρχική σειρά', () => {
    expect(groups.get('municipal_unit:110101')).toEqual([1, 2]);
    expect(groups.get('municipality:1102')).toEqual([4, 5]);
  });

  it('καμία εγγραφή δύο φορές σε καμία ομάδα, καμία ομάδα για βαθμίδα χωρίς σελίδα', () => {
    for (const items of groups.values()) expect(new Set(items).size).toBe(items.length);
    expect(groups.has('decentralized:1')).toBe(false);
  });

  it('οι ομάδες είναι νέοι πίνακες: η είσοδος μένει ανέγγιχτη', () => {
    expect(LEAVES.get('municipal_unit:110101')).toEqual([1, 2]);
  });

  it('άγνωστη ταυτότητα στην αλυσίδα ⇒ σφάλμα, όχι σιωπηλή αποκοπή', () => {
    const orphan = new Map([['municipal_unit:999999', [9]]]);
    expect(() => groupByAreaAncestry(orphan, areaOf, hasAreaMarketPage)).toThrow('άγνωστη περιοχή');
  });
});
