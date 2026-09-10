/**
 * @jest-environment node
 *
 * Άγκυρα — **Ο ΣΥΓΓΡΑΦΕΑΣ ΤΗΣ ΣΥΝΔΡΟΜΗΣ** (ADR-848): η αναίρεση επαναφέρει ΑΚΡΙΒΩΣ,
 * και το `previous` είναι αυτό που **αντικαταστάθηκε** μέσα στο transaction.
 */

jest.mock('server-only', () => ({}));
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));

const mockGetAdminFirestore = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => mockGetAdminFirestore(),
}));

import {
  applyEmailSubscriptionChange,
  nextSubscriptionState,
  subscriptionStateOf,
} from '@/server/notifications/email-subscription';
import { getDefaultNotificationSettings } from '@/services/user-notification-settings/user-notification-settings.types';

/** Μια βάση με ΕΝΑ έγγραφο ρυθμίσεων (ή κανένα) και καταγραφή του `set`. */
function databaseWith(stored: Record<string, unknown> | null) {
  const set = jest.fn();
  const ref = { id: 'u1' };
  mockGetAdminFirestore.mockReturnValue({
    collection: () => ({ doc: () => ref }),
    runTransaction: async <T>(work: (tx: unknown) => Promise<T>) =>
      work({
        get: async () => ({ exists: stored !== null, data: () => stored ?? undefined }),
        set,
      }),
  });
  return { set, ref };
}

describe('Α — η πολιτική (καθαρή)', () => {
  const weekly = { emailEnabled: true, emailFrequency: 'weekly' } as const;

  it('Α1 — η διακοπή ΚΡΑΤΑ τη συχνότητα, ώστε η αναίρεση να έχει τι να επαναφέρει', () => {
    expect(nextSubscriptionState(weekly, { kind: 'unsubscribe' })).toEqual({
      emailEnabled: false,
      emailFrequency: 'weekly',
    });
  });

  it('Α2 — «μία σύνοψη την ημέρα» ανοίγει ΚΑΙ ρυθμίζει', () => {
    expect(nextSubscriptionState({ emailEnabled: false, emailFrequency: 'realtime' }, { kind: 'daily' })).toEqual({
      emailEnabled: true,
      emailFrequency: 'daily',
    });
  });

  it('Α3 🔑 — η αναίρεση επαναφέρει ΑΚΡΙΒΩΣ, όχι «ξαναενεργοποίησε»', () => {
    const off = nextSubscriptionState(weekly, { kind: 'unsubscribe' });
    expect(nextSubscriptionState(off, { kind: 'restore', state: weekly })).toEqual(weekly);
  });
});

describe('Β — η εγγραφή (transaction)', () => {
  it('Β1 — previous = το ΑΠΟΘΗΚΕΥΜΕΝΟ, current = η αλλαγή, merge:true', async () => {
    const { set, ref } = databaseWith({ emailEnabled: true, emailFrequency: 'weekly' });

    const applied = await applyEmailSubscriptionChange('u1', { kind: 'unsubscribe' });

    expect(applied.previous).toEqual({ emailEnabled: true, emailFrequency: 'weekly' });
    expect(applied.current).toEqual({ emailEnabled: false, emailFrequency: 'weekly' });
    expect(set).toHaveBeenCalledWith(
      ref,
      { userId: 'u1', emailEnabled: false, emailFrequency: 'weekly', updatedAt: 'SERVER_TIMESTAMP' },
      { merge: true },
    );
  });

  it('Β2 — χωρίς έγγραφο ρυθμίσεων: previous = οι ΠΡΟΕΠΙΛΟΓΕΣ, όχι «κενό»', async () => {
    databaseWith(null);
    const applied = await applyEmailSubscriptionChange('u1', { kind: 'daily' });
    expect(applied.previous).toEqual(subscriptionStateOf(getDefaultNotificationSettings('u1')));
  });
});
