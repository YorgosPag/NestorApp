/**
 * Firestore equality guard — SSoT module tests (ADR-361)
 *
 * Covers the pure logic of `firestore-equality.ts` exhaustively. Service
 * integration is covered separately in `firestore-query-equality.test.ts`.
 *
 * Coverage targets (Google Presubmit Pattern):
 *  - statements ≥95%
 *  - branches   ≥95%
 *  - functions  100%
 */

import {
  defaultDocumentsEqual,
  defaultDocumentEqual,
  EqualitySlot,
} from '../firestore-equality';

// ===========================================================================
// defaultDocumentsEqual — array comparator
// ===========================================================================

describe('defaultDocumentsEqual', () => {
  it('returns false on first delivery (prev === null)', () => {
    expect(defaultDocumentsEqual(null, [])).toBe(false);
    expect(defaultDocumentsEqual(null, [{ id: 'a' }])).toBe(false);
  });

  it('returns true when prev and next are the same reference', () => {
    const arr: ReadonlyArray<{ id: string }> = [{ id: 'a' }, { id: 'b' }];
    expect(defaultDocumentsEqual(arr, arr)).toBe(true);
  });

  it('returns false when lengths differ', () => {
    expect(defaultDocumentsEqual([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }])).toBe(false);
    expect(defaultDocumentsEqual([{ id: 'a' }, { id: 'b' }], [{ id: 'a' }])).toBe(false);
  });

  it('returns true on deep-equal arrays with new references', () => {
    const prev = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }];
    const next = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }];
    expect(prev).not.toBe(next);
    expect(defaultDocumentsEqual(prev, next)).toBe(true);
  });

  it('returns false on differing scalar field', () => {
    const prev = [{ id: 'a', n: 1 }];
    const next = [{ id: 'a', n: 2 }];
    expect(defaultDocumentsEqual(prev, next)).toBe(false);
  });

  it('returns false on differing key set', () => {
    const prev = [{ id: 'a', n: 1 }];
    const next = [{ id: 'a', m: 1 }];
    expect(defaultDocumentsEqual(prev, next)).toBe(false);
  });

  it('handles empty arrays', () => {
    expect(defaultDocumentsEqual([], [])).toBe(true);
  });

  it('handles deeply nested objects', () => {
    const prev = [{ id: 'a', meta: { tags: ['x', 'y'], pos: { x: 1, y: 2 } } }];
    const next = [{ id: 'a', meta: { tags: ['x', 'y'], pos: { x: 1, y: 2 } } }];
    expect(defaultDocumentsEqual(prev, next)).toBe(true);

    const mutated = [{ id: 'a', meta: { tags: ['x', 'z'], pos: { x: 1, y: 2 } } }];
    expect(defaultDocumentsEqual(prev, mutated)).toBe(false);
  });

  it('handles Date objects (would mismatch under JSON.stringify if keys reorder)', () => {
    const d1 = new Date('2026-05-16T10:00:00Z');
    const d2 = new Date('2026-05-16T10:00:00Z');
    const d3 = new Date('2026-05-16T11:00:00Z');

    expect(defaultDocumentsEqual([{ id: 'a', ts: d1 }], [{ id: 'a', ts: d2 }])).toBe(true);
    expect(defaultDocumentsEqual([{ id: 'a', ts: d1 }], [{ id: 'a', ts: d3 }])).toBe(false);
  });

  it('handles null vs undefined consistently with dequal semantics', () => {
    const prev = [{ id: 'a', n: null }];
    const next = [{ id: 'a', n: null }];
    expect(defaultDocumentsEqual(prev, next)).toBe(true);
  });

  it('returns false when item order differs', () => {
    const prev = [{ id: 'a' }, { id: 'b' }];
    const next = [{ id: 'b' }, { id: 'a' }];
    expect(defaultDocumentsEqual(prev, next)).toBe(false);
  });
});

// ===========================================================================
// defaultDocumentEqual — single-doc comparator
// ===========================================================================

describe('defaultDocumentEqual', () => {
  it('returns false on first delivery (prev === undefined)', () => {
    expect(defaultDocumentEqual(undefined, null)).toBe(false);
    expect(defaultDocumentEqual(undefined, { id: 'a' })).toBe(false);
  });

  it('returns true on the same reference', () => {
    const doc = { id: 'a', n: 1 };
    expect(defaultDocumentEqual(doc, doc)).toBe(true);
  });

  it('returns true when both null (deleted doc, redelivered)', () => {
    expect(defaultDocumentEqual(null, null)).toBe(true);
  });

  it('returns false when prev exists and next is null (deletion)', () => {
    expect(defaultDocumentEqual({ id: 'a' }, null)).toBe(false);
  });

  it('returns false when prev is null and next exists (re-creation)', () => {
    expect(defaultDocumentEqual(null, { id: 'a' })).toBe(false);
  });

  it('returns true on deep-equal documents with new references', () => {
    const prev = { id: 'a', n: 1, sub: { tag: 't' } };
    const next = { id: 'a', n: 1, sub: { tag: 't' } };
    expect(prev).not.toBe(next);
    expect(defaultDocumentEqual(prev, next)).toBe(true);
  });

  it('returns false on differing field', () => {
    expect(defaultDocumentEqual({ id: 'a', n: 1 }, { id: 'a', n: 2 })).toBe(false);
  });
});

