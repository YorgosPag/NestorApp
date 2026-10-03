/**
 * ⚓ ADR-903 §6 — φιλοξενία σε όροφο: το σύνορο ανάγνωσης, η απόκλιση, η πρόθεση PATCH.
 */

import {
  hostedCopyDrift,
  hostedCopyOf,
  hostedFloorNumber,
  planHostedFloorIntent,
  readHostedFloor,
  UNHOSTED,
} from '../hosted-floor';
import {
  buildFloorIndex,
  planHostedFloorBackfill,
} from '../plan-hosted-floor-backfill';

describe('hostedCopyOf — το αντίγραφο από το έγγραφο ορόφου', () => {
  it('αριθμός + είδος (πυλωτή ≠ ισόγειο)', () => {
    expect(hostedCopyOf({ id: 'f0', number: 0, kind: 'pilotis' })).toEqual({ floorId: 'f0', floor: 0, floorKind: 'pilotis' });
  });
  it('άκυρο είδος ⇒ `null` (συνάγεται από τον αριθμό)', () => {
    expect(hostedCopyOf({ id: 'f1', number: 1, kind: 'κάτι' })).toEqual({ floorId: 'f1', floor: 1, floorKind: null });
  });
});

describe('readHostedFloor — ο ΕΝΑΣ αναγνώστης των mappers', () => {
  it('νέο σχήμα: αριθμός + είδος περνούν αυτούσια', () => {
    expect(readHostedFloor({ floorId: 'f', floor: -1, floorKind: 'basement' })).toEqual({ floorId: 'f', floor: -1, floorKind: 'basement' });
  });
  it.each([
    ['Υπόγειο -1', -1, 'basement'],
    ['basement-2', -2, 'basement'],
    ['Ισόγειο', 0, 'ground'],
    ['Πυλωτή', 0, 'pilotis'],
    ['-1', -1, null],
  ])('παλιό κείμενο %p ⇒ %p / %p μέσω του parser', (floor, number, kind) => {
    expect(readHostedFloor({ floor })).toEqual({ floorId: null, floor: number, floorKind: kind });
  });
  it('🔴 άγνωστο κείμενο ⇒ `null`, ΠΟΤΕ σιωπηλό ισόγειο', () => {
    expect(readHostedFloor({ floor: 'κάπου εκεί' })).toEqual(UNHOSTED);
    expect(hostedFloorNumber({ floor: 'κάπου εκεί' })).toBeNull();
  });
  it('κενό `floorId` ⇒ `null`', () => {
    expect(readHostedFloor({ floorId: '' }).floorId).toBeNull();
  });
});

describe('hostedCopyDrift — η μία ερώτηση του cascade, της μετανάστευσης και του --verify', () => {
  const expected = { floorId: 'f', floor: 2, floorKind: 'standard' as const };
  it('συμφωνεί ⇒ `null` (ιδεμποτία)', () => {
    expect(hostedCopyDrift({ floorId: 'f', floor: 2, floorKind: 'standard' }, expected)).toBeNull();
  });
  it('μόνο τα πεδία που διαφέρουν', () => {
    expect(hostedCopyDrift({ floorId: 'f', floor: 1, floorKind: 'standard' }, expected)).toEqual({ floor: 2 });
  });
  it('απόν ≡ `null`', () => {
    expect(hostedCopyDrift({}, UNHOSTED)).toBeNull();
  });
});

describe('planHostedFloorIntent — τι ζητά το PATCH', () => {
  const existing = { buildingId: 'b1', floorId: 'f1' };
  it('`floorId` ⇒ επίλυση στο αποθηκευμένο κτίριο', () => {
    expect(planHostedFloorIntent({ floorId: ' f2 ' }, existing)).toEqual({ kind: 'resolve', floorId: 'f2', buildingId: 'b1' });
  });
  it('`floorId` + νέο κτίριο ⇒ επίλυση στο ΝΕΟ κτίριο', () => {
    expect(planHostedFloorIntent({ floorId: 'f9', buildingId: 'b2' }, existing)).toEqual({ kind: 'resolve', floorId: 'f9', buildingId: 'b2' });
  });
  it.each([null, ''])('`floorId: %p` ⇒ καθαρισμός', (floorId) => {
    expect(planHostedFloorIntent({ floorId }, existing)).toEqual({ kind: 'clear' });
  });
  it('🔴 αλλαγή κτιρίου χωρίς όροφο ⇒ καθαρισμός (ο όροφος ανήκε στο παλιό)', () => {
    expect(planHostedFloorIntent({ buildingId: 'b2' }, existing)).toEqual({ kind: 'clear' });
    expect(planHostedFloorIntent({ buildingId: null }, existing)).toEqual({ kind: 'clear' });
  });
  it('ίδιο κτίριο / τίποτα ⇒ τίποτα', () => {
    expect(planHostedFloorIntent({ buildingId: 'b1' }, existing)).toEqual({ kind: 'keep' });
    expect(planHostedFloorIntent({ area: 3 }, existing)).toEqual({ kind: 'keep' });
  });
});

