/**
 * ⚓ Ο ΕΝΑΣ κανόνας μοναδικότητας της στοίβας ορόφων — κρίση εγγραφής ΚΑΙ ανίχνευση υπαρχόντων συγκρούσεων.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-10): στο «Κτήριο Α» βρέθηκαν δύο έγγραφα «Ισόγειο» (ίδιος αριθμός, ίδιο όνομα). Ο κανόνας
 * υπήρχε, αλλά (α) διέρρεε σε ταυτόχρονα αιτήματα, (β) δεν έκρινε όνομα, (γ) κανείς δεν ανίχνευε ό,τι είχε ήδη γραφτεί.
 */

import {
  conflictedFloorIds,
  findFloorStackConflicts,
  floorSlotKey,
  isFloorSlotErrorCode,
  isIntermediateStorey,
  judgeFloorSlot,
  normalizeFloorName,
  tooLowStoreyIds,
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
    expect(judgeFloorSlot(duplicated, candidate, { slot: false, name: false, elevation: false }, 'f0b')).toBeNull();
    expect(judgeFloorSlot(duplicated, candidate, { slot: true, name: false, elevation: false }, 'f0b')?.clash).toBe('number');
    expect(judgeFloorSlot(duplicated, candidate, { slot: false, name: true, elevation: false }, 'f0b')?.clash).toBe('name');
  });
  it('όροφος χωρίς όνομα δεν κρίνεται για όνομα', () => {
    expect(judgeFloorSlot([{ id: 'x', number: 0 }], { number: 1, name: '' })).toBeNull();
  });
});

describe('judgeFloorSlot — αφήνει το υψόμετρο ύψος ορόφου;', () => {
  const storey = (elevation: number | null, number = 2) => ({ number, kind: 'standard' as const, name: 'Νέος', elevation });

  it('🔴 ίδιο υψόμετρο με τον από κάτω ⇒ σύγκρουση `elevation` (όροφος ύψους μηδέν), με ποιον', () => {
    expect(judgeFloorSlot(building, storey(3))).toEqual({ clash: 'elevation', withFloorId: 'f1' });
  });
  it('🔴 αντεστραμμένο υψόμετρο (κάτω από τον από κάτω) ⇒ σύγκρουση — αρνητικό ύψος', () => {
    expect(judgeFloorSlot(building, storey(1))).toEqual({ clash: 'elevation', withFloorId: 'f1' });
  });
  it('🔴 στριμώχνει τον από ΠΑΝΩ: υπόγειο στο υψόμετρο του ισογείου', () => {
    expect(judgeFloorSlot(building, storey(0, -1))).toEqual({ clash: 'elevation', withFloorId: 'f0' });
  });
  it('το όριο: 9 cm ⇒ άρνηση, ακριβώς 10 cm ⇒ χωράει (σύγκριση στο χιλιοστό, χωρίς float drift)', () => {
    expect(judgeFloorSlot(building, storey(3.09))?.clash).toBe('elevation');
    expect(judgeFloorSlot(building, storey(3.1))).toBeNull();
    const drift: FloorSlotRow[] = [{ id: 'a', number: 0, kind: 'ground', elevation: 0.2 }];
    expect(judgeFloorSlot(drift, { number: 1, kind: 'standard', elevation: 0.3 })).toBeNull(); // 0.3 − 0.2 = 0.0999…
  });
  it('κρίνεται ο ΠΛΗΣΙΕΣΤΕΡΟΣ μετρούμενος κατά αριθμό — η ειδική στάθμη ανάμεσα δεν μετρά', () => {
    expect(judgeFloorSlot(building, storey(6))).toBeNull(); // το δώμα (ειδική) είναι στο 6
  });
  it('ειδική στάθμη ή άγνωστο υψόμετρο ⇒ δεν κρίνεται', () => {
    expect(judgeFloorSlot(building, { number: 5, kind: 'stair-penthouse', name: 'SP', elevation: 3 })).toBeNull();
    expect(judgeFloorSlot(building, storey(null))).toBeNull();
  });
  it('κρίνεται ΜΟΝΟ όταν αλλάζει — παλαιό στρίμωγμα δεν μπλοκάρει μετονομασία', () => {
    expect(judgeFloorSlot(building, storey(3), { slot: false, name: true, elevation: false })).toBeNull();
  });
  it('η μοναδικότητα προηγείται: πιασμένος αριθμός στο ίδιο υψόμετρο ⇒ `number`', () => {
    expect(judgeFloorSlot(building, storey(0, 0))?.clash).toBe('number');
  });
});

