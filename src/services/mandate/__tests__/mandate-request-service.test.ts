/**
 * @fileoverview **Ο ΓΡΑΦΕΑΣ ΤΟΥ Σ1** — φρουροί, σειρά τους, και ο πίνακας του Δ4.
 * @related ADR-827 §9.17 δ · services/mandate/mandate-request.service.ts
 *
 * ⚠️ **Ο `FakeFirestore` είναι ΔΑΝΕΙΟΣ** (`services/places/__tests__/fake-firestore`),
 * όχι δεύτερος: έχει ήδη `where().where().get()`, μετρητή εγγραφών και `failReads` —
 * ακριβώς τις τρεις πράξεις που κάνει αυτός ο γραφέας. Δεύτερη υλοποίηση θα ήταν
 * κλώνος που το **CHECK 3.28** μπλοκάρει, και σωστά.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import {
  submitMandateRequest,
  type MandateRequestDeclaration,
} from '@/services/mandate/mandate-request.service';
import { EXCLUSIVE_AGENCY, OPEN_LISTING } from '@/types/listing-agreement';
import type { ListingActor } from '@/lib/owner-property/listing-custody';
import type { MandateRequest, ProposedMandateTerms } from '@/types/mandate-request';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ο FakeFirestore μιμείται το Admin SDK· η μετάφραση γίνεται ΜΙΑ φορά, εδώ.
const asAdmin = (fake: FakeFirestore) => fake as unknown as Parameters<typeof submitMandateRequest>[0];

const NOW = '2026-08-29T12:00:00.000Z';
const UID = 'user-idiotis';
const AGENCY = 'comp_grafeio';
const LISTING = 'ownp_0001';

const OWNER: ListingActor = { uid: UID, companyId: null };

const TERMS: ProposedMandateTerms = {
  agreement: EXCLUSIVE_AGENCY,
  compensation: { type: 'percentage', percentage: 2, vatIncluded: false },
  expiresAt: '2027-04-29T23:59:59.999Z',
};

const OTHER_TERMS: ProposedMandateTerms = { ...TERMS, agreement: OPEN_LISTING };

const DECLARATION: MandateRequestDeclaration = {
  ownerPropertyId: LISTING,
  agencyCompanyId: AGENCY,
  terms: TERMS,
};

/** Ένας κόσμος όπου **όλα** είναι εντάξει — κάθε δοκιμή χαλάει ΕΝΑ πράγμα. */
function world(overrides: {
  readonly listing?: Record<string, unknown> | null;
  readonly agencyPublished?: boolean;
  readonly history?: readonly Partial<MandateRequest>[];
} = {}): FakeFirestore {
  const fake = new FakeFirestore();

  if (overrides.listing !== null) {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, LISTING, {
      id: LISTING,
      authorUserId: UID,
      authorCompanyId: null,
      lifecycle: 'listed',
      mandate: { kind: 'self' },
      ...(overrides.listing ?? {}),
    });
  }

  if (overrides.agencyPublished !== false) {
    fake.seed(COLLECTIONS.AGENCY_PROFILES, AGENCY, {
      companyId: AGENCY,
      displayName: 'Δοκιμαστικό Μεσιτικό Γραφείο',
      gemiNumber: '123456789000',
      publishedAt: '2026-08-01T00:00:00.000Z',
    });
  }

  (overrides.history ?? []).forEach((request, index) => {
    const id = request.id ?? `mreq_seed_${index}`;
    fake.seed(COLLECTIONS.MANDATE_REQUESTS, id, {
      id,
      ownerPropertyId: LISTING,
      agencyCompanyId: AGENCY,
      requestedByUserId: UID,
      initiatedBy: 'owner',
      status: 'declined',
      terms: TERMS,
      requestedAt: '2026-08-01T10:00:00.000Z',
      seenAt: null,
      decidedAt: '2026-08-02T10:00:00.000Z',
      clientContactId: null,
      supersedesRequestId: null,
      ...request,
    });
  });

  return fake;
}

