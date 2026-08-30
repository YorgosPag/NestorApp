/**
 * @jest-environment node
 *
 * @fileoverview **ΤΑ ΕΙΣΕΡΧΟΜΕΝΑ ΤΟΥ ΓΡΑΦΕΙΟΥ** — Σ2 (ADR-827 §9.21).
 * @related services/mandate/mandate-inbox.service.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΠΟΥ ΚΑΝΕΙΣ ΔΕΝ ΦΥΛΑΕΙ**: το §8.2 λέει ότι το γραφείο
 * βλέπει **σχήμα χωρίς πεδίο ταυτότητας**. Ο φρουρός είναι τύπος — αλλά ένας τύπος
 * **δεν κοκκινίζει**. Η σύνθεση (`mandateRequestForAgency`) είναι το σημείο όπου ένα
 * `{...request}` θα περνούσε το `requestedByUserId` **σιωπηλά**, και ο μεταγλωττιστής
 * **δεν** θα διαμαρτυρόταν: πλεονάζον πεδίο σε επιστρεφόμενο αντικείμενο δεν είναι
 * σφάλμα όταν προκύπτει από spread.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import {
  readAgencyRequest,
  readMandateInbox,
} from '@/services/mandate/mandate-inbox.service';
import { EXCLUSIVE_AGENCY } from '@/types/listing-agreement';
import type { MandateRequestDocument } from '@/types/mandate-request';

const NOW = '2026-08-29T12:00:00.000Z';
const AGENCY = 'comp_grafeio';
const OWNER_UID = 'user-idiotis';

const TERMS = {
  agreement: EXCLUSIVE_AGENCY,
  compensation: { type: 'percentage' as const, percentage: 2, vatIncluded: false },
  expiresAt: '2027-04-29T23:59:59.999Z',
  scope: ['sell'],
  startsAt: NOW,
};

const asAdmin = (fake: FakeFirestore) =>
  fake as unknown as Parameters<typeof readMandateInbox>[0];

/** Ένα αίτημα **και** η δημόσια προβολή του — εκτός αν ζητηθεί αλλιώς. */
function seed(
  fake: FakeFirestore,
  id: string,
  over: Partial<MandateRequestDocument> & { readonly withListing?: boolean } = {},
): void {
  const { withListing = true, ...request } = over;
  const listingId = (request.ownerPropertyId as string | undefined) ?? `ownp_${id}`;

  fake.seed(COLLECTIONS.MANDATE_REQUESTS, id, {
    id,
    ownerPropertyId: listingId,
    requestedByUserId: OWNER_UID,
    agencyCompanyId: AGENCY,
    initiatedBy: 'owner',
    status: 'pending',
    terms: TERMS,
    requestedAt: '2026-08-20T10:00:00.000Z',
    seenAt: null,
    decidedAt: null,
    clientContactId: null,
    supersedesRequestId: null,
    ...request,
  });

  if (withListing) {
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, listingId, {
      id: listingId,
      title: `Αγγελία ${id}`,
      type: 'apartment',
      areaSqm: 80,
    });
  }
}

const inboxOf = async (fake: FakeFirestore) => {
  const load = await readMandateInbox(asAdmin(fake), AGENCY, NOW);
  if (load.kind !== 'ready') throw new Error(`ΑΝΑΜΕΝΟΤΑΝ ready, ήρθε ${load.kind}`);
  return load.inbox;
};

// ============================================================================
// Σ — Η ΣΥΝΘΕΣΗ: τι ΔΕΝ φεύγει προς το γραφείο
// ============================================================================

