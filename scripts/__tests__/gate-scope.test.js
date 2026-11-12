/**
 * ADR-924 §9 — ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΕΜΒΕΛΕΙΑΣ ΕΙΣΟΔΩΝ.
 *
 * Κρίνεται το fail-closed: η παράλειψη πυλών επιτρέπεται ΜΟΝΟ όταν κάθε αλλαγή του commit ανήκει σε δηλωμένη
 * κλάση. Κάθε άλλη περίπτωση (άγνωστο αρχείο, διαγραφή κώδικα, κενό commit, κώδικας σε υποφάκελο handoff)
 * πρέπει να δίνει πλήρη εκτέλεση.
 */

'use strict';

const { isHandoffDocument } = require('../lib/agent-worktree/config');
const { PATH_CLASSES } = require('../lib/gate-scope/registry');
const { describeSkip, resolveGateScope, unknownReaders } = require('../lib/gate-scope/resolve');

const HANDOFF_A = 'docs/handoffs/2026-11-12-next.md';
const HANDOFF_B = 'HANDOFFS/2026-11-12_ADR-924_next.md';
const CODE = 'src/services/foo.ts';

describe('isHandoffDocument — ταυτότητα handoff (SSoT)', () => {
  it.each([HANDOFF_A, HANDOFF_B, 'HANDOFFS\\windows-style.md'])('handoff: %s', (file) => {
    expect(isHandoffDocument(file)).toBe(true);
  });

  it.each([
    'HANDOFFS/2026-10-13_ADR-911_mutation-harness/run.js',
    'HANDOFFS/sub/nested.md',
    'docs/handoffs/notes.txt',
    'docs/handoffs/.md',
    'docs/HANDOFFS.md',
    'docs/centralized-systems/reference/adrs/ADR-924-gate-commit-view.md',
    'CLAUDE.md',
    'handoff.md',
  ])('ΟΧΙ handoff: %s', (file) => {
    expect(isHandoffDocument(file)).toBe(false);
  });
});

describe('resolveGateScope — fail-closed', () => {
  it('μόνο handoffs ⇒ εμβέλεια με μόνους αναγνώστες τους δηλωμένους', () => {
    const scope = resolveGateScope([HANDOFF_A, HANDOFF_B]);
    expect(scope.scoped).toBe(true);
    expect(scope.classes).toEqual([{ id: 'handoff', notice: 'commit μόνο με handoff', count: 2 }]);
    expect(scope.applies('10')).toBe(true);
    expect(scope.applies('3.109')).toBe(true);
    expect(scope.applies('3.87')).toBe(false);
    expect(scope.applies('3.66')).toBe(false);
  });

  it('handoff + ΕΝΑ αρχείο κώδικα ⇒ πλήρης εκτέλεση', () => {
    const scope = resolveGateScope([HANDOFF_A, CODE]);
    expect(scope.scoped).toBe(false);
    expect(scope.applies('3.87')).toBe(true);
  });

  it('handoff + διαγραφή κώδικα (η διαγραμμένη διαδρομή είναι στη λίστα) ⇒ πλήρης εκτέλεση', () => {
    expect(resolveGateScope([HANDOFF_A, 'src/lib/removed.ts']).scoped).toBe(false);
  });

  it('κανένα αρχείο ⇒ πλήρης εκτέλεση', () => {
    const scope = resolveGateScope([]);
    expect(scope.scoped).toBe(false);
    expect(scope.applies('3.87')).toBe(true);
  });

  it('κώδικας σε υποφάκελο του HANDOFFS ⇒ πλήρης εκτέλεση', () => {
    expect(resolveGateScope([HANDOFF_B, 'HANDOFFS/harness/run.js']).scoped).toBe(false);
  });

  it('ADR μαζί με handoff ⇒ πλήρης εκτέλεση (τα ADR δεν είναι κλάση)', () => {
    expect(resolveGateScope([HANDOFF_A, 'docs/centralized-systems/reference/adrs/ADR-924-x.md']).scoped).toBe(false);
  });
});

describe('ακεραιότητα του μητρώου', () => {
  it('κάθε κλάση δηλώνει notice, why και αναγνώστες με λόγο', () => {
    for (const cls of PATH_CLASSES) {
      expect(cls.notice.length).toBeGreaterThan(0);
      expect(cls.why.length).toBeGreaterThanOrEqual(40);
      expect(Object.keys(cls.readers).length).toBeGreaterThan(0);
      for (const reason of Object.values(cls.readers)) expect(reason.length).toBeGreaterThanOrEqual(40);
    }
  });

  it('αναγνώστης που ο δρομολογητής δεν ξέρει ⇒ αναφέρεται (ο καλών αρνείται)', () => {
    const scope = resolveGateScope([HANDOFF_A]);
    expect(unknownReaders(scope, ['10', '3.109', '3.87'])).toEqual([]);
    expect(unknownReaders(scope, ['3.109', '3.87'])).toEqual(['10']);
  });

  it('η αναφορά λέει ρητά τι παραλείφθηκε και πόσα αρχεία', () => {
    expect(describeSkip(resolveGateScope([HANDOFF_A]))).toBe('παραλείφθηκαν οι πύλες κώδικα: commit μόνο με handoff (1 αρχείο)');
    expect(describeSkip(resolveGateScope([HANDOFF_A, HANDOFF_B]))).toBe('παραλείφθηκαν οι πύλες κώδικα: commit μόνο με handoff (2 αρχεία)');
  });

  it('μετάλλαξη: κλάση χωρίς αναγνώστες ⇒ κανείς δεν εφαρμόζεται (απόδειξη ότι το φίλτρο κρίνει τη δήλωση)', () => {
    const mutated = [{ ...PATH_CLASSES[0], readers: {} }];
    const scope = resolveGateScope([HANDOFF_A], mutated);
    expect(scope.applies('10')).toBe(false);
  });
});
