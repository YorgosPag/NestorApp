/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΑΝΑΛΥΤΗΣ ΠΡΟΣΚΛΗΣΗΣ** — ο πίνακας «σκοπός × κατάσταση» (ADR-876 §5 · Ε5 · Σ4 · Σ5).
 *
 * Α1 πολιτική (καθαρή) — κάθε κελί του πίνακα της κεφαλίδας του `vendor-invite-resolver.ts` ·
 * Α2 αλυσίδα — άρνηση διαπιστευτηρίου διαδίδεται αυτούσια, **χωρίς** ανάγνωση πρόσκλησης — εκτός από
 *    τον ανακλημένο σύνδεσμο, που ρωτά την πρόσκληση ΓΙΑΤΙ (Σ21: «αποσύρθηκε» ≠ «ανακλήθηκε») ·
 * Α3 φράχτης μισθωτή — διαπιστευτήριο άλλης εταιρείας από την πρόσκληση ⇒ «δεν βρέθηκε» ·
 * Α4 έγγραφο προ-migration με `'expired'` ⇒ ανακλημένο (ήταν η μόνη πηγή του).
 */

import type { VendorInvite } from '../../types/vendor-invite';
import type { VendorInviteCredential } from '../../types/vendor-invite-credential';

const mockCheck = jest.fn();
jest.mock('@/services/vendor-portal/vendor-invite-credential-store', () => ({
  checkVendorCredential: (...args: unknown[]) => mockCheck(...args),
}));

const mockInviteGet = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({ doc: () => ({ get: mockInviteGet }) }),
  }),
}));

import {
  judgeVendorInvite,
  resolveVendorInvite,
  vendorInvitePermits,
  type VendorInvitePurpose,
} from '../vendor-invite-resolver';

const NOW = Date.parse('2026-09-24T10:00:00.000Z');
const ts = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) });

function invite(overrides: Partial<Record<keyof VendorInvite, unknown>> = {}): VendorInvite {
  return {
    id: 'vi_1',
    rfqId: 'rfq_1',
    vendorContactId: 'c_1',
    companyId: 'co_1',
    status: 'sent',
    editWindowExpiresAt: null,
    ...overrides,
  } as unknown as VendorInvite;
}

const credential = { id: 'vic_1', inviteId: 'vi_1', companyId: 'co_1' } as VendorInviteCredential;

const PURPOSES: VendorInvitePurpose[] = ['read', 'submit', 'decline', 'renew'];

describe('Α1 — πολιτική', () => {
  it.each(PURPOSES)('ανακλημένη πρόσκληση ⇒ invite_revoked για «%s»', (purpose) => {
    expect(judgeVendorInvite(invite({ status: 'revoked' }), false, purpose, NOW)).toBe('invite_revoked');
  });

  it.each(PURPOSES)('αρνημένη πρόσκληση ⇒ invite_declined για «%s» (ΟΧΙ «ανακλήθηκε» — Σ5)', (purpose) => {
    expect(judgeVendorInvite(invite({ status: 'declined' }), false, purpose, NOW)).toBe('invite_declined');
  });

  it.each(['read', 'submit', 'decline'] as const)('ληγμένος σύνδεσμος ⇒ link_expired για «%s» (Σ4: και η άρνηση)', (purpose) => {
    expect(judgeVendorInvite(invite(), true, purpose, NOW)).toBe('link_expired');
  });

  it('ληγμένος σύνδεσμος γίνεται δεκτός ΜΟΝΟ για ανανέωση', () => {
    expect(judgeVendorInvite(invite(), true, 'renew', NOW)).toBeNull();
  });

  it('υποβεβλημένη: ανάγνωση ναι · άρνηση/ανανέωση 409 · υποβολή μόνο με ανοιχτό παράθυρο', () => {
    const open = invite({ status: 'submitted', editWindowExpiresAt: ts(NOW + 1) });
    const closed = invite({ status: 'submitted', editWindowExpiresAt: ts(NOW - 1) });
    expect(judgeVendorInvite(open, false, 'read', NOW)).toBeNull();
    expect(judgeVendorInvite(open, false, 'submit', NOW)).toBeNull();
    expect(judgeVendorInvite(closed, false, 'submit', NOW)).toBe('edit_window_closed');
    expect(judgeVendorInvite(open, false, 'decline', NOW)).toBe('already_submitted');
    expect(judgeVendorInvite(open, false, 'renew', NOW)).toBe('already_submitted');
  });

  it.each(PURPOSES)('ζωντανή πρόσκληση, ζωντανός σύνδεσμος ⇒ δεκτή για «%s»', (purpose) => {
    expect(judgeVendorInvite(invite({ status: 'opened' }), false, purpose, NOW)).toBeNull();
  });
});

