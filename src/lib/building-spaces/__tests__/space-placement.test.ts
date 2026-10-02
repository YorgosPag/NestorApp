/**
 * ADR-898 §21 — **η άκυρη κατάσταση γίνεται αδύνατη**: παρακολούθημα μονάδας χωρίς κτίριο τοποθετείται στο κτίριο της
 * μονάδας· χώρος που βρίσκεται ήδη κάπου (θέση ≠ ανάθεση) δεν αγγίζεται ποτέ. Και η άγκυρα του σκοπού: μετά τις
 * τοποθετήσεις, η λίστα «βρίσκεται εδώ» (`buildingId = Χ`) ΤΑΥΤΙΖΕΤΑΙ με το `counted` του ΕΝΟΣ κανόνα.
 */

import { classifyBuildingSpaces, spaceOwnersOf, type SpaceRecord } from '../building-space-membership';
import { planSpacePlacement, planSpacePlacements } from '../space-placement';

type Doc = Record<string, unknown>;

const link = (spaceId: string) => ({ spaceId, spaceType: 'parking' });
const parking = (id: string, data: Doc): SpaceRecord => ({ id, kind: 'parking', data });

const A3 = { id: 'a3', buildingId: 'A', name: 'Α3', linkedSpaces: [link('free'), link('here'), link('other'), link('gone')] };
const OWNERS = spaceOwnersOf([A3]);
const SPACES = [
  parking('free', { number: 'Π-1' }),
  parking('here', { number: 'Π-2', buildingId: 'A' }),
  parking('other', { number: 'Π-5', buildingId: 'B' }),
  parking('gone', { number: 'Π-9', status: 'deleted' }),
];

describe('planSpacePlacement', () => {
  const owner = OWNERS.get('free')!;

  it('ζωντανός χώρος χωρίς κτίριο ⇒ τοποθέτηση στο κτίριο της ΜΟΝΑΔΑΣ, με όνομα και κάτοχο', () => {
    expect(planSpacePlacement(SPACES[0], owner)).toEqual({
      kind: 'place',
      placement: { spaceId: 'free', kind: 'parking', name: 'Π-1', buildingId: 'A', unitId: 'a3' },
    });
  });

  it('τοποθέτηση ≠ μετακίνηση: χώρος στο ίδιο ή σε ΑΛΛΟ κτίριο ⇒ τίποτα · κάδος ⇒ τίποτα', () => {
    expect(planSpacePlacement(SPACES[1], owner)).toEqual({ kind: 'noop' });
    expect(planSpacePlacement(SPACES[2], owner)).toEqual({ kind: 'noop' });
    expect(planSpacePlacement(SPACES[3], owner)).toEqual({ kind: 'noop' });
  });

  it('κενό κείμενο ως κτίριο = χωρίς κτίριο', () => {
    expect(planSpacePlacement(parking('blank', { buildingId: '  ' }), owner).kind).toBe('place');
  });

  it('μονάδα χωρίς κτίριο ⇒ αναφορά, ποτέ μαντεψιά', () => {
    expect(planSpacePlacement(SPACES[0], { ...owner, unitBuildingId: null })).toEqual({ kind: 'unit-without-building' });
  });

  it('ιδεμποτική: ο τοποθετημένος χώρος κρίνεται ξανά ως «τίποτα»', () => {
    const decision = planSpacePlacement(SPACES[0], owner);
    if (decision.kind !== 'place') throw new Error('expected place');
    expect(planSpacePlacement(parking('free', { number: 'Π-1', buildingId: decision.placement.buildingId }), owner)).toEqual({ kind: 'noop' });
  });
});

describe('planSpacePlacements', () => {
  it('μόνο χώροι με κάτοχο, ο καθένας ΜΙΑ φορά', () => {
    const placements = planSpacePlacements([...SPACES, SPACES[0], parking('stray', {})], OWNERS);
    expect(placements.map((p) => p.spaceId)).toEqual(['free']);
  });
});

describe('ΑΓΚΥΡΑ — λίστα και κανόνας δίνουν ΕΝΑΝ αριθμό μετά την τοποθέτηση', () => {
  it('το `counted` του κτιρίου Α = οι χώροι με `buildingId` = Α', () => {
    const placed = new Map(planSpacePlacements(SPACES, OWNERS).map((p) => [p.spaceId, p.buildingId]));
    const after = SPACES.map((space) => (placed.has(space.id) ? parking(space.id, { ...space.data, buildingId: placed.get(space.id) }) : space));
    const located = after.filter((space) => space.data.buildingId === 'A');
    const linked = after.filter((space) => space.data.buildingId !== 'A');
    const { counted } = classifyBuildingSpaces({ buildingIds: new Set(['A']), owners: OWNERS, located, linked });
    expect(counted.map((space) => space.id).sort()).toEqual(['free', 'here']);
    expect(counted.map((space) => space.id).sort()).toEqual(located.filter((s) => s.data.status !== 'deleted').map((s) => s.id).sort());
  });
});