describe('planHostedFloorBackfill — μετανάστευση + ελεγκτής απόκλισης', () => {
  const index = buildFloorIndex([
    { id: 'b1-m1', data: { buildingId: 'b1', companyId: 'c1', number: -1, kind: 'basement' } },
    { id: 'b1-0', data: { buildingId: 'b1', companyId: 'c1', number: 0, kind: 'ground' } },
    { id: 'b1-pl', data: { buildingId: 'b1', companyId: 'c1', number: 0, kind: 'pilotis' } },
    { id: 'b1-r', data: { buildingId: 'b1', companyId: 'c1', number: 5, kind: 'roof' } },
    { id: 'b2-0', data: { buildingId: 'b2', companyId: 'c1', number: 0, kind: 'ground' } },
    { id: 'bx-0', data: { buildingId: 'bx', companyId: 'c2', number: 0, kind: 'ground' } },
    { id: 'broken', data: { buildingId: 'b1' } },
  ]);
  const doc = (extra: Record<string, unknown>) => ({ companyId: 'c1', buildingId: 'b1', ...extra });

  it('χωρίς όροφο (ανοιχτός χώρος) ⇒ noop', () => {
    expect(planHostedFloorBackfill(doc({}), index)).toEqual({ kind: 'noop' });
  });
  it('παλιό κείμενο ⇒ δένεται στον όροφο του ΙΔΙΟΥ κτιρίου', () => {
    expect(planHostedFloorBackfill(doc({ floor: 'Υπόγειο -1' }), index)).toEqual({
      kind: 'write', via: 'legacy', fields: { floorId: 'b1-m1', floor: -1, floorKind: 'basement' },
    });
  });
  it('το είδος ξεχωρίζει δύο ορόφους με τον ίδιο αριθμό (πυλωτή vs ισόγειο)', () => {
    expect(planHostedFloorBackfill(doc({ floor: 'Πυλωτή' }), index)).toMatchObject({ kind: 'write', fields: { floorId: 'b1-pl' } });
    expect(planHostedFloorBackfill(doc({ floor: 'Ισόγειο' }), index)).toMatchObject({ kind: 'write', fields: { floorId: 'b1-0' } });
  });
  it('επώνυμη στάθμη χωρίς αριθμό ⇒ ταίριασμα με είδος', () => {
    expect(planHostedFloorBackfill(doc({ floor: 'Δώμα' }), index)).toMatchObject({ kind: 'write', fields: { floorId: 'b1-r', floor: 5 } });
  });
  it('🔴 ίδιος αριθμός χωρίς είδος να ξεχωρίσει ⇒ ambiguous, ΔΕΝ μαντεύει', () => {
    expect(planHostedFloorBackfill(doc({ floor: 0 }), index)).toMatchObject({ kind: 'unresolved', reason: 'ambiguous' });
  });
  it.each([
    [{ floor: 'κάπου' }, 'unparseable'],
    [{ floor: 3 }, 'no-matching-floor'],
    [{ floor: '-1', buildingId: null }, 'no-building'],
    [{ floorId: 'nope' }, 'missing-floor'],
    [{ floorId: 'b2-0' }, 'foreign-floor'],
    [{ floorId: 'bx-0', buildingId: 'bx' }, 'foreign-floor'],
  ])('%p ⇒ unresolved %p (αναφέρεται, δεν γράφεται)', (extra, reason) => {
    expect(planHostedFloorBackfill(doc(extra), index)).toMatchObject({ kind: 'unresolved', reason });
  });
  it('`floorId` με μπαγιάτικο αντίγραφο ⇒ γράφει μόνο την απόκλιση', () => {
    expect(planHostedFloorBackfill(doc({ floorId: 'b1-0', floor: 1, floorKind: 'ground' }), index)).toEqual({
      kind: 'write', via: 'floorId', fields: { floor: 0 },
    });
  });
  it('ήδη συγχρονισμένο ⇒ noop (δεύτερο τρέξιμο = καμία γραφή)', () => {
    expect(planHostedFloorBackfill(doc({ floorId: 'b1-0', floor: 0, floorKind: 'ground' }), index)).toEqual({ kind: 'noop' });
  });
  it('άκυρος όροφος (χωρίς αριθμό) δεν μπαίνει στο ευρετήριο', () => {
    expect(index.byId.has('broken')).toBe(false);
  });
});
