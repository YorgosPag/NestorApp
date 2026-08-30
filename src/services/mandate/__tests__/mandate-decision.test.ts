/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΚΡΙΤΗΣ ΤΟΥ Σ3** — ατομικότητα, αποκάλυψη, και το ΑΦΜ (ADR-827 §9.21).
 * @related services/mandate/mandate-decision.service.ts · mandate-acceptance.service.ts
 *
 * 🔴 **Η ΔΙΑΔΡΟΜΗ, ΟΧΙ ΤΟ ΕΝΔΙΑΜΕΣΟ**: κάθε άγκυρα εκτελεί το `decideMandateRequest` —
 * ό,τι τρέχει όταν ο μεσίτης πατά το κουμπί. Μια άγκυρα στη συναλλαγή μόνο θα
 * αποδείκνυε ότι ξέρει να γράφει· **όχι** ότι κάποιος της δίνει τα σωστά ορίσματα.
 *
 * ⚠️ **Ο `FakeFirestore` απέκτησε `runTransaction` ΓΙ' ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ** — έβδομη φορά
 * που ο πλαστός δεν είχε τη μέθοδο που μετράει. Και μαζί τη σκανδάλη `interfere`, χωρίς
 * την οποία η άγκυρα «διπλή αποδοχή» θα δοκίμαζε τον φρουρό της φάσης 1 και **ποτέ** το
 * CAS μέσα στη συναλλαγή.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { EXCLUSIVE_AGENCY, OPEN_LISTING } from '@/types/listing-agreement';
import { mandatesOf } from '@/types/owner-property-mandate';
import { brokeredMandate } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import type { MandateRequest } from '@/types/mandate-request';
import type { OwnerProperty } from '@/types/owner-property';

// ── Τα σύνορα που δεν είναι το ερώτημα αυτού του αρχείου ─────────────────────
//
// ⚠️ Το `findContactByEmail` καλεί **μόνο του** `getAdminFirestore()` — δεν δέχεται
//    λαβή. Δηλωμένο όριο του υπάρχοντος αναγνώστη· εδώ αντικαθίσταται ώστε η άγκυρα να
//    κρίνει **τη δική μας** απόφαση («υπάρχουσα ή νέα;») και όχι το ερώτημά του.
let existingContact: { contactId: string; name: string } | null = null;
let lookupThrows = false;

jest.mock('@/services/ai-pipeline/shared/contact-lookup-search', () => ({
  findContactByEmail: jest.fn(async () => {
    if (lookupThrows) throw new Error('LOOKUP_DOWN');
    return existingContact;
  }),
}));

const republished: string[] = [];
jest.mock('@/services/owner-property/owner-property-publication.service', () => ({
  republishOwnerProperty: jest.fn(async (_db: unknown, property: { id: string }) => {
    republished.push(property.id);
    return { publish: 'published', property };
  }),
}));

const audited: Record<string, unknown>[] = [];
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: {
    recordChange: jest.fn(async (entry: Record<string, unknown>) => {
      audited.push(entry);
    }),
  },
}));

let contactSeq = 0;
jest.mock('@/services/enterprise-id-convenience', () => ({
  generateContactId: jest.fn(() => `cont_neo_${(contactSeq += 1)}`),
}));

jest.mock('@/services/company/company-public-name.reader', () => ({
  readCompanyPublicName: jest.fn(async () => 'Δοκιμαστικό Μεσιτικό Γραφείο'),
}));

