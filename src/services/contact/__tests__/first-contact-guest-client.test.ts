/**
 * 🔴 ΑΓΚΥΡΑ — **ΚΑΘΕ ΛΟΓΟΣ ΦΤΑΝΕΙ ΣΤΗΝ ΟΘΟΝΗ ΜΕ ΤΟ ΟΝΟΜΑ ΤΟΥ** (ADR-844).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΓΕΝΝΗΣΕ ΟΛΟΚΛΗΡΟ ΤΟ ADR ΗΤΑΝ **ΑΚΡΙΒΩΣ ΑΥΤΟ ΤΟ ΣΤΡΩΜΑ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο ανώνυμος επισκέπτης συμπλήρωνε ολόκληρη τη φόρμα, υπέβαλλε, έπαιρνε **401** — και
 * επειδή το 401 δεν ήταν ούτε `CONTACT_REFUSED` ούτε `INVALID_CONTACT`, ο μεταφορέας
 * έπεφτε στο `{ kind: 'failed' }` και η οθόνη έλεγε *«κάτι πήγε στραβά»*.
 *
 * ⇒ **Ένα σκέλος που λείπει εδώ δεν φαίνεται πουθενά αλλού**: ο κώδικας δουλεύει, τα
 * τεστ του διακομιστή είναι πράσινα, και ο άνθρωπος διαβάζει λάθος πρόταση.
 *
 * ⚠️ Mock **μόνο ο μεταφορέας**· οι φρουροί των λεξιλογίων είναι οι **πραγματικοί**.
 */

jest.mock('@/lib/api/enterprise-api-client', () => {
  const types = jest.requireActual('@/lib/api/api-client-types');
  return {
    apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
    ApiClientError: types.ApiClientError,
    apiErrorBodyOf: types.apiErrorBodyOf,
  };
});

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import {
  confirmGuestContact,
  submitGuestContact,
} from '@/services/contact/first-contact.client';
import type { FirstContactDeclaration } from '@/services/contact/first-contact-vocabulary';
import { FIRST_CONTACT_INVITATION_REFUSALS } from '@/types/first-contact-invitation';

const postMock = apiClient.post as jest.Mock;

const DECLARATION: FirstContactDeclaration = {
  target: { kind: 'listing', listingId: 'ownp_kalamaria' },
  demandId: null,
  disclosure: {
    displayName: 'Μαρία Δ.',
    email: 'maria@example.com',
    phone: null,
    acceptsPlatformMessages: false,
  },
};

function serverSaid(status: number, body: unknown): ApiClientError {
  return new ApiClientError('irrelevant', status, `HTTP_${status}`, undefined, 'req_1', undefined, body);
}

beforeEach(() => postMock.mockReset());

// =============================================================================
// Α — Η ΔΗΛΩΣΗ (πόρτα 1: «στείλε μου σύνδεσμο»)
// =============================================================================

