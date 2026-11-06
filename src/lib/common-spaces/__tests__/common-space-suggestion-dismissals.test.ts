/**
 * ADR-931 §6.2 (Β2) — οι εγγραφές απόρριψης προτάσεων κοινοχρήστων: σχήμα με ποιος/πότε, ιδεμποτική απόρριψη και
 * επαναφορά, σχήμα σώματος επαναφοράς, και «απορριφθείσες που ισχύουν ακόμη» από τους ΙΔΙΟΥΣ κανόνες.
 */

import {
  dismissedCommonSpaceSuggestionKeys,
  MAX_DISMISSED_COMMON_SPACE_SUGGESTIONS,
  parseCommonSpaceSuggestionRestore,
  partitionCommonSpaceSuggestions,
  readDismissedCommonSpaceSuggestions,
  RESTORE_ALL_COMMON_SPACE_SUGGESTIONS,
  withDismissedCommonSpaceSuggestion,
  withoutDismissedCommonSpaceSuggestions,
  type DismissedCommonSpaceSuggestion,
} from '../common-space-suggestion-dismissals';
import type { SuggestionFloor } from '../common-space-suggestions';

const AT_1 = '2026-11-06T10:00:00.000Z';
const AT_2 = '2026-11-06T11:00:00.000Z';
const record = (key: string, dismissedAt = AT_1): DismissedCommonSpaceSuggestion => ({ key, dismissedBy: 'usr_a', dismissedAt });

const PILOTIS: SuggestionFloor = { id: 'flr_p', number: 0, kind: 'pilotis' };
const ROOF: SuggestionFloor = { id: 'flr_r', number: 1, kind: 'roof' };

describe('readDismissedCommonSpaceSuggestions', () => {
  it('μη πίνακας ⇒ κενό', () => {
    expect(readDismissedCommonSpaceSuggestions(undefined)).toEqual([]);
    expect(readDismissedCommonSpaceSuggestions({})).toEqual([]);
  });

  it('κρατά μόνο πλήρεις εγγραφές (κλειδί · ποιος · ISO πότε), μία ανά κλειδί — την πρώτη', () => {
    const raw = [
      record('pilotis@a'),
      'pilotis@b',
      { key: 'bad', dismissedBy: 'usr_a', dismissedAt: AT_1 },
      { key: 'pilotis@c', dismissedBy: '', dismissedAt: AT_1 },
      { key: 'pilotis@d', dismissedBy: 'usr_a', dismissedAt: 'yesterday' },
      record('pilotis@a', AT_2),
    ];
    expect(readDismissedCommonSpaceSuggestions(raw)).toEqual([record('pilotis@a')]);
    expect(dismissedCommonSpaceSuggestionKeys(raw)).toEqual(['pilotis@a']);
  });
});

describe('απόρριψη / επαναφορά — ιδεμποτικές', () => {
  it('δεύτερη απόρριψη του ίδιου κλειδιού ⇒ ίδια λίστα, κρατά την ΑΡΧΙΚΗ απόφαση', () => {
    const once = withDismissedCommonSpaceSuggestion([], record('pilotis@a'));
    expect(withDismissedCommonSpaceSuggestion(once, record('pilotis@a', AT_2))).toBe(once);
    expect(withDismissedCommonSpaceSuggestion(once, record('elevator@building')).map((r) => r.key)).toEqual(['pilotis@a', 'elevator@building']);
  });

  it('επαναφορά κλειδιών · άγνωστο κλειδί ⇒ ίδια αναφορά · «όλα» ⇒ κενό', () => {
    const list = [record('pilotis@a'), record('elevator@building')];
    expect(withoutDismissedCommonSpaceSuggestions(list, ['pilotis@a'])).toEqual([record('elevator@building')]);
    expect(withoutDismissedCommonSpaceSuggestions(list, ['roof_terrace@x'])).toBe(list);
    expect(withoutDismissedCommonSpaceSuggestions(list, RESTORE_ALL_COMMON_SPACE_SUGGESTIONS)).toEqual([]);
  });
});

describe('parseCommonSpaceSuggestionRestore', () => {
  it('«all» · έγκυρα κλειδιά (χωρίς διπλά)', () => {
    expect(parseCommonSpaceSuggestionRestore('all')).toBe(RESTORE_ALL_COMMON_SPACE_SUGGESTIONS);
    expect(parseCommonSpaceSuggestionRestore(['pilotis@a', 'pilotis@a'])).toEqual(['pilotis@a']);
  });

  it.each([[[]], [['bad']], ['pilotis@a'], [null], [Array.from({ length: MAX_DISMISSED_COMMON_SPACE_SUGGESTIONS + 1 }, (_, i) => `pilotis@f${i}`)]])(
    'άκυρο σώμα %#  ⇒ null',
    (raw) => { expect(parseCommonSpaceSuggestionRestore(raw)).toBeNull(); },
  );
});

describe('partitionCommonSpaceSuggestions', () => {
  const base = { floors: [PILOTIS, ROOF], hasElevator: null, existing: [] };

  it('απορριφθείσα που ισχύει ακόμη ⇒ στις απορριφθείσες με την απόφασή της· οι υπόλοιπες ανοιχτές', () => {
    const { open, dismissed } = partitionCommonSpaceSuggestions({ ...base, dismissed: [record('pilotis@flr_p')] });
    expect(open.map((s) => s.key)).toEqual(['roof_terrace@flr_r']);
    expect(dismissed.map((v) => [v.suggestion.key, v.dismissal.dismissedBy])).toEqual([['pilotis@flr_p', 'usr_a']]);
  });

  it('απόρριψη που δεν θα ξαναγινόταν πρόταση (όροφος που σβήστηκε · χώρος που υπάρχει) ⇒ δεν εμφανίζεται', () => {
    const { dismissed } = partitionCommonSpaceSuggestions({
      ...base,
      existing: [{ category: 'roof_terrace', floorId: 'flr_r' }],
      dismissed: [record('pilotis@flr_gone'), record('roof_terrace@flr_r')],
    });
    expect(dismissed).toEqual([]);
  });

  it('νεότερη απόφαση πρώτη', () => {
    const { dismissed } = partitionCommonSpaceSuggestions({
      ...base,
      dismissed: [record('pilotis@flr_p', AT_1), record('roof_terrace@flr_r', AT_2)],
    });
    expect(dismissed.map((v) => v.suggestion.key)).toEqual(['roof_terrace@flr_r', 'pilotis@flr_p']);
  });
});
