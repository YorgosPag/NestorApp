/**
 * @jest-environment node
 *
 * Άγκυρα — **ΕΝΑΣ ΣΥΓΓΡΑΦΕΑΣ ΤΟΥ «ΔΙΑΒΑΣΤΗΚΕ»** (ADR-848): ιδιοκτησία ανά έγγραφο,
 * καμία σιωπηλή περικοπή στις 10 (το παλιό `where('__name__', 'in', …)`).
 *
 * ADR-939 §6.1 6Γ — **ΕΝΑ σχήμα**: `delivery.state = 'seen'` (όχι `seen: true`, που κανείς στο κουδούνι δεν
 * διάβαζε), και **μόνο** από αδιάβαστη κατάσταση, μέσα σε συναλλαγή.
 */

jest.mock('server-only', () => ({}));

const SERVER_TIME = { sentinel: 'serverTimestamp' };
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => SERVER_TIME },
}));

const mockUpdate = jest.fn();
const mockGetAll = jest.fn();
const mockRunTransaction = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({ doc: (id: string) => ({ id }) }),
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) => mockRunTransaction(fn),
  }),
}));

import { MAX_IDS_PER_MARK, markNotificationsSeen, seenUpdateFor } from '@/server/notifications/notification-read';

interface StoredDoc {
  readonly userId: string;
  readonly delivery?: { readonly state: string };
}

/** Η βάση: `docs[id]` = το έγγραφο, `null` = δεν υπάρχει. */
function stored(docs: Record<string, StoredDoc | null>): void {
  mockGetAll.mockImplementation(async (...refs: Array<{ id: string }>) =>
    refs.map((ref) => ({
      id: ref.id,
      ref,
      exists: docs[ref.id] !== null && docs[ref.id] !== undefined,
      data: () => docs[ref.id] ?? undefined,
    })),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ getAll: mockGetAll, update: mockUpdate }),
  );
});

const mine = (state?: string): StoredDoc => (state ? { userId: 'u1', delivery: { state } } : { userId: 'u1' });

describe('markNotificationsSeen', () => {
  it('Α1 🔑 — σημειώνει ΜΟΝΟ τις δικές σου· οι ξένες επιστρέφονται ονομαστικά', async () => {
    stored({ mine: mine('delivered'), theirs: { userId: 'u2' }, gone: null });

    const outcome = await markNotificationsSeen('u1', ['mine', 'theirs', 'gone']);

    expect(outcome).toEqual({ marked: ['mine'], refused: ['theirs'] });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({ id: 'mine' }, { 'delivery.state': 'seen', seenAt: SERVER_TIME });
  });

  it('Α2 🔴 — 12 ταυτότητες ⇒ 12 ελέγχονται (το παλιό `in` έκοβε σιωπηλά στις 10)', async () => {
    const ids = Array.from({ length: 12 }, (_, index) => `n${index}`);
    stored(Object.fromEntries(ids.map((id) => [id, mine()])));

    const outcome = await markNotificationsSeen('u1', ids);
    expect(outcome.marked).toHaveLength(12);
  });

  it('Α3 — διπλότυπα και κενά πετιούνται· πάνω από το όριο κόβεται ΡΗΤΑ', async () => {
    stored({});
    await markNotificationsSeen('u1', ['a', 'a', '', ...Array.from({ length: 80 }, (_, i) => `x${i}`)]);
    expect(mockGetAll.mock.calls[0]).toHaveLength(MAX_IDS_PER_MARK);
  });

  it('Α4 — τίποτα προς σημείωση ⇒ καμία εγγραφή', async () => {
    stored({ theirs: { userId: 'u2' } });
    await markNotificationsSeen('u1', ['theirs']);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('Α5 🔴 — ΠΟΤΕ υποβάθμιση acted, ΠΟΤΕ αναβίωση dismissed/withdrawn· ιδεμποτικό στο seen (6Γ)', async () => {
    stored({ a: mine('acted'), d: mine('dismissed'), w: mine('withdrawn'), s: mine('seen'), q: mine('queued') });

    const outcome = await markNotificationsSeen('u1', ['a', 'd', 'w', 's', 'q']);

    expect(outcome.marked).toEqual(['a', 'd', 'w', 's', 'q']);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({ id: 'q' }, expect.objectContaining({ 'delivery.state': 'seen' }));
  });

  it('Α6 — ανάγνωση και εγγραφή στην ΙΔΙΑ συναλλαγή', async () => {
    stored({ mine: mine('delivered') });
    await markNotificationsSeen('u1', ['mine']);
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('seenUpdateFor', () => {
  it('Β1 — έγγραφο χωρίς delivery διαβάζεται `delivered` ⇒ σημειώνεται (όπως το `toNotification`)', () => {
    expect(seenUpdateFor({ userId: 'u1' })).toEqual({ 'delivery.state': 'seen', seenAt: SERVER_TIME });
  });

  it('Β2 🔴 — το παλιό `seen: true` ΔΕΝ γράφεται ποτέ ξανά', () => {
    expect(seenUpdateFor({ delivery: { state: 'sent' } })).not.toHaveProperty('seen');
  });
});