describe('Α — η δήλωση φεύγει, η πράξη ΔΕΝ γεννιέται', () => {
  it('🔑 Α1 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: 202 ⇒ `sent` με αναγνωριστικό και κρυμμένο email', async () => {
    postMock.mockResolvedValue({ invitationId: 'fcin_1', maskedEmail: 'μ***α@gmail.com' });

    await expect(submitGuestContact(DECLARATION)).resolves.toEqual({
      kind: 'sent',
      invitationId: 'fcin_1',
      maskedEmail: 'μ***α@gmail.com',
    });
  });

  it('🔴 Α2 — Η ΚΛΗΣΗ ΕΙΝΑΙ `skipAuth`, ΚΑΙ ΧΩΡΙΣ ΑΥΤΟ Η ΔΙΑΔΡΟΜΗ ΕΙΝΑΙ ΝΕΚΡΗ', async () => {
    // 🔴 **Το πιο εύκολο λάθος ολόκληρου του ADR.** Χωρίς τη σημαία, το `buildHeaders`
    //    ζητά `getIdToken()` από **ανύπαρκτο** χρήστη και πετά **401 πριν καν φύγει το
    //    αίτημα** — δηλαδή ο μεταφορέας αναπαράγει, ένα στρώμα ψηλότερα, **ακριβώς** το
    //    ελάττωμα που η νέα διαδρομή υπάρχει για να θεραπεύσει.
    postMock.mockResolvedValue({ invitationId: 'fcin_1', maskedEmail: 'μ***α@gmail.com' });

    await submitGuestContact(DECLARATION);

    expect(postMock).toHaveBeenCalledWith(
      '/api/first-contacts/guest',
      DECLARATION,
      { skipAuth: true },
    );
  });

  it('🔑 Α3 — 422 `EMAIL_REQUIRED` ⇒ ονομαστικά, ποτέ «κάτι πήγε στραβά»', async () => {
    postMock.mockRejectedValue(serverSaid(422, { error: 'EMAIL_REQUIRED' }));

    await expect(submitGuestContact(DECLARATION)).resolves.toEqual({ kind: 'email-required' });
  });

  it('🔴 Α4 — 503 `INVITE_NOT_SENT` ΔΕΝ είναι `failed`: η πρόσκληση ΓΡΑΦΤΗΚΕ', async () => {
    // ⚠️ Δύο **διαφορετικά** επόμενα βήματα: εδώ δεν έχει νόημα να κοιτά εισερχόμενα.
    postMock.mockRejectedValue(serverSaid(503, { error: 'INVITE_NOT_SENT' }));

    await expect(submitGuestContact(DECLARATION)).resolves.toEqual({ kind: 'not-sent' });
  });

  it('🔑 Α5 — άγνωστη βλάβη ⇒ `failed`, που είναι ΑΛΗΘΕΣ («δεν μάθαμε»)', async () => {
    postMock.mockRejectedValue(new Error('network down'));

    await expect(submitGuestContact(DECLARATION)).resolves.toEqual({ kind: 'failed' });
  });
});

// =============================================================================
// Β — Η ΑΠΟΔΕΙΞΗ (πόρτα 2: ο εξαψήφιος κωδικός)
// =============================================================================

