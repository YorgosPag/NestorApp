/**
 * ADR-898 Φ3β-3β · ADR-236 — **το μικτό ανά επίπεδο**: η ΜΙΑ ανάγνωση του `levelData`, όλα ή τίποτα. Ο σπόρος `0`
 * (`buildEmptyLevelData`) σημαίνει «δεν συμπληρώθηκε»· μια μερική ή ασυνεπής λίστα δεν βγαίνει ποτέ.
 */

import { buildEmptyLevelData } from '@/services/multi-level.service';
import type { Property } from '@/types/property';

import { propertyAreaOnFloor } from '../floor-helpers';
import { levelGrossArea, readLevelAreas, readStoredLevelAreas, type LevelAreasSource } from '../level-areas';

const LEVELS = [
  { floorId: 'flr_1', floorNumber: 1, name: 'Α', isPrimary: false },
  { floorId: 'flr_0', floorNumber: 0, name: 'Ισόγειο', isPrimary: true },
];

const LEVEL_DATA = {
  flr_0: { areas: { gross: 60, net: 50 } },
  flr_1: { areas: { gross: 40 } },
};

const source = (overrides: Partial<LevelAreasSource> = {}): LevelAreasSource => ({
  levels: LEVELS,
  levelData: LEVEL_DATA,
  declaredCount: null,
  totalGross: 100,
  ...overrides,
});

describe('levelGrossArea — ένα επίπεδο', () => {
  it('θετικό μικτό ⇒ η τιμή', () => {
    expect(levelGrossArea(LEVEL_DATA, 'flr_0')).toBe(60);
  });

  it('🔴 ο σπόρος `0` του `buildEmptyLevelData` ⇒ `null`, ΠΟΤΕ «0 τ.μ.»', () => {
    expect(levelGrossArea({ flr_0: buildEmptyLevelData() }, 'flr_0')).toBeNull();
  });

  it.each<[string, unknown]>([
    ['απούσα εγγραφή', {}],
    ['χωρίς areas', { flr_0: {} }],
    ['αρνητικό', { flr_0: { areas: { gross: -5 } } }],
    ['NaN', { flr_0: { areas: { gross: Number.NaN } } }],
    ['κείμενο', { flr_0: { areas: { gross: '60' } } }],
    ['όχι αντικείμενο', null],
  ])('%s ⇒ `null`', (_, levelData) => {
    expect(levelGrossArea(levelData, 'flr_0')).toBeNull();
  });
});

describe('readLevelAreas — όλα ή τίποτα', () => {
  it('συνεπή στοιχεία ⇒ ένα επίπεδο ανά όροφο, ταξινομημένα', () => {
    expect(readLevelAreas(source())).toEqual([{ floor: 0, grossSqm: 60 }, { floor: 1, grossSqm: 40 }]);
  });

  it('υπόγειο ως κύριος χώρος (άρθ. 3 §6.β) ⇒ αρνητικός όροφος, πρώτος', () => {
    const levels = [...LEVELS, { floorId: 'flr_b', floorNumber: -1, name: 'Υπόγειο', isPrimary: false }];
    const levelData = { ...LEVEL_DATA, flr_b: { areas: { gross: 30 } } };
    expect(readLevelAreas(source({ levels, levelData, totalGross: 130 }))?.[0]).toEqual({ floor: -1, grossSqm: 30 });
  });

  it('χωρίς συνολικό μικτό ⇒ το άθροισμα δεν ελέγχεται (κανένα σύνολο για να διαφωνήσει)', () => {
    expect(readLevelAreas(source({ totalGross: null }))).toHaveLength(2);
  });

  it('στρογγυλοποίηση ως 0,01 τ.μ. ⇒ δεκτή', () => {
    expect(readLevelAreas(source({ totalGross: 100.005 }))).toHaveLength(2);
  });

  it.each<[string, Partial<LevelAreasSource>]>([
    ['ένα επίπεδο', { levels: [LEVELS[0]] }],
    ['χωρίς επίπεδα', { levels: null }],
    ['ένα εμβαδόν λείπει (σπόρος 0)', { levelData: { ...LEVEL_DATA, flr_1: buildEmptyLevelData() } }],
    ['ένα εμβαδόν λείπει (καμία εγγραφή)', { levelData: { flr_0: LEVEL_DATA.flr_0 } }],
    ['διπλός όροφος', { levels: [LEVELS[0], { ...LEVELS[1], floorNumber: 1 }] }],
    ['διπλό floorId', { levels: [LEVELS[0], { ...LEVELS[1], floorId: 'flr_1' }] }],
    ['μη ακέραιος όροφος', { levels: [LEVELS[0], { ...LEVELS[1], floorNumber: 0.5 }] }],
    ['κενό floorId', { levels: [LEVELS[0], { ...LEVELS[1], floorId: '' }] }],
    ['δηλωμένο πλήθος ≠ εγγραφές', { declaredCount: 3 }],
    ['άθροισμα ≠ συνολικό μικτό', { totalGross: 110 }],
  ])('🔴 %s ⇒ `null`, ΠΟΤΕ μερική λίστα', (_, overrides) => {
    expect(readLevelAreas(source(overrides))).toBeNull();
  });

  it('δηλωμένο πλήθος = εγγραφές ⇒ δεκτό', () => {
    expect(readLevelAreas(source({ declaredCount: 2 }))).toHaveLength(2);
  });
});

describe('readStoredLevelAreas — η αποθηκευμένη μορφή', () => {
  it('έγκυρη ⇒ αυτούσια, ταξινομημένη', () => {
    expect(readStoredLevelAreas([{ floor: 1, grossSqm: 40 }, { floor: 0, grossSqm: 60 }])).toEqual([
      { floor: 0, grossSqm: 60 },
      { floor: 1, grossSqm: 40 },
    ]);
  });

  it.each<[string, unknown]>([
    ['απούσα', undefined],
    ['ένα επίπεδο', [{ floor: 0, grossSqm: 60 }]],
    ['μηδέν', [{ floor: 0, grossSqm: 60 }, { floor: 1, grossSqm: 0 }]],
    ['διπλός όροφος', [{ floor: 0, grossSqm: 60 }, { floor: 0, grossSqm: 40 }]],
    ['άκυρο μέλος', [{ floor: 0, grossSqm: 60 }, null]],
  ])('%s ⇒ `null`', (_, raw) => {
    expect(readStoredLevelAreas(raw)).toBeNull();
  });
});

describe('propertyAreaOnFloor — ίδια ανάγνωση, η κατανομή κόστους δεν άλλαξε (ADR-329)', () => {
  const property = { id: 'p', floorId: 'flr_0', levels: LEVELS, levelData: LEVEL_DATA, areas: { gross: 100 } } as Property;

  it('εμβαδόν επιπέδου ⇒ μερικό', () => {
    expect(propertyAreaOnFloor(property, 'flr_1')).toEqual({
      area: 40,
      isPartial: true,
      isFallback: false,
    });
  });

  it('σπόρος `0` ⇒ η δική της (δηλωμένη) επιστροφή στο σύνολο — εκεί είναι πολιτική κόστους, όχι εικασία αξίας', () => {
    const seeded: Property = { ...property, levelData: { ...LEVEL_DATA, flr_1: buildEmptyLevelData() } };
    expect(propertyAreaOnFloor(seeded, 'flr_1')).toEqual({
      area: 100,
      isPartial: false,
      isFallback: true,
    });
  });
});