// ⚠️ **Ο αγωγός αντικαθίσταται, ΟΧΙ ο αποστολέας**: το ερώτημα εδώ είναι *«ποιος
//    ειδοποιείται, για τι, και ΠΟΣΕΣ φορές»* — όχι πώς φτιάχνεται το email. Το
//    τελευταίο το κρίνει ο ίδιος ο αγωγός, στο δικό του αρχείο.
const announced: Record<string, unknown>[] = [];
jest.mock('@/services/mandate/mandate-request-notifier.service', () => ({
  announceMandateRequestAnswer: jest.fn(async (_db: unknown, answer: Record<string, unknown>) => {
    announced.push(answer);
    return true;
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { decideMandateRequest } =
  require('@/services/mandate/mandate-decision.service') as typeof import('@/services/mandate/mandate-decision.service');

const NOW = '2026-08-29T12:00:00.000Z';
const AGENCY = 'comp_grafeio';
const CLERK = 'user-ypallilos';
const OWNER_UID = 'user-idiotis';
const LISTING = 'ownp_0001';
const REQUEST = 'mreq_0001';
/** ΑΦΜ που περνά τον mod-11 ελεγκτή του `lib/validation/vat-validation.ts`. */
const VALID_VAT = '094014201';

const TERMS = {
  agreement: EXCLUSIVE_AGENCY,
  compensation: { type: 'percentage' as const, percentage: 2, vatIncluded: false },
  expiresAt: '2027-04-29T23:59:59.999Z',
  scope: ['sell'],
  startsAt: NOW,
};

/** Ένας κόσμος όπου **όλα** είναι εντάξει — κάθε δοκιμή χαλάει ΕΝΑ πράγμα. */
function world(over: {
  readonly request?: Partial<MandateRequest>;
  readonly listing?: Record<string, unknown> | null;
  readonly profile?: Record<string, unknown> | null;
} = {}): FakeFirestore {
  const fake = new FakeFirestore();

  fake.seed(COLLECTIONS.MANDATE_REQUESTS, REQUEST, {
    id: REQUEST,
    ownerPropertyId: LISTING,
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
    ...(over.request ?? {}),
  });

  if (over.listing !== null) {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, LISTING, {
      id: LISTING,
      authorUserId: OWNER_UID,
      authorCompanyId: null,
      lifecycle: 'listed',
      mandates: [], mandatesExpireAt: null,
      updatedAt: '2026-08-20T10:00:00.000Z',
      ...(over.listing ?? {}),
    });
  }

  if (over.profile !== null) {
    fake.seed(COLLECTIONS.USERS, OWNER_UID, {
      uid: OWNER_UID,
      email: 'idiotis@example.gr',
      givenName: 'Κώστας',
      familyName: 'Παπαδόπουλος',
      vatNumber: VALID_VAT,
      ...(over.profile ?? {}),
    });
  }

  return fake;
}

const asAdmin = (fake: FakeFirestore) =>
  fake as unknown as Parameters<typeof decideMandateRequest>[0];

const decide = (
  fake: FakeFirestore,
  decision: 'accepted' | 'declined-revisable' | 'declined-final' = 'accepted',
) =>
  decideMandateRequest(asAdmin(fake), {
    requestId: REQUEST,
    agencyCompanyId: AGENCY,
    deciderUid: CLERK,
    decision,
    nowISO: NOW,
  });

const storedRequest = (fake: FakeFirestore) =>
  fake.all<MandateRequest>(COLLECTIONS.MANDATE_REQUESTS)[0];
const storedListing = (fake: FakeFirestore) =>
  fake.all<OwnerProperty>(COLLECTIONS.OWNER_PROPERTIES)[0];
const storedContacts = (fake: FakeFirestore) =>
  fake.all<Record<string, unknown>>(COLLECTIONS.CONTACTS);

beforeEach(() => {
  existingContact = null;
  lookupThrows = false;
  contactSeq = 0;
  republished.length = 0;
  audited.length = 0;
  announced.length = 0;
});

// ============================================================================
// Α — Η ΑΤΟΜΙΚΟΤΗΤΑ
// ============================================================================

describe('Α — τρεις γραφές, μία πράξη', () => {
  it('🔑 Α0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο καθαρός δρόμος γράφει ΚΑΙ ΤΑ ΤΡΙΑ', async () => {
    const fake = world();
    const result = await decide(fake);

    expect(result.kind).toBe('decided');

    // 1. Η επαφή γεννήθηκε, **με το ΑΦΜ αντιγραμμένο**.
    const contacts = storedContacts(fake);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].vatNumber).toBe(VALID_VAT);
    expect(contacts[0].companyId).toBe(AGENCY);

    // 2. Η εντολή γράφτηκε, και είναι **επιβεβαιωμένη χωρίς σύνδεσμο**: η συγκατάθεση
    //    ΕΙΝΑΙ το ίδιο το αίτημα (§8.4).
    // ⚠️ **`mandatesOf`, ΠΟΤΕ ωμό `.mandates`** (ADR-832): ο κόσμος ξεκινά από
    //    έγγραφο **χωρίς** τον πληθυντικό — έτσι ζουν τα `self` της ζωντανής βάσης.
    const mandate = mandatesOf(storedListing(fake))[0];
    expect(mandate?.kind).toBe('brokered');
    if (mandate !== undefined) {
      expect(mandate.confirmation).toBe('confirmed');
      expect(mandate.consentNonce).toBeNull();
      expect(mandate.confirmedByUserId).toBe(OWNER_UID);
      expect(mandate.agreement).toBe(TERMS.agreement);
      expect(mandate.expiresAt).toBe(TERMS.expiresAt);
      // ⚠️ «Πότε μίλησε ο άνθρωπος» = όταν ΕΣΤΕΙΛΕ, όχι όταν απάντησε το γραφείο.
      expect(mandate.decidedAt).toBe('2026-08-20T10:00:00.000Z');
      // Ο ιδιώτης δεν το ξέρει ακόμη — και αυτό είναι η αλήθεια, όχι έλλειψη.
      expect(mandate.notifiedAt).toBeNull();
    }

    // 3. Το αίτημα έκλεισε και **δείχνει** στην επαφή.
    const request = storedRequest(fake);
    expect(request.status).toBe('accepted');
    expect(request.decidedAt).toBe(NOW);
    expect(request.clientContactId).toBe(contacts[0].id ?? 'cont_neo_1');

    // Και ο κόσμος το έμαθε — ΕΞΩ από τη συναλλαγή.
    expect(republished).toEqual([LISTING]);
  });

  it('🔴 Α1 — ΔΥΟ ΥΠΑΛΛΗΛΟΙ ΤΑΥΤΟΧΡΟΝΑ: το CAS αφήνει ΜΙΑ επαφή και ΜΙΑ εντολή', async () => {
    // ────────────────────────────────────────────────────────────────────────
    // 🏆 Η ΑΓΚΥΡΑ ΠΟΥ ΔΕΝ ΜΠΟΡΟΥΣΕ ΝΑ ΓΡΑΦΤΕΙ ΠΡΙΝ ΤΟ `interfere`
    // ────────────────────────────────────────────────────────────────────────
    // Ο συνάδελφος δεσμεύει το αίτημα **ανάμεσα** στο `get` της συναλλαγής και στο
    // commit. Το σώμα ξαναεκτελείται, βλέπει `accepted`, και **σταματά**.
    //
    // ⚠️ Ο ισχυρισμός που μετράει ΔΕΝ είναι «γύρισε άρνηση» — είναι ότι **καμία επαφή
    //    δεν γράφτηκε**. Ένα CAS που απαντά σωστά αλλά έχει ήδη γράψει είναι χειρότερο
    //    από καθόλου CAS.
    const fake = world();
    fake.interfere = () => {
      fake.seed(COLLECTIONS.MANDATE_REQUESTS, REQUEST, {
        ...storedRequest(fake),
        status: 'accepted',
        decidedAt: '2026-08-29T11:59:59.000Z',
        clientContactId: 'cont_tou_synadelfou',
      });
    };

    expect(await decide(fake)).toEqual({
      kind: 'refused',
      reason: 'request-not-pending',
    });

    expect(storedContacts(fake)).toHaveLength(0);
    // 🔑 **Κενός πίνακας ΕΙΝΑΙ το παλιό `self`** (ADR-832 §5.4) — η απουσία εντολής
    //    δεν χρειάζεται όνομα, και ο συμβατός αναγνώστης το λέει και για τα δύο σχήματα.
    expect(mandatesOf(storedListing(fake))).toHaveLength(0);
    expect(republished).toEqual([]);
  });

  it('🔴 Α2 — Η ΑΓΓΕΛΙΑ ΚΑΤΑΛΗΦΘΗΚΕ ΑΠΟΚΛΕΙΣΤΙΚΑ ΣΤΟ ΜΕΤΑΞΥ: τίποτα δεν γράφτηκε', async () => {
    // ────────────────────────────────────────────────────────────────────────
    // 🔴 **ΑΥΤΗ Η ΑΓΚΥΡΑ ΞΑΝΑΓΡΑΦΤΗΚΕ** (ADR-832). Απαιτούσε
    // `reason: 'listing-already-brokered'` — τον κωδικό του φρουρού
    // `mandate.kind !== 'self'`, δηλαδή *«υπάρχει γραφείο; τέλος»*. Εκείνος ο
    // φρουρός **έφυγε**, γιατί απέρριπτε και τις τρεις νόμιμες περιπτώσεις
    // (απλή · άλλη πράξη · διαδοχική). Στη θέση του κρίνει ο κριτής κατάληψης,
    // και ο λόγος είναι πλουσιότερος: όχι *«έχει εντολή»* αλλά **ποιος** κρατά
    // **ποια πράξη** και **ως πότε**.
    //
    // ⚠️ Γι' αυτό ο ανταγωνιστής εδώ γράφει **ΑΠΟΚΛΕΙΣΤΙΚΗ στην ΙΔΙΑ πράξη**:
    // μια απλή, ή μια αποκλειστική εκμίσθωσης, θα περνούσε — και **σωστά**.
    // ────────────────────────────────────────────────────────────────────────
    const fake = world();
    const rival = brokeredMandate({
      agencyCompanyId: 'comp_antagwnistis',
      agreement: EXCLUSIVE_AGENCY,
      confirmation: 'confirmed',
      clientContactId: 'cont_allou',
      scope: ['sell'],
      startsAt: '2026-08-01T00:00:00.000Z',
      expiresAt: '2027-08-01T00:00:00.000Z',
    });
    fake.interfere = () => {
      fake.seed(COLLECTIONS.OWNER_PROPERTIES, LISTING, {
        ...storedListing(fake),
        mandates: [rival],
        mandatesExpireAt: rival.expiresAt,
      });
    };

    const result = await decide(fake);
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') {
      expect(result.reason).toBe('mandate-invalid');
      // 🔑 **Ο κωδικός λέει «υπάρχει σύγκρουση», όχι «με ποιον»** — το όνομα του
      //    αντιπάλου είναι δεδομένο και ταξιδεύει χωριστά (ADR-832 §5.7).
      expect(result.violations).toContain('mandate-conflicts-existing');
    }
    expect(storedContacts(fake)).toHaveLength(0);
    expect(storedRequest(fake).status).toBe('pending');
  });

  it('🏆 Α2α — ΑΠΛΗ κατάληψη ξένου γραφείου ΔΕΝ εμποδίζει την αποδοχή απλής', async () => {
    // 🏆 Ο παρονομαστής της Α2: χωρίς αυτήν, η Α2 θα περνούσε και με φρουρό
    //    «υπάρχει εντολή; τέλος» — δηλαδή δεν θα ξεχώριζε το σωστό από το λάθος.
    const fake = world({ request: { terms: { ...TERMS, agreement: OPEN_LISTING } } });
    const neighbour = brokeredMandate({
      agencyCompanyId: 'comp_geitonas',
      agreement: OPEN_LISTING,
      confirmation: 'confirmed',
      clientContactId: 'cont_allou',
      scope: ['sell'],
      startsAt: '2026-08-01T00:00:00.000Z',
      expiresAt: '2027-08-01T00:00:00.000Z',
    });
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, LISTING, {
      ...storedListing(fake),
      mandates: [neighbour],
      mandatesExpireAt: neighbour.expiresAt,
    });

    expect((await decide(fake)).kind).toBe('decided');
    // ⚠️ Και η ξένη κατάληψη **έμεινε**: η αποδοχή προσθέτει, δεν αντικαθιστά.
    expect(mandatesOf(storedListing(fake))).toHaveLength(2);
  });

  it('Α3 — αίτημα ήδη κριμένο δεν ξανακρίνεται', async () => {
    for (const status of ['accepted', 'declined-revisable', 'declined-final', 'withdrawn'] as const) {
      const fake = world({ request: { status } });
      expect(await decide(fake)).toEqual({
        kind: 'refused',
        reason: 'request-not-pending',
      });
      expect(storedContacts(fake)).toHaveLength(0);
    }
  });

  it('🔴 Α4 — ΛΗΓΜΕΝΗ πρόταση δεν κρίνεται ΟΥΤΕ ΘΕΤΙΚΑ ΟΥΤΕ ΑΡΝΗΤΙΚΑ', async () => {
    // Θα ήταν εύκολο να επιτραπεί η άρνηση «αφού δεν πειράζει κανέναν». Θα σήμαινε
    // όμως ότι ένα `declined-final` κλείνει την πόρτα για αγγελία που **κανείς δεν
    // αξιολόγησε**. Το ληγμένο αίτημα σβήνει μόνο του.
    const lapsed = { terms: { ...TERMS, expiresAt: '2026-01-01T00:00:00.000Z' } };
    for (const decision of ['accepted', 'declined-final'] as const) {
      const fake = world({ request: lapsed });
      expect(await decide(fake, decision)).toEqual({
        kind: 'refused',
        reason: 'request-lapsed',
      });
      expect(storedRequest(fake).status).toBe('pending');
    }
  });

  it('Α5 — ΞΕΝΟ αίτημα απαντά ΤΑΥΤΟΣΗΜΑ με ανύπαρκτο (§9.4)', async () => {
    const foreign = world({ request: { agencyCompanyId: 'comp_ALLO' } });
    const missing = new FakeFirestore();

    expect(await decide(foreign)).toEqual({ kind: 'refused', reason: 'request-absent' });
    expect(await decide(missing)).toEqual({ kind: 'refused', reason: 'request-absent' });
  });

  it('🔑 Α6 — ΥΠΑΡΧΟΥΣΑ επαφή αναγνωρίζεται: καμία δεύτερη καρτέλα, κανένα ίχνος «created»', async () => {
    existingContact = { contactId: 'cont_palia', name: 'Κώστας Παπαδόπουλος' };
    const fake = world();

    const result = await decide(fake);
    expect(result).toEqual({
      kind: 'decided',
      decision: 'accepted',
      clientContactId: 'cont_palia',
    });
    expect(storedContacts(fake)).toHaveLength(0);
    expect(storedRequest(fake).clientContactId).toBe('cont_palia');
    // Υπάρχουσα καρτέλα ΔΕΝ «δημιουργήθηκε» επειδή την αναγνωρίσαμε.
    expect(audited).toHaveLength(0);
  });

  it('🔴 Α7 — ΒΛΑΒΗ στον έλεγχο διπλότυπου ⇒ ΑΡΝΗΣΗ, ποτέ «γράψε καινούρια»', async () => {
    // Μια αποτυχία διαβασμένη ως «δεν υπάρχει» παράγει **δεύτερη καρτέλα για τον ίδιο
    // άνθρωπο** — δεύτερο αντίγραφο προσωπικών δεδομένων (§8.4).
    lookupThrows = true;
    const fake = world();

    expect(await decide(fake)).toEqual({ kind: 'unavailable' });
    expect(storedContacts(fake)).toHaveLength(0);
    expect(storedRequest(fake).status).toBe('pending');
  });
});

