/**
 * ADR-898 §20 — **ο ΕΝΑΣ κανόνας «ποιοι χώροι είναι του κτιρίου»** (θέση ≠ ανάθεση). Κάθε χώρος βγαίνει **μία** φορά,
 * σε **μία** λίστα· ο κάδος πουθενά· ο κάτοχος ντετερμινιστικός· σε ομάδα κτιρίων (πίνακας ποσοστών) ο χώρος ανάμεσά
 * τους **μετρά** — δεν είναι αναφορά.
 */

import {
  classifyBuildingSpaces,
  readBuildingSpaceMembership,
  spaceOwnersOf,
  type BuildingSpaceReader,
  type SpaceRecord,
} from '../building-space-membership';

type Doc = Record<string, unknown>;

const link = (spaceId: string, extra: Doc = {}) => ({ spaceId, spaceType: 'parking', ...extra });
const parking = (id: string, data: Doc): SpaceRecord => ({ id, kind: 'parking', data });

/** Ψεύτικος αναγνώστης: χώροι ανά ταυτότητα, το «κατά κτίριο» φιλτράρει το `buildingId`. */
function reader(spaces: readonly SpaceRecord[]): BuildingSpaceReader & { readonly byId: string[] } {
  const byId: string[] = [];
  return {
    byId,
    spacesLocatedIn: async (kind, buildingId) =>
      spaces.filter((space) => space.kind === kind && space.data.buildingId === buildingId).map(({ id, data }) => ({ id, data })),
    spaceById: async (spaceId) => {
      byId.push(spaceId);
      return spaces.find((space) => space.id === spaceId) ?? null;
    },
  };
}

describe('spaceOwnersOf', () => {
  it('ΕΝΑΣ κάτοχος, ο ίδιος όποια κι αν είναι η σειρά των μονάδων · κτίριο και όνομα της ΜΟΝΑΔΑΣ', () => {
    const units = [
      { id: 'u2', buildingId: 'B', name: 'Β2', linkedSpaces: [link('p1')] },
      { id: 'u1', buildingId: 'A', name: 'Α3', linkedSpaces: [link('p1', { inclusion: 'included', quantity: 1 })] },
    ];
    const forward = spaceOwnersOf(units).get('p1');
    expect(forward).toEqual({ unitId: 'u1', unitName: 'Α3', unitBuildingId: 'A', inclusion: 'included', quantity: 1 });
    expect(spaceOwnersOf([...units].reverse()).get('p1')).toEqual(forward);
  });
});

describe('classifyBuildingSpaces', () => {
  const owners = spaceOwnersOf([{ id: 'a3', buildingId: 'A', name: 'Α3', linkedSpaces: [link('p5'), link('free'), link('gone')] }]);

  it('στο κτίριο της μονάδας: χωρίς κτίριο ⇒ ΜΕΤΡΑ · σε άλλο κτίριο ⇒ ΑΝΑΦΟΡΑ · κάδος ⇒ πουθενά', () => {
    const result = classifyBuildingSpaces({
      buildingIds: new Set(['A']),
      owners,
      located: [parking('own', { buildingId: 'A' }), parking('bin', { buildingId: 'A', status: 'deleted' })],
      linked: [parking('p5', { buildingId: 'B' }), parking('free', {}), parking('gone', { buildingId: 'B', status: 'deleted' })],
    });
    expect(result.counted.map((space) => [space.id, space.owner?.unitId ?? null])).toEqual([['own', null], ['free', 'a3']]);
    expect(result.references.map((space) => [space.id, space.locatedInBuildingId, space.owner.unitId])).toEqual([['p5', 'B', 'a3']]);
  });

  it('στο κτίριο όπου ΒΡΙΣΚΕΤΑΙ: μετρά, με τον κάτοχό του από άλλο κτίριο', () => {
    const result = classifyBuildingSpaces({ buildingIds: new Set(['B']), owners, located: [parking('p5', { buildingId: 'B' })], linked: [] });
    expect(result.counted.map((space) => [space.id, space.owner?.unitBuildingId])).toEqual([['p5', 'A']]);
    expect(result.references).toEqual([]);
  });

  it('ΠΟΤΕ δύο φορές: ο ίδιος χώρος σε `located` ΚΑΙ `linked` ⇒ μία γραμμή, μετρούμενη', () => {
    const p5 = parking('p5', { buildingId: 'A' });
    const result = classifyBuildingSpaces({ buildingIds: new Set(['A']), owners, located: [p5], linked: [p5] });
    expect(result.counted.map((space) => space.id)).toEqual(['p5']);
    expect(result.references).toEqual([]);
  });

  it('χώρος με κάτοχο ΑΛΛΟΥ κτιρίου, που δεν βρίσκεται εδώ, δεν είναι ούτε μετρούμενος ούτε αναφορά', () => {
    const result = classifyBuildingSpaces({ buildingIds: new Set(['C']), owners, located: [], linked: [parking('p5', { buildingId: 'B' })] });
    expect(result).toEqual({ counted: [], references: [] });
  });
});

describe('readBuildingSpaceMembership', () => {
  const units = [{ id: 'a3', buildingId: 'A', linkedSpaces: [link('p5'), link('own')] }];
  const spaces = [parking('p5', { buildingId: 'B' }), parking('own', { buildingId: 'A' }), parking('b1', { buildingId: 'B' })];

  it('ένα κτίριο: διαβάζει κατά ταυτότητα ΜΟΝΟ όσους δεν βρέθηκαν κατά κτίριο', async () => {
    const fake = reader(spaces);
    const result = await readBuildingSpaceMembership(fake, ['A'], units);
    expect(fake.byId).toEqual(['p5']);
    expect(result.counted.map((space) => space.id)).toEqual(['own']);
    expect(result.references.map((space) => space.id)).toEqual(['p5']);
  });

  it('ομάδα κτιρίων (πίνακας ποσοστών): ο χώρος ανάμεσά τους ΜΕΤΡΑ μία φορά, καμία αναφορά', async () => {
    const result = await readBuildingSpaceMembership(reader(spaces), ['A', 'B'], units);
    expect(result.counted.map((space) => space.id).sort()).toEqual(['b1', 'own', 'p5']);
    expect(result.references).toEqual([]);
  });
});
