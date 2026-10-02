/**
 * ADR-898 §19 (Φ4γ) — η αντικειμενική ενός ΧΩΡΟΥ του κτιρίου (θέση: έντυπο 5 · αποθήκη: έντυπο 4), ως δική του γραμμή.
 * Ιεραρχία θέσης: απάντηση χώρου > γεγονός κτιρίου > ζώνη/όροφος > ανοιχτό (εύρος, ποτέ μαντεψιά).
 */

import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';

import type { BuildingObjectiveValueContext } from '../building-objective-value';
import { readBuildingObjectiveValueFacts, type BuildingObjectiveValueFacts } from '../building-objective-value-facts';
import {
  buildingSpaceObjectiveValue,
  readSpacePositionDeclaration,
  spaceFloorOf,
  type BuildingSpaceInput,
} from '../building-space-objective-value';

const TODAY = '2026-10-02';
const ZONE = { id: 'z1', name: 'Θ', price: 2000, validFrom: '2022-01-01' };
const READY: ValueZoneVerdict = { kind: 'ready', zone: ZONE, nearEdge: false, fronts: [] };
/** Ζώνη με μέτωπο ακριβότερο (γραμμική ζώνη υπό όρο). */
const WITH_FRONT: ValueZoneVerdict = {
  kind: 'ready',
  zone: ZONE,
  nearEdge: false,
  fronts: [{ id: 'f1', name: 'Μέτωπο', price: 3000, validFrom: '2022-01-01', street: 'Εγνατία', distanceM: 5 }],
};

/** Κτίριο αποπερατωμένο, με άδεια φέτος (παλαιότητα 0 ⇒ συντελεστής 1). */
const context = (overrides: Partial<BuildingObjectiveValueFacts> = {}, stage: BuildingObjectiveValueContext['stage'] = { source: 'schedule', stage: 'electricity' }): BuildingObjectiveValueContext => ({
  stage,
  facts: { ...readBuildingObjectiveValueFacts(undefined), permitDate: '2026-01-01', ...overrides },
});

const parking = (overrides: Partial<BuildingSpaceInput> = {}): BuildingSpaceInput => ({
  kind: 'parking',
  area: 12,
  floor: null,
  locationZone: null,
  declaredPosition: null,
  linkedQuantity: null,
  ...overrides,
});

const storage = (overrides: Partial<BuildingSpaceInput> = {}): BuildingSpaceInput => ({
  ...parking(),
  kind: 'storage',
  area: 10,
  ...overrides,
});

const valueOf = (space: BuildingSpaceInput, ctx = context(), verdict = READY) => buildingSpaceObjectiveValue(space, ctx, verdict, TODAY);

describe('θέση στάθμευσης (έντυπο 5)', () => {
  it('πυλωτή ⇒ 0,15 — χωρίς παλαιότητα (μόνο κλειστές, άρθ. 7 §6)', () => {
    const { value, position } = valueOf(parking({ locationZone: 'pilotis' }));
    expect(position).toEqual({ kind: 'fixed', position: 'pilotis', source: 'zone' });
    expect(value).toMatchObject({ kind: 'evaluated', bounds: { kind: 'exact', result: { value: 3600 } } });
  });

  it('σκεπαστή εξωτερική ⇒ ΕΥΡΟΣ ακάλυπτος ↔ πυλωτή, ποτέ μαντεψιά (απόφαση Giorgio)', () => {
    const { value, position } = valueOf(parking({ locationZone: 'covered_outdoor' }));
    expect(position).toEqual({ kind: 'open', candidates: ['yardOrRoof', 'pilotis'], fact: null });
    expect(value).toMatchObject({ kind: 'evaluated', bounds: { kind: 'range', low: 2400, high: 3600, open: ['position'] } });
  });

  it('η απάντηση του χώρου υπερισχύει της ζώνης', () => {
    const { value } = valueOf(parking({ locationZone: 'covered_outdoor', declaredPosition: 'pilotis' }));
    expect(value).toMatchObject({ bounds: { kind: 'exact', result: { value: 3600 } } });
  });

  it('χωρίς εμβαδόν ⇒ 20 τ.μ. του νόμου, ΔΗΛΩΜΕΝΗ υπόθεση (άρθ. 7 §5)', () => {
    const { value } = valueOf(parking({ locationZone: 'pilotis', area: null }));
    expect(value).toMatchObject({ bounds: { kind: 'exact', result: { value: 6000 } }, assumptions: [{ kind: 'parkingDefaultArea' }] });
  });

  it('υπόγειο ⇒ κλειστή σε υπόγειο · χωρίς γραμμική ζώνη ακόμη κι αν υπάρχει μέτωπο (άρθ. 7 §2)', () => {
    const { value, position } = valueOf(parking({ floor: -1 }), context(), WITH_FRONT);
    expect(position).toEqual({ kind: 'fixed', position: 'closedBasement', source: 'floor' });
    expect(value).toMatchObject({ bounds: { kind: 'exact', result: { zonePrice: 2000 } } });
  });

  it('πλήθος > 1 στη σύνδεση ⇒ μία αποτίμηση + δηλωμένη υπόθεση (απόφαση Giorgio)', () => {
    const { value } = valueOf(parking({ locationZone: 'pilotis', linkedQuantity: 2 }));
    expect(value).toMatchObject({ bounds: { result: { value: 3600 } }, assumptions: [{ kind: 'quantityDeclared', quantity: 2 }] });
  });
});