// ============================================================================
// Φ — ΤΟ ΑΦΜ ΩΣ ΠΡΟΫΠΟΘΕΣΗ (ΚΞΧ, Ν.4557/2018 άρ.30 §3)
// ============================================================================

describe('Φ — χωρίς φορολογική ταυτότητα δεν γεννιέται σύμβαση', () => {
  it('🔑 Φ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ΜΕ έγκυρο ΑΦΜ η αποδοχή περνά', async () => {
    expect((await decide(world())).kind).toBe('decided');
  });

  it('🔴 Φ1 — ΧΩΡΙΣ ΑΦΜ: άρνηση, και το αίτημα ΜΕΝΕΙ εκκρεμές', async () => {
    for (const vatNumber of [null, '', '   ']) {
      const fake = world({ profile: { vatNumber } });
      expect(await decide(fake)).toEqual({
        kind: 'refused',
        reason: 'identity-incomplete',
      });
      // 🔑 Τίποτα δεν χάνεται: ο ιδιώτης συμπληρώνει, το γραφείο ξαναπατά.
      expect(storedRequest(fake).status).toBe('pending');
      expect(storedContacts(fake)).toHaveLength(0);
    }
  });

  it('🔴 Φ2 — ΑΚΥΡΟ ΑΦΜ (σπασμένο ψηφίο ελέγχου) απορρίπτεται όπως το κενό', async () => {
    // ⚠️ Ο έλεγχος δεν είναι «εννέα ψηφία»: είναι ο **mod-11** του
    //    `lib/validation/vat-validation.ts`. Η μετάλλαξη «δέξου ό,τι έχει 9 ψηφία»
    //    κοκκινίζει εδώ.
    const fake = world({ profile: { vatNumber: '094014202' } });
    expect(await decide(fake)).toEqual({
      kind: 'refused',
      reason: 'identity-incomplete',
    });
  });

  it('Φ3 — προφίλ που δεν υπάρχει καθόλου απαντά το ίδιο', async () => {
    expect(await decide(world({ profile: null }))).toEqual({
      kind: 'refused',
      reason: 'identity-incomplete',
    });
  });
});

