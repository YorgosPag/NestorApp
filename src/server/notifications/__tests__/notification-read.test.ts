/**
 * @jest-environment node
 *
 * Άγκυρα — **ΕΝΑΣ ΣΥΓΓΡΑΦΕΑΣ ΤΟΥ «ΔΙΑΒΑΣΤΗΚΕ»** (ADR-848): ιδιοκτησία ανά έγγραφο,
 * καμία σιωπηλή περικοπή στις 10 (το παλιό `where('__name__', 'in', …)`).
 */

jest.mock('server-only', () => ({}));

const mockUpdate = jest.fn();
const mockCommit = jest.fn();
const mockGetAll = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({ doc: (id: string) => ({ id }) }),
    getAll: (...refs: Array<{ id: string }>) => mockGetAll(...refs),
    batch: () => ({ update: mockUpdate, commit: mockCommit }),
  }),
}));

import { MAX_IDS_PER_MARK, markNotificationsSeen } from '@/server/notifications/notification-read';

/** Η βάση: `owners[id]` = ο ιδιοκτήτης, `null` = δεν υπάρχει. */
function stored(owners: Record<string, string | null>): void {
  mockGetAll.mockImplementation(async (...refs: Array<{ id: string }>) =>
    refs.map(({ id }) => ({
      id,
      exists: owners[id] !== null && owners[id] !== undefined,
      data: () => ({ userId: owners[id] }),
    })),
  );
}

beforeEach(() => jest.clearAllMocks());

describe('markNotificationsSeen', () => {
  it('Α1 🔑 — σημειώνει ΜΟΝΟ τις δικές σου· οι ξένες επιστρέφονται ονομαστικά', async () => {
    stored({ mine: 'u1', theirs: 'u2', gone: null });

    const outcome = await markNotificationsSeen('u1', ['mine', 'theirs', 'gone']);

    expect(outcome).toEqual({ marked: ['mine'], refused: ['theirs'] });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({ id: 'mine' }, expect.objectContaining({ seen: true }));
  });

  it('Α2 🔴 — 12 ταυτότητες ⇒ 12 ελέγχονται (το παλιό `in` έκοβε σιωπηλά στις 10)', async () => {
    const ids = Array.from({ length: 12 }, (_, index) => `n${index}`);
    stored(Object.fromEntries(ids.map((id) => [id, 'u1'])));

    const outcome = await markNotificationsSeen('u1', ids);
    expect(outcome.marked).toHaveLength(12);
  });

  it('Α3 — διπλότυπα και κενά πετιούνται· πάνω από το όριο κόβεται ΡΗΤΑ', async () => {
    stored({});
    await markNotificationsSeen('u1', ['a', 'a', '', ...Array.from({ length: 80 }, (_, i) => `x${i}`)]);
    expect(mockGetAll.mock.calls[0]).toHaveLength(MAX_IDS_PER_MARK);
  });

  it('Α4 — τίποτα προς σημείωση ⇒ καμία εγγραφή', async () => {
    stored({ theirs: 'u2' });
    await markNotificationsSeen('u1', ['theirs']);
    expect(mockCommit).not.toHaveBeenCalled();
  });
});
