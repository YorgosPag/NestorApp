/**
 * ADR-235 · ADR-898 §20 — **ο πίνακας ποσοστών από τους χώρους του κτιρίου**: αυτοτελείς γραμμές για χώρους χωρίς
 * μονάδα (θέση πρώτα, μετά αποθήκη· η αποθήκη συμμετέχει, η θέση όχι), οι συνδεδεμένοι **μόνο** ως παρακολουθήματα της
 * μονάδας — και το παρακολούθημα σε **άλλο** κτίριο έχει εμβαδόν/όροφο, χωρίς να γίνεται ποτέ αυτοτελής γραμμή.
 */

import type { BuildingSpacesResult } from '@/services/building-spaces.service';

let spaces: BuildingSpacesResult;
jest.mock('@/services/building-spaces.service', () => ({ getBuildingSpaces: async () => spaces }));

import { autoPopulateRows } from '../ownership-auto-populate';

const unit = (id: string, linkedSpaces: unknown[]) => ({
  id,
  data: { name: id, linkedSpaces, areas: { net: 80, gross: 90 } },
  buildingId: 'A',
  buildingName: 'Κτίριο Α',
});

beforeEach(() => {
  spaces = {
    parking: [
      { id: 'pFree', data: { buildingId: 'A', name: 'Π-1', area: 12, floor: -1 } },
      { id: 'pLinked', data: { buildingId: 'A', name: 'Π-2', area: 13 } },
    ],
    storage: [{ id: 'sFree', data: { buildingId: 'A', name: 'Α-1', area: 6 } }],
    references: [{ id: 'p5', data: { buildingId: 'B', name: 'Π-5', area: 14, floor: -2 }, spaceType: 'parking', locatedInBuildingId: 'B' }],
    units: [unit('a3', [{ spaceId: 'pLinked', spaceType: 'parking' }, { spaceId: 'p5', spaceType: 'parking' }])],
    spaceLookup: new Map([
      ['pFree', { entityCode: 'A-PK-1', spaceType: 'parking' as const }],
      ['p5', { entityCode: 'B-PK-5', spaceType: 'parking' as const }],
    ]),
  };
});

describe('autoPopulateRows', () => {
  it('αυτοτελείς: θέση πρώτα (δεν συμμετέχει), μετά αποθήκη (συμμετέχει) · οι συνδεδεμένοι ΔΕΝ γίνονται γραμμή', async () => {
    const rows = await autoPopulateRows('prj', ['A']);
    expect(rows.map((row) => [row.ordinal, row.entityRef.id, row.entityCode, row.participatesInCalculation])).toEqual([
      [1, 'pFree', 'A-PK-1', false],
      [2, 'sFree', 'S-Free', true],
      [3, 'a3', 'U-3', true],
    ]);
    expect(rows[0]).toMatchObject({ entityRef: { collection: 'parking_spots' }, floor: '-1', areaSqm: 12, category: 'auxiliary' });
  });

  it('παρακολούθημα σε ΑΛΛΟ κτίριο ⇒ με εμβαδόν και όροφο στη μονάδα, ΠΟΤΕ αυτοτελής γραμμή (§20)', async () => {
    const rows = await autoPopulateRows('prj', ['A']);
    expect(rows.some((row) => row.entityRef.id === 'p5')).toBe(false);
    const a3 = rows.find((row) => row.entityRef.id === 'a3');
    expect(a3?.linkedSpacesSummary?.find((space) => space.spaceId === 'p5')).toMatchObject({ entityCode: 'B-PK-5', floor: '-2', areaSqm: 14 });
  });
});
