/**
 * ADR-916 Ο24 — το ημερολόγιο της άρσης διατήρησης ορφανών bytes: αλλοιωμένο ⇒ `pending` (ποτέ σιωπηλή εγκατάλειψη) ·
 * επανάληψη μόνο για λόγους που αλλάζουν · πρόθεση μόνο για πηγή ΑΠΟΥΣΑ με γνωστή θέση.
 */

import { orphanReleaseIntentOf, orphanReleaseOf, orphanReleaseRetryable } from '../handover-orphan-release-journal';

const AT = '2026-10-25T10:00:00.000Z';

describe('orphanReleaseOf', () => {
  it.each([[undefined], [null]])('%s ⇒ καμία πρόθεση', (raw) => {
    expect(orphanReleaseOf(raw)).toBeNull();
  });

  it.each([['string'], [{ state: 'άγνωστο' }], [{ state: 'kept', reason: 'άγνωστο' }], [[1]]])('🔴 αλλοιωμένο %j ⇒ `pending`', (raw) => {
    expect(orphanReleaseOf(raw)).toMatchObject({ state: 'pending', reason: null });
  });

  it('έγκυρο ⇒ αυτολεξεί', () => {
    expect(orphanReleaseOf({ state: 'kept', reason: 'claimed', since: AT, settledAt: AT })).toEqual({ state: 'kept', reason: 'claimed', since: AT, settledAt: AT });
  });
});

describe('orphanReleaseRetryable', () => {
  it.each([
    ['pending', null, true],
    ['kept', 'hold-evidence', true],
    ['kept', 'open-proof', true],
    ['kept', 'unreadable', true],
    ['kept', 'claimed', false],
    ['kept', 'foreign-object', false],
    ['kept', 'unrecognized-path', false],
    ['released', null, false],
    ['gone', null, false],
  ] as const)('%s / %s ⇒ %s', (state, reason, expected) => {
    expect(orphanReleaseRetryable({ state, reason, since: AT, settledAt: null })).toBe(expected);
  });

  it('χωρίς ημερολόγιο ⇒ ποτέ', () => {
    expect(orphanReleaseRetryable(null)).toBe(false);
  });
});

describe('orphanReleaseIntentOf', () => {
  it('🔴 πηγή απούσα + γνωστή θέση + καμία πρόθεση ⇒ `pending`', () => {
    expect(orphanReleaseIntentOf({}, false, true, AT)).toEqual({ state: 'pending', reason: null, since: AT, settledAt: null });
  });

  it.each([
    ['πηγή υπάρχει (ή είναι ξένη)', {}, true, true],
    ['άγνωστη θέση', {}, false, false],
    ['ήδη πρόθεση', { orphanRelease: { state: 'released', reason: null, since: AT, settledAt: AT } }, false, true],
    ['καμία γραμμή', undefined, false, true],
  ] as const)('%s ⇒ τίποτα', (_case, ledger, sourceExists, located) => {
    expect(orphanReleaseIntentOf(ledger, sourceExists, located, AT)).toBeNull();
  });
});
