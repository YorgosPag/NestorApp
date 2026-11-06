/**
 * ADR-931 §6.2 (Β2) — οι προτάσεις κοινοχρήστων από τη στοίβα ορόφων: κάθε κανόνας, «υπάρχει ήδη» ⇒ καμία πρόταση,
 * μόνιμη απόρριψη, σταθερά κλειδιά, ιδεμποτική προσθήκη απόρριψης.
 */

import {
  commonSpaceSuggestionKey,
  isCommonSpaceSuggestionKey,
  readDismissedCommonSpaceSuggestions,
  suggestMissingCommonSpaces,
  withDismissedCommonSpaceSuggestion,
  type CommonSpaceSuggestionInput,
  type SuggestionFloor,
} from '../common-space-suggestions';

const PILOTIS: SuggestionFloor = { id: 'flr_p', number: 0, kind: 'pilotis' };
const L1: SuggestionFloor = { id: 'flr_1', number: 1, kind: 'standard' };
const L2: SuggestionFloor = { id: 'flr_2', number: 2, kind: 'standard' };
const ROOF: SuggestionFloor = { id: 'flr_r', number: 3, kind: 'roof' };
const PENTHOUSE: SuggestionFloor = { id: 'flr_sp', number: 4, kind: 'stair-penthouse' };

const input = (patch: Partial<CommonSpaceSuggestionInput>): CommonSpaceSuggestionInput => ({
  floors: [], hasElevator: null, existing: [], dismissed: [], ...patch,
});

const keysOf = (patch: Partial<CommonSpaceSuggestionInput>) => suggestMissingCommonSpaces(input(patch)).map((s) => s.key);

describe('suggestMissingCommonSpaces — κανόνες', () => {
  it('χωρίς ορόφους ⇒ καμία πρόταση (ούτε με ανελκυστήρα)', () => {
    expect(keysOf({ hasElevator: true })).toEqual([]);
  });

  it('πυλωτή → πυλωτή στον όροφο · δώμα → δώμα στον όροφο', () => {
    expect(keysOf({ floors: [PILOTIS, ROOF] })).toEqual(['pilotis@flr_p', 'roof_terrace@flr_r']);
  });

  it('> 1 όροφος πάνω από το έδαφος → κλιμακοστάσιο όλου του κτιρίου· πυλωτή/δώμα δεν μετρούν', () => {
    expect(keysOf({ floors: [L1] })).toEqual([]);
    expect(keysOf({ floors: [PILOTIS, L1, ROOF] })).toEqual(['pilotis@flr_p', 'roof_terrace@flr_r']);
    const [stair] = suggestMissingCommonSpaces(input({ floors: [L1, L2] }));
    expect(stair).toEqual({ key: 'stairwell@building', category: 'stairwell', floorId: null, reason: { code: 'storeysAboveGround', count: 2 } });
  });

  it('παλιός όροφος χωρίς είδος ⇒ συνάγεται από τον αριθμό (υπόγειο δεν μετρά πάνω από το έδαφος)', () => {
    expect(keysOf({ floors: [{ id: 'b', number: -1 }, { id: 'g', number: 0 }] })).toEqual([]);
    expect(keysOf({ floors: [{ id: 'g', number: 0 }, { id: 'a', number: 1 }] })).toEqual(['stairwell@building']);
  });

  it('απόληξη → κλιμακοστάσιο· ο λόγος της απόληξης κερδίζει τον λόγο του πλήθους ορόφων (ένα κλειδί)', () => {
    const suggestions = suggestMissingCommonSpaces(input({ floors: [L1, L2, PENTHOUSE] }));
    expect(suggestions.map((s) => s.key)).toEqual(['stairwell@building']);
    expect(suggestions[0].reason.code).toBe('stairPenthouse');
  });

  it('ανελκυστήρας ΜΟΝΟ από `hasElevator === true`· `null`/`false` ⇒ τίποτα', () => {
    expect(keysOf({ floors: [L1], hasElevator: true })).toEqual(['elevator@building']);
    expect(keysOf({ floors: [L1], hasElevator: null })).toEqual([]);
    expect(keysOf({ floors: [L1], hasElevator: false })).toEqual([]);
  });

  it('ανελκυστήρας + απόληξη → μηχανοστάσιο στην απόληξη', () => {
    expect(keysOf({ floors: [L1, PENTHOUSE], hasElevator: true }))
      .toEqual(['stairwell@building', 'elevator_machine_room@flr_sp', 'elevator@building']);
  });

  it('η σειρά της στοίβας δεν εξαρτάται από τη σειρά εισόδου', () => {
    expect(keysOf({ floors: [ROOF, PILOTIS] })).toEqual(['pilotis@flr_p', 'roof_terrace@flr_r']);
  });
});

