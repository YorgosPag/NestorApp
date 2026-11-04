/**
 * ADR-931 — τα σύνολα της σελίδας κοινόχρηστων προκύπτουν ΜΟΝΟ από τη λίστα.
 */

import { computeCommonSpaceStats } from '@/lib/common-spaces/common-space-stats';
import { mapCommonSpaceDoc } from '@/lib/common-spaces/common-space-mapper';
import { COMMON_SPACE_GROUPS } from '@/constants/common-space-categories';
import type { CommonSpace } from '@/types/common-space';

function space(id: string, overrides: Partial<CommonSpace>): CommonSpace {
  return { ...mapCommonSpaceDoc(id, { name: id, buildingId: 'b1', category: 'stairwell' }), ...overrides };
}

describe('ADR-931 — computeCommonSpaceStats', () => {
  it('κενή λίστα ⇒ μηδενικά, αλλά ΚΑΘΕ ομάδα παρούσα (η οθόνη δείχνει τι λείπει)', () => {
    const stats = computeCommonSpaceStats([]);
    expect(stats).toMatchObject({ count: 0, areaM2: 0, areaUnknownCount: 0, exclusiveUseCount: 0, buildings: [] });
    expect(stats.groups.map((group) => group.group)).toEqual([...COMMON_SPACE_GROUPS]);
    expect(stats.groups.every((group) => group.count === 0 && group.categories.length === 0)).toBe(true);
  });

  it('ομαδοποίηση + εμβαδόν: αθροίζεται ΜΟΝΟ το δηλωμένο, τα άγνωστα μετριούνται χωριστά', () => {
    const stats = computeCommonSpaceStats([
      space('s1', { category: 'stairwell', area: 20 }),
      space('s2', { category: 'elevator' }),
      space('s3', { category: 'boiler_room', area: 12.5, buildingId: 'b2' }),
    ]);
    expect(stats).toMatchObject({ count: 3, areaM2: 32.5, areaUnknownCount: 1 });
    const vertical = stats.groups.find((group) => group.group === 'vertical');
    expect(vertical).toMatchObject({ count: 2, areaM2: 20, areaUnknownCount: 1 });
    expect(vertical?.categories.map((entry) => entry.category)).toEqual(['stairwell', 'elevator']);
  });

  it('ανά κτίριο: ταξινόμηση κατά πλήθος (φθίνουσα)', () => {
    const stats = computeCommonSpaceStats([
      space('a', { buildingId: 'b2' }),
      space('b', { buildingId: 'b1' }),
      space('c', { buildingId: 'b1' }),
    ]);
    expect(stats.buildings.map((entry) => [entry.buildingId, entry.count])).toEqual([['b1', 2], ['b2', 1]]);
  });

  it('μετρά τους χώρους αποκλειστικής χρήσης', () => {
    const stats = computeCommonSpaceStats([
      space('r', { category: 'roof_terrace', legalNature: 'exclusive_use', exclusiveUsePropertyIds: ['p1'] }),
      space('g', { category: 'garden' }),
    ]);
    expect(stats.exclusiveUseCount).toBe(1);
  });
});

describe('ADR-931 — mapCommonSpaceDoc (σύνορο ανάγνωσης)', () => {
  it('άγνωστη κατηγορία/φύση ⇒ «other» / «common_use» — ο χώρος ΦΑΙΝΕΤΑΙ, δεν χάνεται', () => {
    const mapped = mapCommonSpaceDoc('x', { name: 'X', buildingId: 'b1', category: 'lounges', legalNature: 'weird' });
    expect(mapped).toMatchObject({ category: 'other', legalNature: 'common_use' });
  });

  it('εμβαδόν 0 ή αρνητικό ⇒ αδήλωτο (ποτέ «0 m²» ως γνώση)', () => {
    expect(mapCommonSpaceDoc('x', { area: 0 }).area).toBeUndefined();
    expect(mapCommonSpaceDoc('x', { area: -3 }).area).toBeUndefined();
    expect(mapCommonSpaceDoc('x', { area: 7.25 }).area).toBe(7.25);
  });
});