// ============================================================================
// Δ — Η ΑΠΟΚΑΛΥΨΗ: η άρνηση ΔΕΝ γεννά τίποτα (§8.4)
// ============================================================================

describe('Δ — το γραφείο που αρνήθηκε δεν έλαβε ΠΟΤΕ τίποτα', () => {
  it('🔑 Δ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: και οι δύο αρνήσεις ΓΡΑΦΟΝΤΑΙ', async () => {
    for (const decision of ['declined-revisable', 'declined-final'] as const) {
      const fake = world();
      expect(await decide(fake, decision)).toEqual({
        kind: 'decided',
        decision,
        clientContactId: null,
      });
      expect(storedRequest(fake).status).toBe(decision);
      expect(storedRequest(fake).decidedAt).toBe(NOW);
    }
  });

  it('🔴 Δ1 — ΚΑΜΙΑ ΕΠΑΦΗ, καμία εντολή, καμία δημοσίευση σε καμία από τις δύο', async () => {
    for (const decision of ['declined-revisable', 'declined-final'] as const) {
      const fake = world();
      await decide(fake, decision);

      expect(storedContacts(fake)).toHaveLength(0);
      expect(mandatesOf(storedListing(fake))).toHaveLength(0);
      expect(storedRequest(fake).clientContactId).toBeNull();
      expect(republished).toEqual([]);
      expect(audited).toHaveLength(0);
    }
  });

  it('🔴 Δ2 — Η ΑΡΝΗΣΗ ΔΕΝ ΕΞΑΡΤΑΤΑΙ ΑΠΟ ΤΗΝ ΤΑΥΤΟΤΗΤΑ ΤΟΥ ΙΔΙΩΤΗ', async () => {
    // Γραφείο που θέλει να πει «όχι» δεν επιτρέπεται να εμποδίζεται επειδή ο ιδιώτης
    // δεν συμπλήρωσε το ΑΦΜ του. Κοινός δρόμος με σημαία `if (accepted)` θα το έκανε.
    const fake = world({ profile: { vatNumber: null } });
    expect((await decide(fake, 'declined-final')).kind).toBe('decided');
  });

  it('🔴 Δ3 — ΚΑΙ Η ΑΡΝΗΣΗ ΕΧΕΙ CAS: δεν γράφεται «όχι» πάνω σε αποδοχή συναδέλφου', async () => {
    const fake = world();
    fake.interfere = () => {
      fake.seed(COLLECTIONS.MANDATE_REQUESTS, REQUEST, {
        ...storedRequest(fake),
        status: 'accepted',
        clientContactId: 'cont_tou_synadelfou',
      });
    };

    expect(await decide(fake, 'declined-final')).toEqual({
      kind: 'refused',
      reason: 'request-not-pending',
    });
    // Το έγγραφο του συναδέλφου έμεινε άθικτο — αλλιώς θα υπήρχε αίτημα με επαφή ΚΑΙ
    // τελικό όχι, που παραβιάζει μόνιμα το `request-contact-inconsistent`.
    expect(storedRequest(fake).status).toBe('accepted');
    expect(storedRequest(fake).clientContactId).toBe('cont_tou_synadelfou');
  });
});