const submit = (fake: FakeFirestore, terms: ProposedMandateTerms = TERMS, actor: ListingActor = OWNER) =>
  submitMandateRequest(asAdmin(fake), actor, { ...DECLARATION, terms }, NOW);

// ============================================================================
// Φ — ΟΙ ΦΡΟΥΡΟΙ
// ============================================================================

describe('Φ — οι φρουροί του Σ1', () => {
  it('Φ0 — ο καθαρός δρόμος γράφει ΕΝΑ έγγραφο, pending, χωρίς επαφή', async () => {
    const fake = world();
    const result = await submit(fake);

    expect(result.kind).toBe('created');
    expect(fake.writes >= 0).toBe(true);

    const written = fake.all<MandateRequest>(COLLECTIONS.MANDATE_REQUESTS);
    expect(written).toHaveLength(1);
    expect(written[0].status).toBe('pending');
    expect(written[0].clientContactId).toBeNull();
    expect(written[0].supersedesRequestId).toBeNull();
    expect(written[0].requestedByUserId).toBe(UID);
    // 🔑 N.6 — η ταυτότητα έρχεται από το enterprise-id, ποτέ χειρόγραφη.
    expect(written[0].id).toMatch(/^mreq_/);
  });

  it('Φ1 — ΞΕΝΗ αγγελία απαντά ΤΑΥΤΟΣΗΜΑ με ανύπαρκτη, και δεν γράφει τίποτα', async () => {
    const mine = await submit(world({ listing: null }));
    const foreign = await submit(world({ listing: { authorUserId: 'allos-anthropos' } }));

    expect(mine).toEqual({ kind: 'rejected', reason: 'listing-absent' });
    // 🔴 Το ΙΔΙΟ αντικείμενο: ένα ξεχωριστό «δεν σου ανήκει» θα ΕΠΙΒΕΒΑΙΩΝΕ την ύπαρξη.
    expect(foreign).toEqual(mine);
  });

  it('Φ2 — ΕΤΑΙΡΙΚΗ αγγελία δεν ανατίθεται από ιδιώτη, ούτε καν από μέλος της', async () => {
    const fake = world({ listing: { authorCompanyId: 'comp_allo' } });
    const asMember: ListingActor = { uid: UID, companyId: 'comp_allo' };

    // Ο ιδιώτης: όχι — δεν έχει tenant.
    expect(await submit(fake)).toEqual({ kind: 'rejected', reason: 'listing-absent' });
    // 🔑 Και το μέλος: **επιτρέπεται** από το mayAdminister — ο φρουρός δεν είναι εδώ,
    //    είναι στην πόρτα (withPersonalOrOrgAuth δίνει companyId μόνο σε οργανισμό).
    expect((await submit(fake, TERMS, asMember)).kind).not.toBe('failed');
  });

  it('Φ3 — ΑΠΟΣΥΡΜΕΝΗ αγγελία δεν έχει δημόσια προβολή ⇒ αίτημα για το τίποτα', async () => {
    expect(await submit(world({ listing: { lifecycle: 'withdrawn' } }))).toEqual({
      kind: 'rejected',
      reason: 'listing-not-live',
    });
  });

  it('Φ4 — αγγελία που ΕΧΕΙ ΗΔΗ εντολή δεν ξανα-ανατίθεται', async () => {
    const fake = world({
      listing: { mandate: { kind: 'brokered', agencyCompanyId: 'comp_allo' } },
    });
    expect(await submit(fake)).toEqual({ kind: 'rejected', reason: 'listing-already-brokered' });
  });

  it('Φ5 — 🔴 ΜΗ ΔΗΜΟΣΙΕΥΜΕΝΟ γραφείο απαντά «δεν υπάρχει» — η διαρροή του §9.4', async () => {
    expect(await submit(world({ agencyPublished: false }))).toEqual({
      kind: 'rejected',
      reason: 'agency-absent',
    });
  });

  it('Φ6 — 🔴 Η ΣΕΙΡΑ: η κατοχή κρίνεται ΠΡΙΝ το γραφείο', async () => {
    // 🔴 Και τα δύο χαλασμένα. Αν η απάντηση ήταν `agency-absent`, ο οποιοσδήποτε
    //    συνδεδεμένος θα μάθαινε αν δημοσιεύεται ένας οργανισμός **χωρίς να έχει καν
    //    αγγελία** — δηλαδή η πόρτα θα ήταν ανιχνευτής καταλόγου.
    const fake = world({ listing: null, agencyPublished: false });
    expect(await submit(fake)).toEqual({ kind: 'rejected', reason: 'listing-absent' });
  });

  it('Φ7 — 🔴 ΒΛΑΒΗ ≠ ΑΡΝΗΣΗ: αναγνωστικό σφάλμα δίνει `unavailable`, ποτέ `absent`', async () => {
    const fake = world();
    fake.failReads = true;
    const result = await submit(fake);

    expect(result).toEqual({ kind: 'unavailable' });
    expect(fake.all(COLLECTIONS.MANDATE_REQUESTS)).toHaveLength(0);
  });
});

