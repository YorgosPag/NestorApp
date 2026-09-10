/**
 * @jest-environment node
 *
 * Άγκυρα — **Ο ΣΥΓΓΡΑΦΕΑΣ ΤΗΣ ΣΥΝΔΡΟΜΗΣ** (ADR-848 · ADR-849): η αναίρεση επαναφέρει
 * ΑΚΡΙΒΩΣ — **μόνο ό,τι άλλαξε** — και το `previous` είναι αυτό που **αντικαταστάθηκε**
 * μέσα στο transaction.
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

const MATCH = 'properties.demandListingMatch';
const MANDATE = 'properties.mandateDecided';

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
  const weekly = { emailEnabled: true, emailFrequency: 'weekly', mutedTypes: [] as string[] } as const;

  it('Α1 — η διακοπή ΚΡΑΤΑ τη συχνότητα, ώστε η αναίρεση να έχει τι να επαναφέρει', () => {
    expect(nextSubscriptionState(weekly, { kind: 'unsubscribe' })).toEqual({
      emailEnabled: false,
      emailFrequency: 'weekly',
      mutedTypes: [],
    });
  });

  it('Α2 — «μία σύνοψη την ημέρα» ανοίγει ΚΑΙ ρυθμίζει', () => {
    expect(
      nextSubscriptionState({ emailEnabled: false, emailFrequency: 'realtime', mutedTypes: [] }, { kind: 'daily' }),
    ).toEqual({ emailEnabled: true, emailFrequency: 'daily', mutedTypes: [] });
  });

  it('Α3 🔑 — η αναίρεση επαναφέρει ΑΚΡΙΒΩΣ, όχι «ξαναενεργοποίησε»', () => {
    const off = nextSubscriptionState(weekly, { kind: 'unsubscribe' });
    expect(nextSubscriptionState(off, { kind: 'restore', state: weekly })).toEqual(weekly);
  });

  it('Α4 📧 — τύπος off και η αναίρεσή του: ταξινομημένοι, χωρίς διπλότυπα, ΜΟΝΟ ο τύπος αλλάζει', () => {
    const start = { ...weekly, mutedTypes: [MANDATE] };
    const muted = nextSubscriptionState(start, { kind: 'type', settings: [MATCH, MATCH], mode: 'off' });
    expect(muted).toEqual({ ...weekly, mutedTypes: [MATCH, MANDATE] });
    expect(nextSubscriptionState(muted, { kind: 'type', settings: [MATCH], mode: 'on' })).toEqual(start);
  });

  it('Α5 🔑 — η `restore` ΔΕΝ αγγίζει τους τύπους (αναίρεση = μόνο ό,τι άλλαξε)', () => {
    const current = { ...weekly, emailEnabled: false, mutedTypes: [MATCH] };
    expect(nextSubscriptionState(current, { kind: 'restore', state: weekly }).mutedTypes).toEqual([MATCH]);
  });
});

describe('Β — η εγγραφή (transaction)', () => {
  it('Β1 — previous = το ΑΠΟΘΗΚΕΥΜΕΝΟ, current = η αλλαγή, merge:true', async () => {
    const { set, ref } = databaseWith({ emailEnabled: true, emailFrequency: 'weekly' });

    const applied = await applyEmailSubscriptionChange('u1', { kind: 'unsubscribe' });

    expect(applied.previous).toEqual({ emailEnabled: true, emailFrequency: 'weekly', mutedTypes: [] });
    expect(applied.current).toEqual({ emailEnabled: false, emailFrequency: 'weekly', mutedTypes: [] });
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

  it('Β3 📧 — `type`: γράφει ΜΟΝΟ το ένθετο πεδίο του τύπου (όχι τα καθολικά)', async () => {
    const { set, ref } = databaseWith({ emailCategories: { properties: { mandateDecided: 'off' } } });

    const applied = await applyEmailSubscriptionChange('u1', { kind: 'type', settings: [MATCH], mode: 'off' });

    expect(applied.previous.mutedTypes).toEqual([MANDATE]);
    expect(applied.current.mutedTypes).toEqual([MATCH, MANDATE]);
    expect(set).toHaveBeenCalledWith(
      ref,
      { userId: 'u1', emailCategories: { properties: { demandListingMatch: 'off' } }, updatedAt: 'SERVER_TIMESTAMP' },
      { merge: true },
    );
  });
});
