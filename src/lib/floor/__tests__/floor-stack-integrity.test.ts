/**
 * ⚓ Ο ΕΝΑΣ κανόνας μοναδικότητας της στοίβας ορόφων — κρίση εγγραφής ΚΑΙ ανίχνευση υπαρχόντων συγκρούσεων.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-10): στο «Κτήριο Α» βρέθηκαν δύο έγγραφα «Ισόγειο» (ίδιος αριθμός, ίδιο όνομα). Ο κανόνας
 * υπήρχε, αλλά (α) διέρρεε σε ταυτόχρονα αιτήματα, (β) δεν έκρινε όνομα, (γ) κανείς δεν ανίχνευε ό,τι είχε ήδη γραφτεί.
 */

import {
  conflictedFloorIds,
  findFloorStackConflicts,
  findSameElevationGroups,
  floorSlotKey,
  isFloorSlotErrorCode,
  isIntermediateStorey,
  judgeFloorSlot,
  normalizeFloorName,
  sameElevationPeersOf,
  type FloorSlotRow,
} from '../floor-stack-integrity';

const building: FloorSlotRow[] = [
  { id: 'fnd', number: -1, name: 'F', kind: 'foundation', elevation: -1.2 },
  { id: 'f0', number: 0, name: 'Ισόγειο', kind: 'ground', elevation: 0 },
  { id: 'f1', number: 1, name: '1ος Όροφος', kind: 'standard', elevation: 3 },
  { id: 'roof', number: 2, name: 'Δώμα', kind: 'roof', elevation: 6 },
];

describe('floorSlotKey — η θέση που πιάνει ένας όροφος', () => {
  it('μετρούμενος ⇒ ο αριθμός· ειδική στάθμη ⇒ το είδος', () => {
    expect(floorSlotKey({ number: 1, kind: 'standard' })).toBe('number:1');
    expect(floorSlotKey({ number: 5, kind: 'roof' })).toBe('kind:roof');
  });
  it('παλαιό έγγραφο χωρίς `kind` μετρά ως όροφος', () => {
    expect(floorSlotKey({ number: 0 })).toBe('number:0');
  });
});

describe('normalizeFloorName', () => {
  it('αγνοεί τόνους, πεζά/κεφαλαία και περιττά κενά', () => {
    expect(normalizeFloorName('  ΙΣΟΓΕΙΟ ')).toBe(normalizeFloorName('Ισόγειο'));
    expect(normalizeFloorName('1ος   Όροφος')).toBe(normalizeFloorName('1ος όροφος'));
  });
  it('μη-κείμενο ή κενό ⇒ κενό (δεν κρίνεται)', () => {
    expect(normalizeFloorName(undefined)).toBe('');
    expect(normalizeFloorName('   ')).toBe('');
  });
});

describe('judgeFloorSlot — χωράει;', () => {
  it('ελεύθερος αριθμός και όνομα ⇒ χωράει', () => {
    expect(judgeFloorSlot(building, { number: 2, kind: 'standard', name: '2ος Όροφος' })).toBeNull();
  });
  it('🔴 πιασμένος αριθμός μετρούμενου ⇒ σύγκρουση `number`, με ποιον', () => {
    expect(judgeFloorSlot(building, { number: 0, kind: 'standard', name: 'Άλλο' })).toEqual({ clash: 'number', withFloorId: 'f0' });
  });
  it('δεύτερη ειδική στάθμη ίδιου είδους ⇒ σύγκρουση `kind`', () => {
    expect(judgeFloorSlot(building, { number: 9, kind: 'roof', name: 'Δώμα Β' })).toEqual({ clash: 'kind', withFloorId: 'roof' });
  });
  it('ειδική στάθμη μοιράζεται νόμιμα αριθμό με μετρούμενο (θεμελίωση −1 / υπόγειο −1)', () => {
    expect(judgeFloorSlot(building, { number: -1, kind: 'basement', name: 'Υπόγειο' })).toBeNull();
    expect(judgeFloorSlot(building, { number: 0, kind: 'stair-penthouse', name: 'SP' })).toBeNull();
  });
  it('🔴 ίδιο όνομα με άλλον όροφο (με άλλους τόνους/κεφαλαία) ⇒ σύγκρουση `name`', () => {
    expect(judgeFloorSlot(building, { number: 7, kind: 'standard', name: 'ΙΣΟΓΕΙΟ' })).toEqual({ clash: 'name', withFloorId: 'f0' });
  });
  it('επεξεργασία: ο όροφος δεν συγκρούεται με τον εαυτό του', () => {
    expect(judgeFloorSlot(building, { number: 1, kind: 'standard', name: '1ος Όροφος' }, undefined, 'f1')).toBeNull();
  });
  it('κρίνεται ΜΟΝΟ ό,τι αλλάζει — παλαιά σύγκρουση δεν μπλοκάρει άσχετη αλλαγή', () => {
    const duplicated: FloorSlotRow[] = [...building, { id: 'f0b', number: 0, name: 'Ισόγειο', kind: 'standard' }];
    const candidate = { number: 0, kind: 'standard' as const, name: 'Ισόγειο' };
    expect(judgeFloorSlot(duplicated, candidate, { slot: false, name: false }, 'f0b')).toBeNull();
    expect(judgeFloorSlot(duplicated, candidate, { slot: true, name: false }, 'f0b')?.clash).toBe('number');
    expect(judgeFloorSlot(duplicated, candidate, { slot: false, name: true }, 'f0b')?.clash).toBe('name');
  });
  it('όροφος χωρίς όνομα δεν κρίνεται για όνομα', () => {
    expect(judgeFloorSlot([{ id: 'x', number: 0 }], { number: 1, name: '' })).toBeNull();
  });
});

