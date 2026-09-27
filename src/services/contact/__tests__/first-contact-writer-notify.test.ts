/**
 * ADR-843 §10.20 — **ο γραφέας ειδοποιεί ΜΟΝΟ για πράξη που γεννήθηκε.**
 *
 * - Γ1: νέα πράξη ⇒ **μία** ειδοποίηση, με την πράξη **όπως γράφτηκε** (ίδια ταυτότητα με το έγγραφο).
 * - Γ2: δεύτερο πάτημα στο ίδιο κουμπί (`unchanged`) ⇒ **καμία** — ο ιδιοκτήτης δεν ακούει δύο φορές τον ίδιο άνθρωπο.
 * - Γ3: άρνηση (γεμάτη χωρητικότητα) ⇒ **καμία** — δεν ειδοποιούμε για πράξη που δεν έγινε.
 *
 * Οι φρουροί εισόδου (`admitFirstContact`, `resolveMatchReason`) έχουν δικές τους σουίτες· εδώ απαντούν «ναι».
 */

import type { Firestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

const announce = jest.fn(async (_db: unknown, _contact: { readonly id: string }) => 1);
jest.mock('@/services/contact/first-contact-notifier.service', () => ({
  announceFirstContactReceived: (db: unknown, contact: { readonly id: string }) => announce(db, contact),
}));
jest.mock('@/services/contact/first-contact-admission', () => ({
  admitFirstContact: async () => ({
    kind: 'admitted',
    located: { custody: { kind: 'personal', userId: 'owner-stavroula' }, facts: null },
  }),
}));
jest.mock('@/services/contact/first-contact-guards', () => ({
  resolveMatchReason: async () => ({ kind: 'reason', matchReason: null }),
}));
let nextId = 0;
jest.mock('@/services/enterprise-id-convenience', () => ({
  generateFirstContactId: () => `fcon_${++nextId}`,
}));

import { openFirstContact } from '../first-contact.service';

const NOW = '2026-09-27T16:36:00.000Z';
const ACTOR = { uid: 'seeker-1', companyId: null } as const;
const DECLARATION = {
  target: { kind: 'listing', listingId: 'ownp_1' },
  demandId: null,
  disclosure: { displayName: 'Γιώργος', email: 'giorgos@example.gr', phone: null, acceptsPlatformMessages: false },
} as const;

/** Μια ελάχιστη βάση: η συναλλαγή διαβάζει ό,τι έχει ήδη γραφτεί και κρατά ό,τι γράφει. */
function fakeDb(stored: Record<string, unknown>[]): Firestore {
  const docsOf = () => stored.map((data) => ({ id: String(data.id), data: () => data }));
  const tx = {
    get: async () => ({ docs: docsOf() }),
    set: (_ref: unknown, data: Record<string, unknown>) => { stored.push(data); },
  };
  const collection = () => ({ where: () => ({}), doc: (id: string) => ({ id }) });
  return {
    collection,
    runTransaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as Firestore;
}

describe('openFirstContact — ποιες πράξεις ειδοποιούν τον προσφέροντα', () => {
  beforeEach(() => announce.mockClear());

  it('Γ1 — νέα πράξη ⇒ μία ειδοποίηση, για την πράξη που γράφτηκε', async () => {
    const stored: Record<string, unknown>[] = [];
    const result = await openFirstContact(fakeDb(stored), ACTOR, DECLARATION, NOW);
    expect(result.kind).toBe('created');
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls[0][1].id).toBe(stored[0].id);
  });

  it('Γ2 🔴 — δεύτερο πάτημα (unchanged) ⇒ καμία δεύτερη ειδοποίηση', async () => {
    const stored: Record<string, unknown>[] = [];
    const db = fakeDb(stored);
    await openFirstContact(db, ACTOR, DECLARATION, NOW);
    const again = await openFirstContact(db, ACTOR, DECLARATION, NOW);
    expect(again.kind).toBe('unchanged');
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('Γ3 — γεμάτη χωρητικότητα ⇒ άρνηση, καμία ειδοποίηση', async () => {
    const full = Array.from({ length: 10 }, (_, i) => ({
      id: `fcon_full_${i}`,
      seekerUserId: 'seeker-1',
      target: { kind: 'listing', listingId: `ownp_other_${i}` },
      offerer: { kind: 'personal', userId: 'someone' },
      demandId: null,
      disclosure: DECLARATION.disclosure,
      matchReason: null,
      lifecycle: 'open',
      createdAt: NOW,
      withdrawnAt: null,
      seenAt: null,
    }));
    const result = await openFirstContact(fakeDb(full), ACTOR, DECLARATION, NOW);
    expect(result).toMatchObject({ kind: 'rejected', reason: 'capacity-full' });
    expect(announce).not.toHaveBeenCalled();
  });
});