describe('suggestMissingCommonSpaces — «υπάρχει ήδη» και απόρριψη', () => {
  it('χώρος ίδιας κατηγορίας στον ίδιο όροφο ⇒ καμία πρόταση· σε άλλον όροφο ⇒ η πρόταση μένει', () => {
    expect(keysOf({ floors: [PILOTIS], existing: [{ category: 'pilotis', floorId: 'flr_p' }] })).toEqual([]);
    expect(keysOf({ floors: [PILOTIS], existing: [{ category: 'pilotis', floorId: 'flr_x' }] })).toEqual(['pilotis@flr_p']);
  });

  it('χώρος όλου του κτιρίου (χωρίς όροφο / `null`) καλύπτει και την πρόταση ορόφου', () => {
    expect(keysOf({ floors: [PILOTIS], existing: [{ category: 'pilotis' }] })).toEqual([]);
    expect(keysOf({ floors: [PILOTIS], existing: [{ category: 'pilotis', floorId: null }] })).toEqual([]);
  });

  it('πρόταση όλου του κτιρίου: αρκεί οποιοσδήποτε χώρος της κατηγορίας', () => {
    expect(keysOf({ floors: [L1, L2], existing: [{ category: 'stairwell', floorId: 'flr_1' }] })).toEqual([]);
  });

  it('απορριφθέν κλειδί ⇒ δεν ξαναπροτείνεται· τα υπόλοιπα μένουν', () => {
    expect(keysOf({ floors: [PILOTIS, ROOF], dismissed: ['pilotis@flr_p'] })).toEqual(['roof_terrace@flr_r']);
  });
});

describe('κλειδιά και λίστα απορρίψεων', () => {
  it('σταθερό κλειδί · έγκυρη μορφή', () => {
    expect(commonSpaceSuggestionKey('elevator', null)).toBe('elevator@building');
    expect(commonSpaceSuggestionKey('pilotis', 'flr_p')).toBe('pilotis@flr_p');
    expect(isCommonSpaceSuggestionKey('pilotis@flr_p')).toBe(true);
  });

  it.each([['nope@building'], ['pilotis@'], ['pilotis'], ['pilotis@a@b'], ['pilotis@a/b'], [42], [null]])(
    'άκυρο κλειδί %p ⇒ απορρίπτεται',
    (raw) => { expect(isCommonSpaceSuggestionKey(raw)).toBe(false); },
  );

  it('ανάγνωση: μη πίνακας ⇒ κενό· άκυρα και διπλά φεύγουν', () => {
    expect(readDismissedCommonSpaceSuggestions(undefined)).toEqual([]);
    expect(readDismissedCommonSpaceSuggestions(['pilotis@a', 'bad', 'pilotis@a', 7])).toEqual(['pilotis@a']);
  });

  it('η προσθήκη απόρριψης είναι ιδεμποτική', () => {
    const once = withDismissedCommonSpaceSuggestion([], 'pilotis@a');
    expect(withDismissedCommonSpaceSuggestion(once, 'pilotis@a')).toBe(once);
    expect(withDismissedCommonSpaceSuggestion(once, 'elevator@building')).toEqual(['pilotis@a', 'elevator@building']);
  });
});
