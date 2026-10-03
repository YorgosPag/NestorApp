/**
 * ⚓ ADR-903 §9 · ADR-900 §8 #2 (2β.3) — η ΜΙΑ διάταξη στάθμεων (σειρά Spitogatos) για ζήτηση, αναζήτηση, επιλογείς.
 */

import type { FloorRef } from '../floor-ref';
import {
  floorRangeOptions,
  levelBoundKey,
  levelBoundOfSelect,
  levelRangeInverted,
  levelRangeOf,
  levelRangePairs,
  levelSelectValue,
  parseLevelBoundKey,
  withinLevelRange,
  type LevelRange,
} from '../floor-level-range';

const at = (number: number, kind: FloorRef['kind'] = null): FloorRef =>
  ({ number, kind }) as FloorRef;

describe('withinLevelRange — σειρά Spitogatos', () => {
  it('«από ημιυπόγειο»: δέχεται ημιυπόγειο, ΑΠΟΚΛΕΙΕΙ υπόγειο (και τα δύο −1)', () => {
    const range: LevelRange = { min: { number: -1, kind: 'semi-basement' }, max: null };
    expect(withinLevelRange(at(-1, 'semi-basement'), range)).toBe(true);
    expect(withinLevelRange(at(-1, 'basement'), range)).toBe(false);
    expect(withinLevelRange(at(-1), range)).toBe(false); // −1 χωρίς είδος = υπόγειο
  });

  it('«από υπερυψωμένο»: αποκλείει ισόγειο και πυλωτή, δέχεται ημιώροφο και 1ο', () => {
    const range: LevelRange = { min: { number: 0, kind: 'raised-ground' }, max: null };
    expect(withinLevelRange(at(0, 'ground'), range)).toBe(false);
    expect(withinLevelRange(at(0, 'pilotis'), range)).toBe(false);
    expect(withinLevelRange(at(0, 'raised-ground'), range)).toBe(true);
    expect(withinLevelRange(at(0, 'mezzanine'), range)).toBe(true);
    expect(withinLevelRange(at(1), range)).toBe(true);
  });

  it('«έως ισόγειο»: η πυλωτή ≡ ισόγειο· το υπερυψωμένο μένει έξω', () => {
    const range: LevelRange = { min: null, max: { number: 0, kind: 'ground' } };
    expect(withinLevelRange(at(0, 'pilotis'), range)).toBe(true);
    expect(withinLevelRange(at(0, 'raised-ground'), range)).toBe(false);
  });

  it('🔑 άκρο ΧΩΡΙΣ είδος (ζήτηση πριν την 2β.3) = ολόκληρη η στάθμη — ίδια κρίση με τον παλιό ακέραιο', () => {
    const legacy: LevelRange = { min: { number: 0, kind: null }, max: { number: 0, kind: null } };
    for (const kind of ['ground', 'pilotis', 'raised-ground', 'mezzanine'] as const) {
      expect(withinLevelRange(at(0, kind), legacy)).toBe(true);
    }
    expect(withinLevelRange(at(-1, 'semi-basement'), legacy)).toBe(false);
    expect(withinLevelRange(at(1), legacy)).toBe(false);
  });

  it('στάθμη χωρίς αριθμό (δώμα παλιού κειμένου) ⇒ εκτός κάθε εύρους', () => {
    expect(withinLevelRange({ number: null, kind: 'roof' }, { min: null, max: null })).toBe(false);
  });
});

describe('levelRangeInverted', () => {
  it('«από υπερυψωμένο έως ισόγειο» είναι αντεστραμμένο· «από ισόγειο έως ισόγειο» όχι', () => {
    expect(levelRangeInverted({ min: { number: 0, kind: 'raised-ground' }, max: { number: 0, kind: 'ground' } })).toBe(true);
    expect(levelRangeInverted({ min: { number: 0, kind: null }, max: { number: 0, kind: null } })).toBe(false);
    expect(levelRangeInverted({ min: { number: 2, kind: null }, max: { number: 1, kind: null } })).toBe(true);
  });
});

describe('ζεύγη αποθήκευσης ⇄ εύρος', () => {
  it('απόν είδος (έγγραφο πριν την 2β.3) ⇒ ολόκληρη στάθμη', () => {
    expect(levelRangeOf({ floorMin: 0, floorMax: 3 })).toEqual({
      min: { number: 0, kind: null },
      max: { number: 3, kind: null },
    });
  });

  it('στρογγυλή διαδρομή — και τα τέσσερα πεδία, πάντα', () => {
    const range: LevelRange = { min: { number: -1, kind: 'semi-basement' }, max: null };
    expect(levelRangePairs(range)).toEqual({ floorMin: -1, floorMinKind: 'semi-basement', floorMax: null, floorMaxKind: null });
    expect(levelRangeOf(levelRangePairs(range))).toEqual(range);
  });
});

describe('κλειδί άκρου (URL)', () => {
  it('σκέτος ακέραιος (παλιός σύνδεσμος) ⇒ ολόκληρη στάθμη, και γράφεται ξανά ίδιος', () => {
    expect(parseLevelBoundKey('2')).toEqual({ number: 2, kind: null });
    expect(levelBoundKey({ number: 2, kind: null })).toBe('2');
  });

  it('επώνυμη στάθμη ⇄ κλειδί', () => {
    const bound = { number: 0, kind: 'raised-ground' } as const;
    expect(parseLevelBoundKey(levelBoundKey(bound))).toEqual(bound);
  });

  it.each(['', 'x', ':roof', '1.5', '0:nope'])('άκυρο %p ⇒ null', (key) => {
    expect(parseLevelBoundKey(key)).toBeNull();
  });
});

describe('επιλογές του επιλογέα εύρους', () => {
  const values = floorRangeOptions(null, 'min').map((o) => o.value);

  it('σειρά Spitogatos, ΜΙΑ επιλογή ανά βαθμίδα — η πυλωτή δεν είναι δεύτερο «ισόγειο»', () => {
    expect(values.slice(0, 7)).toEqual([
      '-3:basement', '-2:basement', '-1:basement', '-1:semi-basement', '0:ground', '0:raised-ground', '0:mezzanine',
    ]);
    expect(values).not.toContain('0:pilotis');
  });

  it('άκρο ολόκληρης στάθμης ⇒ χαμηλότερο στρώμα για «από», υψηλότερο για «έως»', () => {
    expect(levelSelectValue({ number: 0, kind: null }, 'min')).toBe('0:ground');
    expect(levelSelectValue({ number: 0, kind: null }, 'max')).toBe('0:mezzanine');
    expect(levelSelectValue({ number: -1, kind: null }, 'max')).toBe('-1:semi-basement');
  });

  it('τρέχουσα τιμή εκτός λίστας (35ος) εμφανίζεται — αλλιώς θα σβηνόταν', () => {
    expect(floorRangeOptions({ number: 35, kind: null }, 'max').map((o) => o.value)).toContain('35:standard');
  });

  it('η επιλογή φέρει ΠΑΝΤΑ είδος', () => {
    expect(levelBoundOfSelect('3:standard')).toEqual({ number: 3, kind: 'standard' });
    expect(levelBoundOfSelect('')).toBeNull();
  });
});