describe('Σ — η προβολή δεν κουβαλά ταυτότητα (§8.2)', () => {
  it('🔑 Σ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η προβολή φτάνει ΓΕΜΑΤΗ, με αγγελία και όρους', async () => {
    const fake = new FakeFirestore();
    seed(fake, 'mreq_a');

    const row = (await inboxOf(fake)).groups.actionable[0];
    expect(row.id).toBe('mreq_a');
    expect(row.listing.title).toBe('Αγγελία mreq_a');
    expect(row.terms.agreement).toBe(EXCLUSIVE_AGENCY);
    expect(row.status).toBe('pending');
  });

  it('🔴 Σ1 — ΚΑΝΕΝΑ πεδίο ταυτότητας δεν διαρρέει, ΜΕ ΚΑΝΕΝΑ ΟΝΟΜΑ', async () => {
    // ⚠️ Ο ισχυρισμός είναι στο **σειριοποιημένο** αντικείμενο, όχι σε ονομαστικά
    //    πεδία: ένα `{...request}` στη σύνθεση θα περνούσε το `requestedByUserId`
    //    χωρίς ο μεταγλωττιστής να διαμαρτυρηθεί. Αυτό εδώ το πιάνει.
    const fake = new FakeFirestore();
    seed(fake, 'mreq_a');

    const raw = JSON.stringify((await inboxOf(fake)).groups.actionable[0]);
    expect(raw).not.toContain('requestedByUserId');
    expect(raw).not.toContain(OWNER_UID);
    expect(raw).not.toContain('agencyCompanyId');
    expect(raw).not.toContain('clientContactId');
  });

  it('🔑 Σ2 — Η ΑΛΥΣΙΔΑ ΦΤΑΝΕΙ: το γραφείο βλέπει ΠΟΙΟ δικό του «όχι» αναθεωρείται', async () => {
    // Το ADR το άφηνε ρητά ανοιχτό («ποιος το διαβάζει αποφασίζεται ξεχωριστά»). Χωρίς
    // αυτό, η αναθεώρηση διαβάζεται ως **δεύτερο, ταυτόσημο ερώτημα** — δηλαδή ως
    // επιμονή, και ο μεσίτης απαντά αναλόγως.
    const fake = new FakeFirestore();
    seed(fake, 'mreq_b', { supersedesRequestId: 'mreq_palio' });

    expect((await inboxOf(fake)).groups.actionable[0].supersedesRequestId).toBe('mreq_palio');
  });
});

// ============================================================================
// Ο — ΟΙ ΤΡΕΙΣ ΟΜΑΔΕΣ, ΜΕ ΣΕΙΡΑ ΕΠΕΙΓΟΝΤΟΣ
// ============================================================================

describe('Ο — «τι πρέπει να κάνω τώρα;», όχι «τι έχω;»', () => {
  it('🔑 Ο0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: οι τρεις κάδοι ΞΕΧΩΡΙΖΟΥΝ, δεν πέφτουν όλα σε έναν', async () => {
    const fake = new FakeFirestore();
    seed(fake, 'mreq_zwntano');
    seed(fake, 'mreq_ligmeno', { terms: { ...TERMS, expiresAt: '2026-01-01T00:00:00.000Z' } });
    seed(fake, 'mreq_krimeno', { status: 'declined-final', decidedAt: '2026-08-25T10:00:00.000Z' });

    const groups = (await inboxOf(fake)).groups;
    expect(groups.actionable.map((r) => r.id)).toEqual(['mreq_zwntano']);
    expect(groups.lapsed.map((r) => r.id)).toEqual(['mreq_ligmeno']);
    expect(groups.decided.map((r) => r.id)).toEqual(['mreq_krimeno']);
  });

  it('🔴 Ο1 — ΤΟ ΛΗΓΜΕΝΟ ΔΕΝ ΚΡΥΒΕΤΑΙ ΚΑΙ ΔΕΝ ΠΡΟΣΦΕΡΕΤΑΙ ΠΡΟΣ ΑΠΟΦΑΣΗ', async () => {
    // Κρυμμένο: το αίτημα «εξαφανίζεται» χωρίς εξήγηση. Στα `actionable`: του
    // προσφέρουμε κουμπί που ο διακομιστής **απορρίπτει** (`request-lapsed`).
    const fake = new FakeFirestore();
    seed(fake, 'mreq_ligmeno', { terms: { ...TERMS, expiresAt: '2026-01-01T00:00:00.000Z' } });

    const groups = (await inboxOf(fake)).groups;
    expect(groups.actionable).toHaveLength(0);
    expect(groups.lapsed).toHaveLength(1);
  });

  it('🔴 Ο2 — ΤΑ ΕΝΕΡΓΑ ΤΑΞΙΝΟΜΟΥΝΤΑΙ ΚΑΤΑ ΛΗΞΗ, ΟΧΙ ΚΑΤΑ ΑΦΙΞΗ', async () => {
    // 🔑 Η διαφορά ανάμεσα σε **λίστα** και σε **οθόνη τριάζ**: αυτό που πεθαίνει
    //    αύριο κρίνεται σήμερα, ακόμη κι αν ήρθε τελευταίο.
    const fake = new FakeFirestore();
    seed(fake, 'mreq_irthe_prwto', {
      requestedAt: '2026-08-01T10:00:00.000Z',
      terms: { ...TERMS, expiresAt: '2027-06-01T00:00:00.000Z' },
    });
    seed(fake, 'mreq_irthe_teleftaio', {
      requestedAt: '2026-08-28T10:00:00.000Z',
      terms: { ...TERMS, expiresAt: '2026-09-01T00:00:00.000Z' },
    });

    expect((await inboxOf(fake)).groups.actionable.map((r) => r.id)).toEqual([
      'mreq_irthe_teleftaio',
      'mreq_irthe_prwto',
    ]);
  });

  it('Ο3 — τα κριμένα ταξινομούνται ΑΝΤΙΣΤΡΟΦΑ: μνήμη, όχι προθεσμία', async () => {
    const fake = new FakeFirestore();
    seed(fake, 'mreq_palio', { status: 'declined-final', decidedAt: '2026-08-01T10:00:00.000Z' });
    seed(fake, 'mreq_neo', { status: 'accepted', decidedAt: '2026-08-28T10:00:00.000Z' });

    expect((await inboxOf(fake)).groups.decided.map((r) => r.id)).toEqual([
      'mreq_neo',
      'mreq_palio',
    ]);
  });

  it('🔴 Ο4 — ΞΕΝΟ γραφείο δεν φαίνεται ΠΟΥΘΕΝΑ', async () => {
    const fake = new FakeFirestore();
    seed(fake, 'mreq_diko_mou');
    seed(fake, 'mreq_allou', { agencyCompanyId: 'comp_ALLO' });

    const groups = (await inboxOf(fake)).groups;
    const all = [...groups.actionable, ...groups.lapsed, ...groups.decided];
    expect(all.map((r) => r.id)).toEqual(['mreq_diko_mou']);
  });
});

