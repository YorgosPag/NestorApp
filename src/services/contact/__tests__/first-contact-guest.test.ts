/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΚΟΛΟΥΘΙΑ** — απόδειξη → ταυτότητα → πράξη (ADR-844).
 * @related services/contact/first-contact-guest.service.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΔΟΚΙΜΑΖΕΤΑΙ ΕΔΩ ΚΑΙ ΤΙ **ΟΧΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Ναι**: η σειρά, η μετάφραση των εκβάσεων, και —το σοβαρότερο— ότι η πράξη
 * γράφεται με το **ΕΠΑΛΗΘΕΥΜΕΝΟ** κανάλι.
 *
 * **Όχι**: ο γραφέας (`openFirstContact`) και ο κριτής (`admitFirstContact`). Έχουν
 * **δικές τους** άγκυρες, και μια δεύτερη δοκιμή τους εδώ θα ήταν δεύτερη αυθεντία
 * για το «τι επιτρέπεται» — ακριβώς αυτό που το ίδιο το αρχείο υπηρεσίας αρνείται.
 * Γι' αυτό ο γραφέας είναι **πλαστός**: ελέγχουμε **τι του δίνουμε**, όχι τι κάνει.
 */

jest.mock('server-only', () => ({}));

const openFirstContactMock = jest.fn();
jest.mock('@/services/contact/first-contact.service', () => ({
  openFirstContact: (...args: unknown[]) => openFirstContactMock(...args),
}));

const ensureCitizenIdentityMock = jest.fn();
jest.mock('@/server/auth/citizen-identity', () => ({
  ensureCitizenIdentity: (...args: unknown[]) => ensureCitizenIdentityMock(...args),
  CITIZEN_STATUS: 'citizen',
}));

const claimByLinkMock = jest.fn();
const claimByCodeMock = jest.fn();
jest.mock('@/services/contact/first-contact-invitation.service', () => ({
  claimInvitationByLink: (...args: unknown[]) => claimByLinkMock(...args),
  claimInvitationByCode: (...args: unknown[]) => claimByCodeMock(...args),
}));

import {
  redeemGuestContactByCode,
  redeemGuestContactByLink,
} from '@/services/contact/first-contact-guest.service';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const AT = '2026-09-05T10:00:00.000Z';
const DB = {} as AdminFirestore;