// ============================================================================
// Τ — Ο ΤΥΠΟΣ ΕΙΝΑΙ Ο ΦΡΟΥΡΟΣ
// ============================================================================

describe('Τ — το αίτημα ΔΕΝ έχει πεδίο ΑΦΜ, και δεν αποκτά', () => {
  it('🔴 Τ1 — ΚΑΝΕΝΑ αποθηκευμένο αίτημα δεν κουβαλά φορολογικό στοιχείο', async () => {
    // 🔑 Ο φρουρός είναι ο τύπος (`MandateRequestForAgencyOpenGaps`), αλλά ένας τύπος
    //    δεν κοκκινίζει — ελέγχει. Αυτό εδώ **εκτελεί** (CHECK 3.54): αν κάποιος
    //    προσθέσει `vatNumber` στο έγγραφο του αιτήματος, σπάει.
    const fake = world();
    await decide(fake);

    const raw = JSON.stringify(storedRequest(fake));
    expect(raw).not.toContain(VALID_VAT);
    expect(raw).not.toContain('vatNumber');
    expect(raw).not.toContain('taxId');

    // Και το ΑΦΜ **υπάρχει** στο γέννημα της αποδοχής, εκεί που ο νόμος το θέλει.
    expect(JSON.stringify(storedContacts(fake)[0])).toContain(VALID_VAT);
  });

  it('🔴 Τ2 — ΤΟ ΙΧΝΟΣ ΕΛΕΓΧΟΥ ΤΗΣ ΕΠΑΦΗΣ ΔΕΝ ΚΟΥΒΑΛΑ ΤΟ ΑΦΜ', async () => {
    // Το `entity_audit_trail` είναι **δεύτερη** συλλογή με άλλους αναγνώστες. Ένα ΑΦΜ
    // αντιγραμμένο εκεί θα ήταν διαρροή που κανένας κανόνας της επαφής δεν φυλά.
    const fake = world();
    await decide(fake);

    expect(audited).toHaveLength(1);
    expect(JSON.stringify(audited[0])).not.toContain(VALID_VAT);
    expect(audited[0].companyId).toBe(AGENCY);
    expect(audited[0].performedBy).toBe(CLERK);
  });
});