describe('Α5 — τα ρήματα που ΠΡΟΣΦΕΡΕΙ η πύλη (ADR-876 §5 Σ16)', () => {
  it.each([
    ['ζωντανή', invite({ status: 'opened' }), { submit: true, decline: true }],
    ['υποβεβλημένη, ανοιχτό παράθυρο — ΚΑΜΙΑ άρνηση', invite({ status: 'submitted', editWindowExpiresAt: ts(NOW + 1) }), { submit: true, decline: false }],
    ['υποβεβλημένη, κλειστό παράθυρο — τίποτα', invite({ status: 'submitted', editWindowExpiresAt: ts(NOW - 1) }), { submit: false, decline: false }],
  ])('%s', (_label, subject, expected) => {
    expect(vendorInvitePermits(subject, NOW)).toEqual(expected);
  });

  it.each([
    ['ζωντανή', invite({ status: 'opened' })],
    ['υποβεβλημένη ανοιχτή', invite({ status: 'submitted', editWindowExpiresAt: ts(NOW + 1) })],
    ['υποβεβλημένη κλειστή', invite({ status: 'submitted', editWindowExpiresAt: ts(NOW - 1) })],
  ])('συμφωνεί με τον κριτή των αιτημάτων — %s (κανένα κουμπί που ο server θα απέρριπτε)', (_label, subject) => {
    const permits = vendorInvitePermits(subject, NOW);
    expect(permits.submit).toBe(judgeVendorInvite(subject, false, 'submit', NOW) === null);
    expect(permits.decline).toBe(judgeVendorInvite(subject, false, 'decline', NOW) === null);
  });
});

describe('Α2–Α4 — αλυσίδα', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Α2 — άκυρος/άγνωστος σύνδεσμος διαδίδεται, χωρίς ανάγνωση πρόσκλησης', async () => {
    mockCheck.mockResolvedValue({ ok: false, reason: 'link_not_found' });
    expect(await resolveVendorInvite('t', 'read', NOW)).toEqual({ ok: false, reason: 'link_not_found' });
    expect(mockInviteGet).not.toHaveBeenCalled();
  });

  it.each([
    ['ζωντανή πρόσκληση ⇒ ανακλήθηκε ΜΟΝΟ ο σύνδεσμος', 'sent', 'link_revoked'],
    ['ανακλημένη πρόσκληση ⇒ «η πρόσκληση αποσύρθηκε»', 'revoked', 'invite_revoked'],
  ])('Α2′ — ανακλημένος σύνδεσμος, %s (Σ21)', async (_label, status, reason) => {
    mockCheck.mockResolvedValue({ ok: false, reason: 'link_revoked', credential });
    mockInviteGet.mockResolvedValue({ exists: true, id: 'vi_1', data: () => invite({ status }) });
    expect(await resolveVendorInvite('t', 'read', NOW)).toEqual({ ok: false, reason });
  });

  it('Α3 — πρόσκληση άλλης εταιρείας από το διαπιστευτήριο ⇒ link_not_found', async () => {
    mockCheck.mockResolvedValue({ ok: true, credential, expired: false });
    mockInviteGet.mockResolvedValue({ exists: true, id: 'vi_1', data: () => invite({ companyId: 'co_OTHER' }) });
    expect(await resolveVendorInvite('t', 'read', NOW)).toEqual({ ok: false, reason: 'link_not_found' });
  });

  it.each([
    ['πρόσκληση χωρίς companyId', { companyId: undefined }, credential],
    ['κενό companyId και στα δύο (παγίδα `"" === ""`)', { companyId: '' }, { ...credential, companyId: '' }],
  ])('Α3′ — %s ⇒ link_not_found (ADR-876 §5 Σ15)', async (_label, inviteOverride, cred) => {
    mockCheck.mockResolvedValue({ ok: true, credential: cred, expired: false });
    mockInviteGet.mockResolvedValue({ exists: true, id: 'vi_1', data: () => invite(inviteOverride) });
    expect(await resolveVendorInvite('t', 'read', NOW)).toEqual({ ok: false, reason: 'link_not_found' });
  });

  it("Α4 — έγγραφο προ-migration με 'expired' ⇒ invite_revoked", async () => {
    mockCheck.mockResolvedValue({ ok: true, credential, expired: false });
    mockInviteGet.mockResolvedValue({ exists: true, id: 'vi_1', data: () => invite({ status: 'expired' }) });
    expect(await resolveVendorInvite('t', 'read', NOW)).toEqual({ ok: false, reason: 'invite_revoked' });
  });

  it('ζωντανή πρόσκληση ⇒ ανοίγει, με το διαπιστευτήριο που την άνοιξε', async () => {
    mockCheck.mockResolvedValue({ ok: true, credential, expired: false });
    mockInviteGet.mockResolvedValue({ exists: true, id: 'vi_1', data: () => invite() });
    const resolution = await resolveVendorInvite('t', 'submit', NOW);
    expect(resolution.ok).toBe(true);
    if (resolution.ok) expect(resolution.credential.id).toBe('vic_1');
  });
});