describe('findFloorStackConflicts — ό,τι γράφτηκε έξω από το σύνορο', () => {
  it('καθαρή στοίβα ⇒ καμία σύγκρουση', () => {
    expect(findFloorStackConflicts(building)).toEqual([]);
    expect(conflictedFloorIds(building).size).toBe(0);
  });
  it('🔴 το περιστατικό: δύο «Ισόγειο», ίδιος αριθμός και ίδιο όνομα', () => {
    const incident: FloorSlotRow[] = [
      { id: 'flr_5c28', number: 0, name: 'Ισόγειο', kind: 'standard', elevation: 0 },
      { id: 'flr_690f', number: 0, name: 'Ισόγειο', kind: 'standard', elevation: 0 },
    ];
    expect(findFloorStackConflicts(incident)).toEqual([
      { clash: 'number', floorIds: ['flr_5c28', 'flr_690f'] },
      { clash: 'name', floorIds: ['flr_5c28', 'flr_690f'] },
    ]);
    expect([...conflictedFloorIds(incident)].sort()).toEqual(['flr_5c28', 'flr_690f']);
  });
  it('δύο δώματα ⇒ σύγκρουση `kind`· θεμελίωση + υπόγειο στον ίδιο αριθμό ⇒ όχι σύγκρουση', () => {
    const rows: FloorSlotRow[] = [
      ...building,
      { id: 'roof2', number: 3, name: 'Δώμα 2', kind: 'roof' },
      { id: 'bsm', number: -1, name: 'Υπόγειο', kind: 'basement' },
    ];
    expect(findFloorStackConflicts(rows)).toEqual([{ clash: 'kind', floorIds: ['roof', 'roof2'] }]);
  });
});

describe('isIntermediateStorey', () => {
  const stack: FloorSlotRow[] = [
    { id: 'b', number: -1, kind: 'basement' },
    { id: 'g', number: 0, kind: 'ground' },
    { id: 'u', number: 1, kind: 'standard' },
    { id: 'sp', number: 2, kind: 'stair-penthouse' },
  ];
  it('μετρούμενος με μετρούμενο πάνω και κάτω ⇒ ενδιάμεσος', () => {
    expect(isIntermediateStorey(stack, 'g')).toBe(true);
  });
  it('ο πάνω μετρούμενος δεν σφηνώνεται από ειδική στάθμη· η ειδική στάθμη ποτέ', () => {
    expect(isIntermediateStorey(stack, 'u')).toBe(false);
    expect(isIntermediateStorey(stack, 'sp')).toBe(false);
  });
  it('🔑 διπλότυπο στη μέση ΔΕΝ είναι ενδιάμεσο — αλλιώς δεν θα μπορούσε να σβηστεί ποτέ', () => {
    expect(isIntermediateStorey([...stack, { id: 'g2', number: 0, kind: 'standard' }], 'g2')).toBe(false);
  });
});

describe('ίδιο υψόμετρο — προειδοποίηση, όχι σύγκρουση', () => {
  it('δύο μετρούμενοι στο ίδιο υψόμετρο ⇒ ομάδα· οι ειδικές στάθμες και τα `null` εξαιρούνται', () => {
    const rows: FloorSlotRow[] = [
      { id: 'a', number: 0, kind: 'ground', elevation: 0 },
      { id: 'b', number: 1, kind: 'standard', elevation: 0.00005 },
      { id: 'c', number: 2, kind: 'standard', elevation: 3 },
      { id: 'r', number: 3, kind: 'roof', elevation: 3 },
      { id: 'n', number: 4, kind: 'standard', elevation: null },
    ];
    expect(findSameElevationGroups(rows)).toEqual([['a', 'b']]);
    expect(sameElevationPeersOf(rows, 'b')).toEqual(['a']);
    expect(sameElevationPeersOf(rows, 'c')).toEqual([]);
  });
});

describe('isFloorSlotErrorCode', () => {
  it('αναγνωρίζει μόνο τις αρνήσεις μοναδικότητας', () => {
    expect(isFloorSlotErrorCode('FLOOR_NUMBER_TAKEN')).toBe(true);
    expect(isFloorSlotErrorCode('FLOOR_NAME_TAKEN')).toBe(true);
    expect(isFloorSlotErrorCode('VERSION_CONFLICT')).toBe(false);
    expect(isFloorSlotErrorCode(undefined)).toBe(false);
  });
});