describe('findFloorStackConflicts — ό,τι γράφτηκε έξω από το σύνορο', () => {
  it('καθαρή στοίβα ⇒ καμία σύγκρουση', () => {
    expect(findFloorStackConflicts(building)).toEqual([]);
    expect(conflictedFloorIds(building).size).toBe(0);
  });
  it('🔴 το περιστατικό: δύο «Ισόγειο», ίδιος αριθμός, ίδιο όνομα — και ο ένας χωρίς ύψος', () => {
    const incident: FloorSlotRow[] = [
      { id: 'flr_5c28', number: 0, name: 'Ισόγειο', kind: 'standard', elevation: 0 },
      { id: 'flr_690f', number: 0, name: 'Ισόγειο', kind: 'standard', elevation: 0 },
    ];
    expect(findFloorStackConflicts(incident)).toEqual([
      { clash: 'number', floorIds: ['flr_5c28', 'flr_690f'] },
      { clash: 'name', floorIds: ['flr_5c28', 'flr_690f'] },
      { clash: 'elevation', floorIds: ['flr_5c28', 'flr_690f'] },
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

describe('όροφος χωρίς ύψος — σύγκρουση `elevation` (ως τις 2026-10-10: προειδοποίηση «επιτρέπεται»)', () => {
  const rows: FloorSlotRow[] = [
    { id: 'a', number: 0, kind: 'ground', elevation: 0 },
    { id: 'b', number: 1, kind: 'standard', elevation: 0.00005 },
    { id: 'c', number: 2, kind: 'standard', elevation: 3 },
    { id: 'r', number: 3, kind: 'roof', elevation: 3 },
    { id: 'n', number: 4, kind: 'standard', elevation: null },
  ];

  it('🔴 δύο διαδοχικοί μετρούμενοι στο ίδιο υψόμετρο ⇒ σύγκρουση· οι ειδικές στάθμες και τα `null` εξαιρούνται', () => {
    expect(findFloorStackConflicts(rows)).toEqual([{ clash: 'elevation', floorIds: ['a', 'b'] }]);
  });
  it('χωρίς ύψος είναι ο ΚΑΤΩ του ζεύγους — αυτουνού το παράγωγο ύψος δείχνει ο πίνακας', () => {
    expect([...tooLowStoreyIds(rows)]).toEqual(['a']);
  });
  it('🔴 αντεστραμμένα υψόμετρα (ο 1ος κάτω από το ισόγειο) ⇒ σύγκρουση', () => {
    const inverted: FloorSlotRow[] = [
      { id: 'g', number: 0, kind: 'ground', elevation: 3 },
      { id: 'u', number: 1, kind: 'standard', elevation: 0 },
    ];
    expect(findFloorStackConflicts(inverted)).toEqual([{ clash: 'elevation', floorIds: ['g', 'u'] }]);
  });
  it('🔑 ο όροφος χωρίς ύψος ΔΕΝ είναι «διπλός» — το σήμα του θεατή μένει για τη μοναδικότητα', () => {
    expect(conflictedFloorIds(rows).size).toBe(0);
  });
});

describe('isFloorSlotErrorCode', () => {
  it('αναγνωρίζει μόνο τις αρνήσεις μοναδικότητας', () => {
    expect(isFloorSlotErrorCode('FLOOR_NUMBER_TAKEN')).toBe(true);
    expect(isFloorSlotErrorCode('FLOOR_NAME_TAKEN')).toBe(true);
    expect(isFloorSlotErrorCode('FLOOR_STOREY_TOO_LOW')).toBe(true);
    expect(isFloorSlotErrorCode('VERSION_CONFLICT')).toBe(false);
    expect(isFloorSlotErrorCode(undefined)).toBe(false);
  });
});