describe('Β — η απόδειξη, και οι επτά εκβάσεις της', () => {
  it('🔑 Β1 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: 201 ⇒ `opened` με το εφήμερο κλειδί', async () => {
    postMock.mockResolvedValue({ contact: { id: 'fcon_1' }, created: true, customToken: 'tok' });

    await expect(confirmGuestContact('fcin_1', '472913')).resolves.toEqual({
      kind: 'opened',
      contact: { id: 'fcon_1' },
      created: true,
      customToken: 'tok',
    });
  });

  it('🔐 Β1β — `customToken: null` (λογαριασμός με 2FA) περνά ΑΥΤΟΥΣΙΟ — ποτέ «κάτι πήγε στραβά»', async () => {
    // ADR-844 §13: η πράξη **έγινε**· απλώς η απόδειξη email δεν δίνει συνεδρία.
    postMock.mockResolvedValue({ contact: { id: 'fcon_1' }, created: true, customToken: null });

    await expect(confirmGuestContact('fcin_1', '472913')).resolves.toEqual({
      kind: 'opened',
      contact: { id: 'fcon_1' },
      created: true,
      customToken: null,
    });
  });

  it('🔴 Β2 — ΚΑΘΕ ΕΝΑΣ από τους επτά λόγους άρνησης συνδέσμου ταξιδεύει ΟΝΟΜΑΣΤΙΚΑ', async () => {
    // 🔴 **`it.each` πάνω στο ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ, όχι σε δείγμα**: ο όγδοος λόγος που θα
    //    προστεθεί αύριο μπαίνει σε αυτή την άγκυρα **χωρίς να το θυμηθεί κανείς**.
    //    Ένα σκέλος με τρία διαλεγμένα ονόματα θα ήταν πράσινο και τυφλό.
    for (const reason of FIRST_CONTACT_INVITATION_REFUSALS) {
      postMock.mockReset();
      postMock.mockRejectedValue(serverSaid(422, { error: 'LINK_REFUSED', reason }));

      await expect(confirmGuestContact('fcin_1', '000000')).resolves.toEqual({
        kind: 'link-refused',
        reason,
      });
    }
  });

  it('🔴 Β3 — ΑΓΝΩΣΤΟΣ λόγος ΔΕΝ περνά: θα κατέληγε ωμό κλειδί στην οθόνη', async () => {
    // 🔴 Το περιστατικό ADR-834 §6.5.ε, τρίτη φορά σε αυτό το αρχείο. Ο φρουρός
    //    `isFirstContactInvitationRefusal` είναι ο λόγος που το `failed` είναι σωστό εδώ.
    postMock.mockRejectedValue(serverSaid(422, { error: 'LINK_REFUSED', reason: 'εφευρέθηκε' }));

    await expect(confirmGuestContact('fcin_1', '000000')).resolves.toEqual({ kind: 'failed' });
  });

  it('🔑 Β4 — 422 `CONTACT_REFUSED` ⇒ το λεξιλόγιο της ΠΡΑΞΗΣ, όχι του συνδέσμου', async () => {
    postMock.mockRejectedValue(serverSaid(422, { error: 'CONTACT_REFUSED', reason: 'capacity-full' }));

    await expect(confirmGuestContact('fcin_1', '472913')).resolves.toEqual({
      kind: 'refused',
      reason: 'capacity-full',
    });
  });

  it('🔑 Β5 — 422 `INVALID_CONTACT` ⇒ τα αμετάβλητα, φιλτραρισμένα', async () => {
    postMock.mockRejectedValue(
      serverSaid(422, { error: 'INVALID_CONTACT', violations: ['contact-no-name', 'εφευρέθηκε'] }),
    );

    await expect(confirmGuestContact('fcin_1', '472913')).resolves.toEqual({
      kind: 'invalid',
      violations: ['contact-no-name'],
    });
  });

  it('🔴 Β6 — 403 `IDENTITY_REFUSED` ⇒ ΧΩΡΙΣ λόγο, και ο διακομιστής δεν στέλνει κανέναν', async () => {
    // 🔴 Οι λόγοι εκεί μιλούν για **εμάς**, και σε δημόσια διαδρομή θα επιβεβαίωναν σε
    //    τρίτον ότι η διεύθυνση **υπάρχει** — απαρίθμηση λογαριασμών, δωρεάν.
    postMock.mockRejectedValue(serverSaid(403, { error: 'IDENTITY_REFUSED' }));

    await expect(confirmGuestContact('fcin_1', '472913')).resolves.toEqual({
      kind: 'identity-refused',
    });
  });

  it('🔴 Β7 — 503 `WRITE_FAILED` ⇒ `unavailable`, ΠΟΤΕ ίδιο με άρνηση (N.12)', async () => {
    // ⚠️ Και η οθόνη **οφείλει** να το πει: η πρόσκληση έχει ήδη σφραγιστεί, άρα ο ίδιος
    //    σύνδεσμος **δεν ξαναδουλεύει** — ο άνθρωπος χρειάζεται νέα υποβολή.
    postMock.mockRejectedValue(serverSaid(503, { error: 'WRITE_FAILED' }));

    await expect(confirmGuestContact('fcin_1', '472913')).resolves.toEqual({ kind: 'unavailable' });
  });

  it('🔑 Β8 — και ο κωδικός φεύγει ΑΥΤΟΥΣΙΟΣ, με τα κενά του', async () => {
    // ⚠️ Ο άνθρωπος αντιγράφει `472 913` **με το κενό**. Ένα `trim`/`replace` εδώ θα
    //    ήταν **δεύτερος** κανόνας μορφής, ενώ ο επαληθευτής κάνει ήδη `trim()` — και
    //    δύο κανόνες μορφής είναι δύο ευκαιρίες να αποκλίνουν.
    postMock.mockResolvedValue({ contact: {}, created: false, customToken: 'tok' });

    await confirmGuestContact('fcin_1', '472 913');

    expect(postMock).toHaveBeenCalledWith(
      '/api/first-contacts/guest/confirm',
      { invitationId: 'fcin_1', code: '472 913' },
      { skipAuth: true },
    );
  });
});
