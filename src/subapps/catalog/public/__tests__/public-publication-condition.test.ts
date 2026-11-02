/**
 * Η μία συνθήκη δημοσίευσης (ADR-923 §5.13): `unverified` σβήνει, «δεν μπόρεσα να ρωτήσω» δεν αγγίζει τίποτα.
 */

import {
  publicationConditionOf,
  publicModelActionOf,
  readPublicationCondition,
  rememberCondition,
  type KnownPublicationCondition,
  type PublicationCondition,
  type SupplierStandingRead,
} from '../public-publication-condition';

const VERIFIED: SupplierStandingRead = { kind: 'known', standing: { kind: 'verified', basis: 'registry' } };
const MANUAL: SupplierStandingRead = { kind: 'known', standing: { kind: 'verified', basis: 'manual-review' } };
const UNVERIFIED: SupplierStandingRead = { kind: 'known', standing: { kind: 'unverified' } };
const UNKNOWN: SupplierStandingRead = { kind: 'unknown' };

describe('publicationConditionOf', () => {
  it.each([
    [VERIFIED, 'open'],
    [MANUAL, 'open'],
    [UNVERIFIED, 'closed'],
    [UNKNOWN, 'unknown'],
  ] as const)('%j ⇒ %s', (read, expected) => {
    expect(publicationConditionOf(read)).toBe(expected);
  });
});

describe('readPublicationCondition', () => {
  it('αναγνώστης που πετά δίνει unknown, ποτέ closed', async () => {
    await expect(readPublicationCondition('c', async () => { throw new Error('5xx'); })).resolves.toBe('unknown');
  });

  it('περνά τον χώρο στον αναγνώστη', async () => {
    const read = jest.fn(async () => VERIFIED);
    await expect(readPublicationCondition('comp-a', read)).resolves.toBe('open');
    expect(read).toHaveBeenCalledWith('comp-a');
  });
});

describe('publicModelActionOf', () => {
  it.each([
    ['open', true, 'set'],
    ['open', false, 'delete'],
    ['closed', true, 'delete'],
    ['closed', false, 'delete'],
    ['unknown', true, 'defer'],
    ['unknown', false, 'defer'],
  ] as const)('%s, ορατό %s ⇒ %s', (condition, visible, action) => {
    expect(publicModelActionOf(condition, visible)).toBe(action);
  });
});

describe('rememberCondition', () => {
  function walk(path: readonly PublicationCondition[], start: KnownPublicationCondition | null = null) {
    let seen = start;
    const changes: boolean[] = [];
    for (const step of path) {
      const memory = rememberCondition(seen, step);
      seen = memory.seen;
      changes.push(memory.changed);
    }
    return { seen, changes };
  }

  it('open → unknown → closed: η μετάβαση φτάνει παρά τη βλάβη', () => {
    expect(walk(['open', 'unknown', 'closed'])).toEqual({ seen: 'closed', changes: [true, false, true] });
  });

  it('open → unknown → open: καμία αλλαγή, η ανάνηψη δεν είναι μετάβαση', () => {
    expect(walk(['open', 'unknown', 'open'])).toEqual({ seen: 'open', changes: [true, false, false] });
  });

  it('το unknown δεν γράφεται ποτέ στη μνήμη, ούτε από το κενό', () => {
    expect(rememberCondition(null, 'unknown')).toEqual({ seen: null, changed: false });
    expect(rememberCondition('closed', 'unknown')).toEqual({ seen: 'closed', changed: false });
  });
});