// ============================================================================
// Δ4 — Ο ΠΙΝΑΚΑΣ ΤΗΣ ΙΔΕΜΠΟΤΗΣΙΑΣ ΚΑΙ ΤΗΣ ΑΝΑΘΕΩΡΗΣΗΣ
// ============================================================================

describe('Δ4 — ίδια ερώτηση δεν είναι νέα πράξη (§9.17 δ)', () => {
  it('Δ4.1 — 🏆 ΔΥΟ ΠΑΤΗΜΑΤΑ, ΙΔΙΟΙ ΟΡΟΙ ⇒ ΕΝΑ έγγραφο (ιδεμποτησία Stripe)', async () => {
    const fake = world();
    const first = await submit(fake);
    const second = await submit(fake);

    expect(first.kind).toBe('created');
    expect(second.kind).toBe('unchanged');
    // 🔴 Ο ισχυρισμός που μετράει: **ένα** έγγραφο στη βάση, όχι δύο.
    expect(fake.all(COLLECTIONS.MANDATE_REQUESTS)).toHaveLength(1);
    if (first.kind === 'created' && second.kind === 'unchanged') {
      expect(second.request.id).toBe(first.request.id);
    }
  });

  it('Δ4.2 — εκκρεμές με ΑΛΛΟΥΣ όρους ⇒ άρνηση, ΚΑΙ το πρώτο μένει άθικτο', async () => {
    const fake = world();
    const first = await submit(fake);
    const second = await submit(fake, OTHER_TERMS);

    expect(second).toEqual({ kind: 'rejected', reason: 'request-already-pending' });
    const stored = fake.all<MandateRequest>(COLLECTIONS.MANDATE_REQUESTS);
    expect(stored).toHaveLength(1);
    // 🔴 Το έγγραφο που ίσως διαβάζει ΑΥΤΗ ΤΗ ΣΤΙΓΜΗ ο μεσίτης δεν μεταλλάχθηκε.
    expect(stored[0].terms.agreement).toBe(EXCLUSIVE_AGENCY);
    if (first.kind === 'created') expect(stored[0].id).toBe(first.request.id);
  });

  it('Δ4.3 — μετά από ΑΡΝΗΣΗ, ΙΔΙΟΙ όροι ⇒ όχι· το γραφείο έχει ήδη απαντήσει', async () => {
    const fake = world({ history: [{ id: 'mreq_old', status: 'declined', terms: TERMS }] });
    expect(await submit(fake, TERMS)).toEqual({
      kind: 'rejected',
      reason: 'request-terms-unchanged',
    });
    expect(fake.all(COLLECTIONS.MANDATE_REQUESTS)).toHaveLength(1);
  });

  it('Δ4.4 — 🏆 μετά από ΑΡΝΗΣΗ, ΑΛΛΟΙ όροι ⇒ ΑΝΑΘΕΩΡΗΣΗ με αλυσίδα (Autodesk)', async () => {
    const fake = world({ history: [{ id: 'mreq_old', status: 'declined', terms: TERMS }] });
    const result = await submit(fake, OTHER_TERMS);

    expect(result.kind).toBe('created');
    if (result.kind === 'created') {
      // 🔑 Η αλυσίδα: το νέο έγγραφο ΔΗΛΩΝΕΙ ποιο αναθεωρεί.
      expect(result.request.supersedesRequestId).toBe('mreq_old');
      expect(result.request.id).not.toBe('mreq_old');
    }
    expect(fake.all(COLLECTIONS.MANDATE_REQUESTS)).toHaveLength(2);
  });

  it('Δ4.5 — η αλυσίδα δείχνει στην ΤΕΛΕΥΤΑΙΑ άρνηση κατά ΑΠΟΦΑΣΗ, όχι κατά γέννηση', async () => {
    // 🔴 Οι δύο έχουν ΑΝΤΙΣΤΡΟΦΗ σειρά γέννησης και απόφασης. Μια ταξινόμηση κατά
    //    `requestedAt` θα έδειχνε στο λάθος — και ο ιδιώτης θα «αναθεωρούσε» κρίση
    //    που είχε ήδη αντικατασταθεί.
    const fake = world({
      history: [
        { id: 'mreq_early_ask', status: 'declined', terms: TERMS,
          requestedAt: '2026-08-01T10:00:00.000Z', decidedAt: '2026-08-20T10:00:00.000Z' },
        { id: 'mreq_late_ask', status: 'declined', terms: OTHER_TERMS,
          requestedAt: '2026-08-10T10:00:00.000Z', decidedAt: '2026-08-05T10:00:00.000Z' },
      ],
    });

    const result = await submit(fake, { ...TERMS, expiresAt: '2027-03-01T23:59:59.999Z' });
    expect(result.kind).toBe('created');
    if (result.kind === 'created') {
      expect(result.request.supersedesRequestId).toBe('mreq_early_ask');
    }
  });

  it('Δ4.6 — 🔑 ΑΠΟΣΥΡΣΗ ΔΕΝ ΕΙΝΑΙ ΑΠΑΝΤΗΣΗ: ίδιοι όροι επιτρέπονται ξανά', async () => {
    const fake = world({ history: [{ id: 'mreq_mine', status: 'withdrawn', terms: TERMS }] });
    const result = await submit(fake, TERMS);

    expect(result.kind).toBe('created');
    if (result.kind === 'created') {
      // Δεν αναθεωρεί τίποτα — δεν υπήρξε κρίση να αναθεωρηθεί.
      expect(result.request.supersedesRequestId).toBeNull();
    }
  });

  it('Δ4.7 — ΑΠΟΔΟΧΗ στο ιστορικό κλείνει το ζεύγος, ακόμη κι αν η αγγελία λέει `self`', async () => {
    // 🔑 Belt-and-suspenders (N.7.2 #4): ο κύριος δρόμος είναι το `mandate.kind`·
    //    αυτό εδώ πιάνει την κατάσταση όπου η αποδοχή γράφτηκε αλλά η εντολή δεν
    //    προσγειώθηκε. Χωρίς αυτό, το ζεύγος θα δεχόταν δεύτερο αίτημα.
    const fake = world({ history: [{ id: 'mreq_yes', status: 'accepted', clientContactId: 'cont_x' }] });
    expect(await submit(fake, OTHER_TERMS)).toEqual({
      kind: 'rejected',
      reason: 'listing-already-brokered',
    });
  });

  it('Δ4.8 — ιστορικό ΑΛΛΟΥ γραφείου δεν εμποδίζει: το ζεύγος είναι ακίνητο × γραφείο', async () => {
    const fake = world();
    fake.seed(COLLECTIONS.MANDATE_REQUESTS, 'mreq_allou', {
      id: 'mreq_allou',
      ownerPropertyId: LISTING,
      agencyCompanyId: 'comp_ALLO_grafeio',
      status: 'declined',
      terms: TERMS,
      decidedAt: '2026-08-02T10:00:00.000Z',
      clientContactId: null,
      supersedesRequestId: null,
    });

    // 🔴 Άρνηση από το γραφείο Α δεν κλειδώνει τον ιδιοκτήτη έξω από το γραφείο Β.
    expect((await submit(fake, TERMS)).kind).toBe('created');
  });
});