// ============================================================================
// Ε — Η ΕΙΔΟΠΟΙΗΣΗ: ο ιδιώτης μαθαίνει, ΜΙΑ φορά
// ============================================================================

describe('Ε — ο αντίστροφος αγωγός', () => {
  it('🔑 Ε0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: κάθε απόφαση που ΓΡΑΦΤΗΚΕ φτάνει στον ΑΙΤΟΥΝΤΑ', async () => {
    for (const decision of ['accepted', 'declined-revisable', 'declined-final'] as const) {
      announced.length = 0;
      contactSeq = 0;
      const fake = world();
      await decide(fake, decision);

      expect(announced).toHaveLength(1);
      // 🔴 **ΠΑΡΑΛΗΠΤΗΣ Ο ΑΙΤΩΝ, ΠΟΤΕ Ο ΚΡΙΝΩΝ.** Η μετάλλαξη που βάζει
      //    `deciderUid` εδώ στέλνει στον μεσίτη μήνυμα για την πράξη που μόλις έκανε
      //    ο ίδιος — και ο ιδιώτης δεν μαθαίνει ΠΟΤΕ τίποτα.
      expect(announced[0].recipientUserId).toBe(OWNER_UID);
      expect(announced[0].recipientUserId).not.toBe(CLERK);
      expect(announced[0].decision).toBe(decision);
      expect(announced[0].requestId).toBe(REQUEST);
    }
  });

  it('🔴 Ε1 — ΔΕΥΤΕΡΟ ΠΑΤΗΜΑ ΙΔΙΑΣ ΑΠΟΦΑΣΗΣ ⇒ ΚΑΜΙΑ δεύτερη ειδοποίηση', async () => {
    // 🔑 Η ιδεμποτησία **δεν χρειάστηκε δικό της βιβλίο**: την κληρονομεί από τη
    //    γραφή. Το CAS απαντά `request-not-pending` στο δεύτερο πάτημα, και ο
    //    φρουρός `kind === 'decided'` κόβει τον αγωγό.
    const fake = world();
    await decide(fake, 'declined-final');
    await decide(fake, 'declined-final');

    expect(announced).toHaveLength(1);
  });

  it('🔴 Ε2 — ΑΡΝΗΣΗ ΤΟΥ ΣΥΣΤΗΜΑΤΟΣ ΔΕΝ ΕΙΝΑΙ ΑΠΟΦΑΣΗ: καμία ειδοποίηση', async () => {
    // Χωρίς ΑΦΜ, με ληγμένη πρόταση, ή σε ξένο αίτημα — τίποτα δεν γράφτηκε, άρα
    // τίποτα δεν ανακοινώνεται. Μια ειδοποίηση εδώ θα έλεγε στον ιδιώτη ότι κρίθηκε
    // κάτι που **μένει εκκρεμές**.
    for (const fake of [
      world({ profile: { vatNumber: null } }),
      world({ request: { terms: { ...TERMS, expiresAt: '2026-01-01T00:00:00.000Z' } } }),
      world({ request: { agencyCompanyId: 'comp_ALLO' } }),
    ]) {
      await decide(fake);
    }
    expect(announced).toEqual([]);
  });
});
