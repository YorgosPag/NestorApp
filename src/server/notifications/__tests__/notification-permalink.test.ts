/**
 * @jest-environment node
 *
 * Άγκυρα — **Ο ΜΟΝΙΜΟΣ ΣΥΝΔΕΣΜΟΣ `/n/{id}`** (ADR-848)
 *
 * | # | ισχυρισμός | η μετάλλαξη που το σπάει |
 * |---|---|---|
 * | Α | ξένη ≡ ανύπαρκτη | ξεχωριστή απάντηση ⇒ απαρίθμηση ειδοποιήσεων |
 * | Β | ο προορισμός ξαναπερνά τον φρουρό | `actions[0].url` αυτούσιο ⇒ ανοιχτή ανακατεύθυνση από δεδομένα |
 * | Γ | «διαβάστηκε» μόνο για τον ιδιοκτήτη, και η αποτυχία του δεν κόβει την πλοήγηση | εγγραφή πριν τον έλεγχο ⇒ ο ξένος σημειώνει |
 */

jest.mock('server-only', () => ({}));

const mockGet = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({ doc: () => ({ get: mockGet, update: mockUpdate }) }),
  }),
}));

const mockDestination = jest.fn(async (_identity: unknown, path: string) => `/o/nikos${path}`);
jest.mock('@/lib/workspace/workspace-destination', () => ({
  workspaceDestinationFor: (identity: unknown, path: string) => mockDestination(identity, path),
}));

import type { SignedInPageIdentity } from '@/lib/workspace/workspace-destination';
import {
  isNotificationId,
  openNotificationPermalink,
  permalinkDestination,
} from '@/server/notifications/notification-permalink';

// ⚠️ Μόνο τα πεδία που διαβάζει ο κώδικας· το πλήρες `AuthContext` δεν αφορά αυτή την άγκυρα.
const OWNER = { ok: true, scope: 'organization', ctx: { uid: 'u1', companyId: 'c1' } } as unknown as SignedInPageIdentity;

function storedNotification(data: Record<string, unknown> | null): void {
  mockGet.mockResolvedValue({ exists: data !== null, data: () => data ?? undefined });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue(undefined);
});

describe('Α — καθαρή κρίση', () => {
  it('Α1 — ΜΟΝΟ ο ιδιοκτήτης παίρνει προορισμό', () => {
    const data = { userId: 'u1', actions: [{ id: 'view', label: 'view', url: '/listings/abc' }] };
    expect(permalinkDestination(data, 'u1')).toBe('/listings/abc');
    expect(permalinkDestination(data, 'u2')).toBeNull();
    expect(permalinkDestination(undefined, 'u1')).toBeNull();
  });

  it.each([
    ['https://evil.example/x', 'απόλυτο URL'],
    ['//evil.example', 'protocol-relative'],
    [undefined, 'χωρίς προορισμό'],
    [42, 'όχι κείμενο'],
  ])('Α2 🔴 — προορισμός %p (%s) ⇒ null, ποτέ ανακατεύθυνση', (url) => {
    expect(permalinkDestination({ userId: 'u1', actions: [{ url }] }, 'u1')).toBeNull();
  });

  it.each(['', '.', '..', 'a/b', 'x'.repeat(1501)])('Α3 — %p δεν είναι ταυτότητα εγγράφου', (id) => {
    expect(isNotificationId(id)).toBe(false);
  });

  it('Α4 — οι πραγματικές ταυτότητες (`συμβάν:παραλήπτης:γεγονός`) περνούν', () => {
    expect(isNotificationId('listing_match:u1:l1')).toBe(true);
  });
});

describe('Β — το κλικ', () => {
  it('Β1 🔑 — δικό σου ⇒ «διαβάστηκε από email» + ο προορισμός ΜΕΣΑ στον χώρο σου', async () => {
    storedNotification({ userId: 'u1', actions: [{ url: '/listings/abc' }] });

    const verdict = await openNotificationPermalink('listing_match:u1:l1', OWNER);

    expect(verdict).toEqual({ kind: 'redirect', to: '/o/nikos/listings/abc' });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ seen: true, actionTaken: 'view', openedVia: 'email' }),
    );
  });

  it('Β2 — προορισμός ΕΚΤΟΣ χώρου (`/offers`) φεύγει αυτούσιος', async () => {
    storedNotification({ userId: 'u1', actions: [{ url: '/offers/p1' }] });

    expect(await openNotificationPermalink('mandate_request:u1:p1', OWNER)).toEqual({
      kind: 'redirect',
      to: '/offers/p1',
    });
    expect(mockDestination).not.toHaveBeenCalled();
  });

  it('Β3 🔴 — ΞΕΝΗ ≡ ΑΝΥΠΑΡΚΤΗ, και καμία εγγραφή', async () => {
    storedNotification({ userId: 'someone-else', actions: [{ url: '/listings/abc' }] });
    const foreign = await openNotificationPermalink('x:someone-else:y', OWNER);

    storedNotification(null);
    const missing = await openNotificationPermalink('x:u1:y', OWNER);

    expect(foreign).toEqual(missing);
    expect(foreign).toEqual({ kind: 'unavailable' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('Β4 — άκυρη ταυτότητα δεν αγγίζει καν τη βάση', async () => {
    expect(await openNotificationPermalink('a/b', OWNER)).toEqual({ kind: 'unavailable' });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('Β5 — πεσμένη σημείωση «διαβάστηκε» ΔΕΝ εμποδίζει την πλοήγηση', async () => {
    storedNotification({ userId: 'u1', actions: [{ url: '/listings/abc' }] });
    mockUpdate.mockRejectedValue(new Error('firestore unavailable'));

    expect(await openNotificationPermalink('listing_match:u1:l1', OWNER)).toEqual({
      kind: 'redirect',
      to: '/o/nikos/listings/abc',
    });
  });
});