// ===========================================================================
// EqualitySlot — stateful guard slot
// ===========================================================================

describe('EqualitySlot', () => {
  it('first call always reports shouldSkip=false (initial state)', () => {
    const slot = new EqualitySlot<readonly { id: string }[]>();
    const skip = slot.shouldSkip([{ id: 'a' }], defaultDocumentsEqual);
    expect(skip).toBe(false);
  });

  it('second call with deep-equal content reports shouldSkip=true', () => {
    const slot = new EqualitySlot<readonly { id: string; n: number }[]>();
    slot.shouldSkip([{ id: 'a', n: 1 }], defaultDocumentsEqual);
    const skip2 = slot.shouldSkip([{ id: 'a', n: 1 }], defaultDocumentsEqual);
    expect(skip2).toBe(true);
  });

  it('reports shouldSkip=false when content differs from stored', () => {
    const slot = new EqualitySlot<readonly { id: string; n: number }[]>();
    slot.shouldSkip([{ id: 'a', n: 1 }], defaultDocumentsEqual);
    const skip = slot.shouldSkip([{ id: 'a', n: 2 }], defaultDocumentsEqual);
    expect(skip).toBe(false);
  });

  it('updates the stored value only when shouldSkip=false', () => {
    const slot = new EqualitySlot<readonly { id: string; n: number }[]>();

    slot.shouldSkip([{ id: 'a', n: 1 }], defaultDocumentsEqual); // first → store [n:1]
    slot.shouldSkip([{ id: 'a', n: 1 }], defaultDocumentsEqual); // skip — keep [n:1]
    const skipAfterChange = slot.shouldSkip([{ id: 'a', n: 2 }], defaultDocumentsEqual);
    expect(skipAfterChange).toBe(false);

    // Now stored is [n:2]. A new [n:2] should be skipped, [n:1] should not.
    expect(slot.shouldSkip([{ id: 'a', n: 2 }], defaultDocumentsEqual)).toBe(true);
    expect(slot.shouldSkip([{ id: 'a', n: 1 }], defaultDocumentsEqual)).toBe(false);
  });

  it('reset() returns slot to initial state — next call is always not-skipped', () => {
    const slot = new EqualitySlot<readonly { id: string }[]>();
    slot.shouldSkip([{ id: 'a' }], defaultDocumentsEqual);
    expect(slot.shouldSkip([{ id: 'a' }], defaultDocumentsEqual)).toBe(true);

    slot.reset();

    // After reset: same content is treated as first delivery → NOT skipped.
    // This is the super-admin switcher rebuild contract (ADR-354 entry #3):
    // the new tenant's first emission must always reach the consumer.
    expect(slot.shouldSkip([{ id: 'a' }], defaultDocumentsEqual)).toBe(false);
  });

  it('honours a custom comparator', () => {
    const slot = new EqualitySlot<{ id: string; meta: string }>();
    const idOnlyEqual = (
      prev: { id: string; meta: string } | null | undefined,
      next: { id: string; meta: string } | null,
    ): boolean => prev != null && next != null && prev.id === next.id;

    slot.shouldSkip({ id: 'a', meta: 'old' }, idOnlyEqual);
    // meta changed but custom comparator only checks id → skip
    expect(slot.shouldSkip({ id: 'a', meta: 'new' }, idOnlyEqual)).toBe(true);
    // id changed → not skipped
    expect(slot.shouldSkip({ id: 'b', meta: 'new' }, idOnlyEqual)).toBe(false);
  });

  it('supports single-doc slot with defaultDocumentEqual (null transitions)', () => {
    const slot = new EqualitySlot<{ id: string } | null>();

    expect(slot.shouldSkip({ id: 'a' }, defaultDocumentEqual)).toBe(false);
    expect(slot.shouldSkip({ id: 'a' }, defaultDocumentEqual)).toBe(true);
    expect(slot.shouldSkip(null, defaultDocumentEqual)).toBe(false); // delete
    expect(slot.shouldSkip(null, defaultDocumentEqual)).toBe(true);  // still deleted
    expect(slot.shouldSkip({ id: 'a' }, defaultDocumentEqual)).toBe(false); // re-create
  });

  it('isolates state across instances (concurrent subscribers)', () => {
    const slotA = new EqualitySlot<readonly { id: string }[]>();
    const slotB = new EqualitySlot<readonly { id: string }[]>();

    slotA.shouldSkip([{ id: 'a' }], defaultDocumentsEqual);
    // slotB is untouched — first call must NOT be skipped.
    expect(slotB.shouldSkip([{ id: 'a' }], defaultDocumentsEqual)).toBe(false);
  });
});