/** Η πρόσκληση όπως βγαίνει από την εξαργύρωση — **επαληθευμένο** κανάλι πεζά. */
function claimed(typedEmail: string | null = 'MARIA@Example.com ') {
  return {
    kind: 'claimed' as const,
    invitation: {
      id: 'fcin_1',
      channelEmail: 'maria@example.com',
      declaration: {
        target: { kind: 'listing' as const, listingId: 'ownp_α' },
        demandId: null,
        disclosure: {
          displayName: 'Μαρία Δ.',
          email: typedEmail,
          phone: '6900000000',
          acceptsPlatformMessages: false,
        },
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  ensureCitizenIdentityMock.mockResolvedValue({
    kind: 'ready', uid: 'uid_maria', customToken: 'tok_custom', born: true,
  });
  openFirstContactMock.mockResolvedValue({
    kind: 'created', contact: { id: 'fcon_1' },
  });
});

describe('Σ — η σειρά και η μετάφραση', () => {
  it('🔑 Σ1 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: σύνδεσμος → ταυτότητα → πράξη → κλειδί', async () => {
    claimByLinkMock.mockResolvedValue(claimed());

    const outcome = await redeemGuestContactByLink(DB, 'token', AT);

    expect(outcome).toEqual({
      kind: 'contacted', contact: { id: 'fcon_1' }, created: true, customToken: 'tok_custom',
    });
    expect(ensureCitizenIdentityMock).toHaveBeenCalledWith({
      email: 'maria@example.com', displayName: 'Μαρία Δ.',
    });
  });

  it('🔴 Σ2 — Η ΠΡΑΞΗ ΓΡΑΦΕΤΑΙ ΜΕ ΤΟ ΕΠΑΛΗΘΕΥΜΕΝΟ EMAIL, όχι με ό,τι πληκτρολογήθηκε', async () => {
    claimByLinkMock.mockResolvedValue(claimed('MARIA@Example.com '));

    await redeemGuestContactByLink(DB, 'token', AT);

    const [, actor, declaration] = openFirstContactMock.mock.calls[0] as [
      unknown, { uid: string; companyId: string | null }, { disclosure: { email: string; phone: string } },
    ];

    // 🔴 Η απόφαση #3: ο Κώστας βλέπει **αυτό που αποδείχθηκε**, ποτέ τη μορφή που
    //    πληκτρολογήθηκε — αλλιώς δύο συμβολοσειρές για την ίδια διεύθυνση, με μόνο
    //    τη μία επαληθευμένη.
    expect(declaration.disclosure.email).toBe('maria@example.com');
    // ⚠️ Το τηλέφωνο μένει **αυτούσιο και ανεπαλήθευτο** — δηλωμένο όριο (απόφαση #5).
    expect(declaration.disclosure.phone).toBe('6900000000');
    // ⛔ Ο πολίτης **δεν έχει** εταιρεία. ΠΟΤΕ `''` (CHECK 3.35 / 3.56).
    expect(actor).toEqual({ uid: 'uid_maria', companyId: null });
  });

  it('Σ3 — άρνηση συνδέσμου: ΚΑΜΙΑ ταυτότητα, ΚΑΜΙΑ πράξη', async () => {
    claimByLinkMock.mockResolvedValue({ kind: 'refused', reason: 'expired' });

    const outcome = await redeemGuestContactByLink(DB, 'token', AT);

    expect(outcome).toEqual({ kind: 'link-refused', reason: 'expired' });
    // 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ της σειράς: τίποτα δεν τρέχει μετά από άκυρη απόδειξη.
    expect(ensureCitizenIdentityMock).not.toHaveBeenCalled();
    expect(openFirstContactMock).not.toHaveBeenCalled();
  });

  it('Σ4 — απενεργοποιημένος λογαριασμός: ΚΑΜΙΑ πράξη', async () => {
    claimByLinkMock.mockResolvedValue(claimed());
    ensureCitizenIdentityMock.mockResolvedValue({ kind: 'refused', reason: 'account-disabled' });

    const outcome = await redeemGuestContactByLink(DB, 'token', AT);

    expect(outcome).toEqual({ kind: 'identity-refused', reason: 'account-disabled' });
    expect(openFirstContactMock).not.toHaveBeenCalled();
  });

  it('Σ5 — ο κωδικός φτάνει στην ΙΔΙΑ κλειδαριά', async () => {
    claimByCodeMock.mockResolvedValue(claimed());

    const outcome = await redeemGuestContactByCode(DB, 'fcin_1', '472913', AT);

    expect(claimByCodeMock).toHaveBeenCalledWith(DB, 'fcin_1', '472913', AT);
    expect(outcome.kind).toBe('contacted');
  });

  it('Σ6 — άρνηση του ΓΡΑΦΕΑ ταξιδεύει ονομαστικά (δεν γίνεται «κάτι πήγε στραβά»)', async () => {
    claimByLinkMock.mockResolvedValue(claimed());
    openFirstContactMock.mockResolvedValue({ kind: 'rejected', reason: 'capacity-full' });

    expect(await redeemGuestContactByLink(DB, 'token', AT)).toEqual({
      kind: 'contact-refused', reason: 'capacity-full',
    });
  });

  it('Σ7 — «δεν μάθαμε» ΔΕΝ γίνεται άρνηση (N.12)', async () => {
    claimByLinkMock.mockResolvedValue(claimed());
    openFirstContactMock.mockResolvedValue({ kind: 'unavailable' });

    expect(await redeemGuestContactByLink(DB, 'token', AT)).toEqual({ kind: 'unavailable' });
  });

  it('Σ8 — «ήδη υπάρχει» είναι ΕΠΙΤΥΧΙΑ, και το κλειδί δίνεται κανονικά', async () => {
    claimByLinkMock.mockResolvedValue(claimed());
    openFirstContactMock.mockResolvedValue({ kind: 'unchanged', contact: { id: 'fcon_1' } });

    expect(await redeemGuestContactByLink(DB, 'token', AT)).toEqual({
      kind: 'contacted', contact: { id: 'fcon_1' }, created: false, customToken: 'tok_custom',
    });
  });
});