// ============================================================================
// Λ — Η ΑΓΓΕΛΙΑ ΠΟΥ ΕΦΥΓΕ: μετριέται, δεν εξαφανίζεται σιωπηλά
// ============================================================================

describe('Λ — αίτημα χωρίς δημόσια προβολή', () => {
  it('🔴 Λ1 — ΔΕΝ δείχνεται, ΑΛΛΑ ΜΕΤΡΙΕΤΑΙ', async () => {
    // Σιωπηλή εξαφάνιση = «0 = κανείς δεν κοίταξε». Ο μεσίτης που θυμάται 2 αιτήματα
    // και βλέπει 1 πρέπει να μάθει **γιατί**, όχι να υποθέσει βλάβη.
    const fake = new FakeFirestore();
    seed(fake, 'mreq_zwntano');
    seed(fake, 'mreq_apesyrmeno', { withListing: false });

    const inbox = await inboxOf(fake);
    expect(inbox.groups.actionable.map((r) => r.id)).toEqual(['mreq_zwntano']);
    expect(inbox.withoutListing).toBe(1);
  });

  it('Λ2 — καθαρά εισερχόμενα δηλώνουν ΜΗΔΕΝ, όχι undefined', async () => {
    const fake = new FakeFirestore();
    seed(fake, 'mreq_a');
    expect((await inboxOf(fake)).withoutListing).toBe(0);
  });
});

// ============================================================================
// Β — ΒΛΑΒΗ ≠ ΑΔΕΙΑ ΕΙΣΕΡΧΟΜΕΝΑ (N.12)
// ============================================================================

describe('Β — άγνωστο ≠ κενό', () => {
  it('🔴 Β1 — αναγνωστικό σφάλμα δίνει `unavailable`, ΠΟΤΕ άδειο κουτί', async () => {
    // Ένα «κανένα αίτημα» σε βλάβη λέει στον μεσίτη ότι **κανείς δεν τον ζήτησε** —
    // και θα το πίστευε.
    const fake = new FakeFirestore();
    seed(fake, 'mreq_a');
    fake.failReads = true;

    expect(await readMandateInbox(asAdmin(fake), AGENCY, NOW)).toEqual({
      kind: 'unavailable',
    });
  });

  it('Β2 — γραφείο χωρίς αιτήματα δίνει `ready` με άδειους κάδους', async () => {
    const inbox = await inboxOf(new FakeFirestore());
    expect(inbox.groups.actionable).toEqual([]);
    expect(inbox.unseen).toBe(0);
  });
});

// ============================================================================
// Ι — Η ΣΦΡΑΓΙΔΑ «ΤΟ ΕΙΔΑ»: ΜΙΑ φορά, στο ΑΝΟΙΓΜΑ
// ============================================================================

