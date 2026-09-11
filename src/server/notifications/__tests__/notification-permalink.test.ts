/**
 * @jest-environment node
 *
 * Άγκυρα — **Ο ΜΟΝΙΜΟΣ ΣΥΝΔΕΣΜΟΣ `/n/{id}`** (ADR-848 · ADR-849 §6δ Β1)
 *
 * | # | ισχυρισμός | η μετάλλαξη που το σπάει |
 * |---|---|---|
 * | Α | ξένη ≡ ανύπαρκτη | ξεχωριστή απάντηση ⇒ απαρίθμηση ειδοποιήσεων |
 * | Β | ο προορισμός ξαναπερνά τον φρουρό | `actions[0].url` αυτούσιο ⇒ ανοιχτή ανακατεύθυνση από δεδομένα |
 * | Γ | ο χώρος είναι του ΓΕΓΟΝΟΤΟΣ, όχι του θεατή | `workspaceDestinationFor` πάντα ⇒ «Το ακίνητο δεν βρέθηκε» |
 * | Δ | το κανάλι γράφεται όπως ήρθε | σταθερό `'email'` ⇒ το κουδούνι μετριέται ως email |
 */

jest.mock('server-only', () => ({}));

const mockGet = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({ doc: () => ({ get: mockGet, update: mockUpdate }) }),
  }),
}));

// 🔑 Αντικαθίσταται ΜΟΝΟ η λύση του ψευδωνύμου (ανάγνωση βάσης). Η μετάφραση χώρος →
//    κάτοχος (`ownerOfWorkspace`) τρέχει η ΠΡΑΓΜΑΤΙΚΗ — αλλιώς η άγκυρα θα έκρινε δεύτερη
//    εκδοχή της (παγίδα handoff §4).
const mockViewerDestination = jest.fn(async (_identity: unknown, path: string) => `/o/nikos${path}`);
const mockTargetDestination = jest.fn(
  async (owner: { kind: string; companyId?: string }, path: string) =>
    owner.kind === 'organization' ? `/o/alias-of-${owner.companyId}${path}` : `/o/me${path}`,
);
jest.mock('@/lib/workspace/workspace-destination', () => ({
  ...jest.requireActual('@/lib/workspace/workspace-destination'),
  workspaceDestinationFor: (identity: unknown, path: string) => mockViewerDestination(identity, path),
  workspaceDestinationOf: (owner: { kind: string; companyId?: string }, path: string) =>
    mockTargetDestination(owner, path),
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
    expect(permalinkDestination(data, 'u1')).toEqual({ path: '/listings/abc', workspace: null });
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
  it('Β1 🔑 — δικό σου, παλιό έγγραφο (χωρίς χώρο) ⇒ «διαβάστηκε» + ο χώρος ΤΟΥ ΘΕΑΤΗ', async () => {
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
    expect(mockViewerDestination).not.toHaveBeenCalled();
    expect(mockTargetDestination).not.toHaveBeenCalled();
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

describe('🔴 Γ — ο χώρος είναι του ΓΕΓΟΝΟΤΟΣ, όχι του θεατή (ADR-849 §6δ Β1)', () => {
  /** Το ζωντανό σύμπτωμα της 10/9: ακίνητο της εταιρείας-στόχου, θεατής με claim ΑΛΛΗΣ. */
  const PROPERTY_OF_TARGET = {
    userId: 'u1',
    actions: [{ id: 'view', label: 'view', url: '/properties/prop_ef2' }],
    meta: { workspace: { kind: 'org', companyId: 'comp_target' } },
  };

  it('Γ1 🔑 — δηλωμένος εταιρικός χώρος ⇒ το ψευδώνυμο ΤΟΥ ΣΤΟΧΟΥ, ΠΟΤΕ του claim', async () => {
    storedNotification(PROPERTY_OF_TARGET);

    const verdict = await openNotificationPermalink('demand:u1:prop_ef2', OWNER);

    expect(verdict).toEqual({ kind: 'redirect', to: '/o/alias-of-comp_target/properties/prop_ef2' });
    expect(mockTargetDestination).toHaveBeenCalledWith(
      { kind: 'organization', companyId: 'comp_target' },
      '/properties/prop_ef2',
    );
    expect(mockViewerDestination).not.toHaveBeenCalled();
  });

  it('Γ2 — δηλωμένος ιδιωτικός χώρος ΤΟΥ ΙΔΙΟΥ ⇒ `/o/me/…`', async () => {
    storedNotification({ ...PROPERTY_OF_TARGET, meta: { workspace: { kind: 'personal', userId: 'u1' } } });

    expect(await openNotificationPermalink('n:u1:x', OWNER)).toEqual({
      kind: 'redirect',
      to: '/o/me/properties/prop_ef2',
    });
  });

  it.each([
    ['ιδιωτικός χώρος ΑΛΛΟΥ', { kind: 'personal', userId: 'u2' }],
    ['εταιρεία χωρίς ταυτότητα', { kind: 'org', companyId: '' }],
    ['άγνωστο είδος', { kind: 'team', companyId: 'comp_target' }],
    ['κείμενο αντί για ένωση', 'org:comp_target'],
  ])('Γ3 🔴 — αλλοιωμένος χώρος (%s) ⇒ ΔΕΝ ανοίγει «κάπου»: πέφτει στην παλιά συμπεριφορά', async (_label, workspace) => {
    storedNotification({ ...PROPERTY_OF_TARGET, meta: { workspace } });

    expect(await openNotificationPermalink('n:u1:x', OWNER)).toEqual({
      kind: 'redirect',
      to: '/o/nikos/properties/prop_ef2',
    });
    expect(mockTargetDestination).not.toHaveBeenCalled();
  });

  it('Γ4 — προορισμός ΕΚΤΟΣ χώρου μένει αυτούσιος ακόμη κι όταν ο χώρος δηλώνεται', async () => {
    storedNotification({ ...PROPERTY_OF_TARGET, actions: [{ url: '/listing/prop_ef2' }] });

    expect(await openNotificationPermalink('n:u1:x', OWNER)).toEqual({
      kind: 'redirect',
      to: '/listing/prop_ef2',
    });
    expect(mockTargetDestination).not.toHaveBeenCalled();
  });
});

describe('Δ — το κανάλι (ADR-849 Β1: το κουδούνι περνά από την ίδια πόρτα)', () => {
  it('Δ1 — `inapp` γράφεται ως `inapp`, και ο προορισμός είναι ο ΙΔΙΟΣ', async () => {
    storedNotification({ userId: 'u1', actions: [{ url: '/offers/p1' }] });

    const verdict = await openNotificationPermalink('n:u1:p1', OWNER, 'inapp');

    expect(verdict).toEqual({ kind: 'redirect', to: '/offers/p1' });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ openedVia: 'inapp' }));
  });
});