describe('αποθήκη (έντυπο 4)', () => {
  it('υπόγειο + γεγονός κτιρίου ⇒ η είσοδος του κτιρίου, ΚΛΗΡΟΝΟΜΗΜΕΝΗ', () => {
    const { value, position } = valueOf(storage({ floor: -1 }), context({ basementStorageEntrance: 'basementInternalEntrance' }));
    expect(position).toEqual({ kind: 'fixed', position: 'basementInternalEntrance', source: 'building' });
    expect(value).toMatchObject({ bounds: { kind: 'exact', result: { value: 3000 } } });
    expect(value.kind === 'evaluated' && value.inherited).toContain('basementStorageEntrance');
  });

  it('η απάντηση της αποθήκης υπερισχύει του κτιρίου — και τότε ΔΕΝ λέγεται «από το κτίριο»', () => {
    const { value } = valueOf(storage({ floor: -1, declaredPosition: 'basementStreetEntrance' }), context({ basementStorageEntrance: 'basementInternalEntrance' }));
    expect(value).toMatchObject({ bounds: { kind: 'exact', result: { value: 5000 } } });
    expect(value.kind === 'evaluated' && value.inherited).not.toContain('basementStorageEntrance');
  });

  it('υπόγειο χωρίς απάντηση ⇒ εύρος ΜΟΝΟ στις 4 εισόδους υπογείου, ερώτηση του κτιρίου', () => {
    const { value, position } = valueOf(storage({ floor: -1 }));
    expect(position).toMatchObject({ kind: 'open', fact: 'basementStorageEntrance' });
    expect(value).toMatchObject({ bounds: { kind: 'range', low: 3000, high: 5000, open: ['position'] } });
  });

  it('ισόγειο ⇒ εκτός ΣΔ ως ΔΗΛΩΜΕΝΗ υπόθεση', () => {
    const { value } = valueOf(storage({ floor: 0 }));
    expect(value).toMatchObject({ bounds: { kind: 'exact', result: { value: 6000 } }, assumptions: [{ kind: 'storageNotCounted' }] });
  });

  it('όροφος ⇒ χώρος κύριας χρήσης: εκτός εντύπου 4, άρα ούτε στο σύνολο ούτε εκκρεμής', () => {
    expect(valueOf(storage({ floor: 2 })).value).toEqual({ kind: 'unsupported', reason: 'mainUse' });
  });

  it('θεμελίωση ⇒ πριν από αποτιμώμενο στάδιο (άρθ. 6 §8)', () => {
    expect(valueOf(storage({ floor: -1 }), context({}, { source: 'schedule', stage: 'foundation' })).value).toEqual({ kind: 'beforeStage', stage: 'foundation' });
  });

  it('χωρίς άδεια κτιρίου ⇒ λείπει η παλαιότητα (ποτέ τεκμήριο)', () => {
    const { value } = valueOf(storage({ floor: 0 }), context({ permitDate: null }));
    expect(value).toMatchObject({ bounds: { kind: 'unresolved', result: { missing: ['ageYears'] } } });
  });
});

describe('ανάγνωση εγγράφου χώρου', () => {
  it('όροφος: μόνο ακέραιος — κείμενο ⇒ άγνωστο, ποτέ ερμηνεία', () => {
    expect([spaceFloorOf('-1'), spaceFloorOf(' 0 '), spaceFloorOf(2), spaceFloorOf('pilotis'), spaceFloorOf(1.5), spaceFloorOf(undefined)]).toEqual([-1, 0, 2, null, null, null]);
  });

  it('απάντηση θέσης: μόνο θέση του ΙΔΙΟΥ είδους', () => {
    expect(readSpacePositionDeclaration('parking', 'pilotis')).toBe('pilotis');
    expect(readSpacePositionDeclaration('storage', 'pilotis')).toBeNull();
    expect(readSpacePositionDeclaration('storage', 'basementYardEntrance')).toBe('basementYardEntrance');
  });
});