describe('Ι — το `seenAt` γράφεται στο άνοιγμα, ΜΙΑ φορά', () => {
  const openIt = (fake: FakeFirestore, now = NOW) =>
    readAgencyRequest(asAdmin(fake), 'mreq_a', AGENCY, now);

  it('🔑 Ι0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: το πρώτο άνοιγμα ΣΦΡΑΓΙΖΕΙ, και η προβολή το λέει', async () => {
    const fake = new FakeFirestore();
    seed(fake, 'mreq_a');

    const load = await openIt(fake);
    expect(load.kind).toBe('ready');
    if (load.kind === 'ready') expect(load.request.seenAt).toBe(NOW);
    expect(fake.all<{ seenAt: string }>(COLLECTIONS.MANDATE_REQUESTS)[0].seenAt).toBe(NOW);
  });

  it('🔴 Ι1 — ΤΟ ΔΕΥΤΕΡΟ ΑΝΟΙΓΜΑ ΔΕΝ ΜΕΤΑΚΙΝΕΙ ΤΗ ΣΦΡΑΓΙΔΑ ΚΑΙ ΔΕΝ ΓΡΑΦΕΙ', async () => {
    // ⚠️ Ένα `update({ seenAt })` χωρίς έλεγχο θα μετακινούσε τη σφραγίδα σε κάθε
    //    άνοιγμα — και το *«πόσο γρήγορα απαντά αυτό το γραφείο;»* θα μετρούσε **πάντα
    //    μηδέν**. Ο ισχυρισμός στις **εγγραφές** είναι που το πιάνει.
    const fake = new FakeFirestore();
    seed(fake, 'mreq_a');

    await openIt(fake);
    const writesAfterFirst = fake.writes;
    const second = await openIt(fake, '2026-08-30T09:00:00.000Z');

    expect(fake.writes).toBe(writesAfterFirst);
    if (second.kind === 'ready') expect(second.request.seenAt).toBe(NOW);
  });

  it('🔴 Ι2 — Η ΛΙΣΤΑ ΔΕΝ ΣΦΡΑΓΙΖΕΙ ΤΙΠΟΤΑ', async () => {
    // Η σφραγίδα ζει εκεί που **ανοίγει άνθρωπος**. Κρυμμένη στη λίστα θα σφράγιζε
    // και τα είκοσι αιτήματα επειδή κάποιος κοίταξε την οθόνη.
    const fake = new FakeFirestore();
    seed(fake, 'mreq_a');
    seed(fake, 'mreq_b');

    const before = fake.writes;
    const inbox = await inboxOf(fake);

    expect(fake.writes).toBe(before);
    expect(inbox.unseen).toBe(2);
  });

  it('🔴 Ι3 — ΞΕΝΟ αίτημα απαντά ΤΑΥΤΟΣΗΜΑ με ανύπαρκτο, ΚΑΙ ΔΕΝ ΣΦΡΑΓΙΖΕΤΑΙ', async () => {
    const fake = new FakeFirestore();
    seed(fake, 'mreq_a', { agencyCompanyId: 'comp_ALLO' });

    expect(await openIt(fake)).toEqual({ kind: 'absent' });
    expect(fake.all<{ seenAt: string | null }>(COLLECTIONS.MANDATE_REQUESTS)[0].seenAt).toBeNull();
    expect(await readAgencyRequest(asAdmin(new FakeFirestore()), 'mreq_a', AGENCY, NOW)).toEqual({
      kind: 'absent',
    });
  });

  it('Ι4 — αίτημα με αγγελία που αποσύρθηκε: δικό του σκέλος, όχι «δεν υπάρχει»', async () => {
    const fake = new FakeFirestore();
    seed(fake, 'mreq_a', { withListing: false });
    expect(await openIt(fake)).toEqual({ kind: 'listing-withdrawn' });
  });
});

// ============================================================================
// Κ — ΤΟ ΚΛΗΡΟΔΟΤΗΜΑ ΦΤΑΝΕΙ ΚΑΙ ΕΔΩ
// ============================================================================

describe('Κ — παλιό `declined` δείχνεται ως τελικό όχι', () => {
  it('🔴 Κ1 — δεν πέφτει έξω, δεν φαίνεται εκκρεμές: κρίθηκε', async () => {
    const fake = new FakeFirestore();
    seed(fake, 'mreq_palio', { status: 'declined', decidedAt: '2026-08-01T10:00:00.000Z' });

    const groups = (await inboxOf(fake)).groups;
    expect(groups.actionable).toHaveLength(0);
    expect(groups.decided.map((r) => r.status)).toEqual(['declined-final']);
  });
});
