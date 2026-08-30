/**
 * ADR-827 Φάση Β — **ΤΟ ΑΙΤΗΜΑ ΑΝΑΘΕΣΗΣ**, και τι μαθαίνει το γραφείο.
 *
 * 🔴 **Τι φυλά αυτό το αρχείο που κανείς δεν φυλούσε**: το §8.6 απαγορεύει ρητά κάθε
 * `disclosure_log` / `disclosedFields`, δηλαδή **δεύτερο βιβλίο**. Η μόνη εγγύηση που
 * απομένει είναι ότι η **καθαρή συνάρτηση** {@link disclosedTo} λέει την αλήθεια — και
 * μια συνάρτηση χωρίς άγκυρα είναι σχόλιο (CHECK 3.54).
 *
 * ⚠️ **Κάθε ομάδα ξεκινά με ΠΑΡΟΝΟΜΑΣΤΗ.** Ένα test που δείχνει μόνο «η άρνηση δεν
 * αποκαλύπτει τίποτα» είναι πράσινο και όταν η συνάρτηση δεν αποκαλύπτει **ΠΟΤΕ**
 * τίποτα — δηλαδή όταν είναι σπασμένη προς την ασφαλή μεριά, που εδώ σημαίνει ότι η
 * οθόνη του ιδιώτη λέει **ψέματα προς τα κάτω**.
 */

import {
  DISCLOSED_DATA,
  LAWFUL_BASES,
  MANDATE_REQUEST_DECISIONS,
  MANDATE_REQUEST_INITIATORS,
  MANDATE_REQUEST_INVARIANTS,
  MANDATE_REQUEST_STATUSES,
  allowsResubmission,
  disclosedTo,
  hasBeenDisclosed,
  isMandateRequestDecision,
  isMandateRequestInitiator,
  isMandateRequestStatus,
  isRequestActionable,
  mandateRequestFromStored,
  mandateRequestInvariantViolations,
  readStoredRequestStatus,
  type MandateRequest,
  type MandateRequestDocument,
  type MandateRequestStatus,
  sameProposedTerms,
} from '@/types/mandate-request';
import { EXCLUSIVE_AGENCY, OPEN_LISTING } from '@/types/listing-agreement';
import { defaultExpiryFor } from '@/types/owner-property-mandate';

const NOW = '2026-08-29T10:00:00.000Z';

function request(overrides: Partial<MandateRequest> = {}): MandateRequest {
  return {
    id: 'mreq_test_0001',
    ownerPropertyId: 'ownp_test_0001',
    requestedByUserId: 'user-idiotis',
    agencyCompanyId: 'comp_grafeio',
    initiatedBy: 'owner',
    status: 'pending',
    terms: {
      agreement: EXCLUSIVE_AGENCY,
      compensation: { type: 'percentage', percentage: 2, vatIncluded: false },
      expiresAt: defaultExpiryFor(EXCLUSIVE_AGENCY, NOW) ?? '',
      scope: ['sell'],
      startsAt: NOW,
    },
    requestedAt: NOW,
    seenAt: null,
    decidedAt: null,
    clientContactId: null,
    supersedesRequestId: null,
    ...overrides,
  };
}

// ============================================================================
// Α — ΤΟ ΛΕΞΙΛΟΓΙΟ ΕΙΝΑΙ ΚΛΕΙΣΤΟ
// ============================================================================

describe('Α — τα κλειστά σύνολα, ονομαστικά', () => {
  it('🔑 Α0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: κάθε σύνολο έχει τις τιμές που δηλώνει, όχι λιγότερες', () => {
    expect([...MANDATE_REQUEST_INITIATORS]).toEqual(['owner', 'agency']);
    expect([...MANDATE_REQUEST_STATUSES]).toEqual([
      'pending',
      'accepted',
      'declined-revisable',
      'declined-final',
      'withdrawn',
    ]);
    expect([...MANDATE_REQUEST_DECISIONS]).toEqual([
      'accepted',
      'declined-revisable',
      'declined-final',
    ]);
    expect([...LAWFUL_BASES]).toEqual([
      '6-1-b-precontractual',
      '6-1-b-performance',
      '6-1-c',
    ]);
  });

  it('🔴 Α1 — ΔΕΝ υπάρχει `expired`: η λήξη ΥΠΟΛΟΓΙΖΕΤΑΙ, δεν αποθηκεύεται', () => {
    expect(MANDATE_REQUEST_STATUSES as readonly string[]).not.toContain('expired');
  });

  it('Α2 — οι φρουροί τύπου απορρίπτουν ό,τι έρχεται από το δίκτυο', () => {
    expect(isMandateRequestInitiator('owner')).toBe(true);
    expect(isMandateRequestInitiator('OWNER')).toBe(false);
    expect(isMandateRequestInitiator(null)).toBe(false);
    expect(isMandateRequestStatus('pending')).toBe(true);
    expect(isMandateRequestStatus('expired')).toBe(false);
    // Το κληροδοτημα ΔΕΝ ειναι γραπτη κατασταση — διαβαζεται, δεν γραφεται.
    expect(isMandateRequestStatus('declined')).toBe(false);
    expect(isMandateRequestDecision('accepted')).toBe(true);
    expect(isMandateRequestDecision('declined-final')).toBe(true);
    // Η αναμονη και η αποσυρση ΔΕΝ ειναι αποφασεις του γραφειου.
    expect(isMandateRequestDecision('pending')).toBe(false);
    expect(isMandateRequestDecision('withdrawn')).toBe(false);
  });

  it('A3 — ΚΑΘΕ ΑΠΟΦΑΣΗ ΕΙΝΑΙ ΚΑΤΑΣΤΑΣΗ: ο τυπος το επιβαλλει, η αγκυρα το ΕΚΤΕΛΕΙ', () => {
    // Το `satisfies` το εγγυαται σε χρονο μεταγλωττισης — αλλα μια εγγυηση που δεν
    // μπορει να κοκκινισει ειναι σχολιο (CHECK 3.54).
    for (const decision of MANDATE_REQUEST_DECISIONS) {
      expect(MANDATE_REQUEST_STATUSES as readonly string[]).toContain(decision);
    }
    // Το αντιστροφο ΔΕΝ ισχυει, επιτηδες: `pending`/`withdrawn` δεν αποφασιστηκαν απο
    // το γραφειο. Αν καποτε ταυτιστουν τα δυο συνολα, εδω κοκκινιζει.
    expect(MANDATE_REQUEST_DECISIONS.length).toBeLessThan(MANDATE_REQUEST_STATUSES.length);
  });
});

// ============================================================================
// Χ — Η ΕΞΟΥΣΙΑ ΤΩΝ ΔΥΟ «ΟΧΙ» (§9.21)
// ============================================================================

describe('Χ — τα δυο «οχι» διαφερουν σε ΕΞΟΥΣΙΑ, οχι σε υφος', () => {
  it('Χ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η συναρτηση ΞΕΧΩΡΙΖΕΙ, δεν απαντα παντα το ιδιο', () => {
    expect(allowsResubmission('declined-revisable')).toBe(true);
    expect(allowsResubmission('declined-final')).toBe(false);
  });

  it('Χ1 — «στειλε ξανα» και ΑΠΟΣΥΡΣΗ ανοιγουν την πορτα· ΤΙΠΟΤΑ αλλο', () => {
    const open = MANDATE_REQUEST_STATUSES.filter(allowsResubmission);
    expect([...open]).toEqual(['declined-revisable', 'withdrawn']);
  });

  it('Χ2 — η ΑΠΟΔΟΧΗ δεν ανοιγει πορτα: το ζευγος κλειδωσε', () => {
    expect(allowsResubmission('accepted')).toBe(false);
    // Και η αναμονη δεν ειναι «αδεια για δευτερο» — ειναι λογος να ΜΗΝ σταλει δευτερο.
    expect(allowsResubmission('pending')).toBe(false);
  });
});

// ============================================================================
// Κ — ΤΟ ΚΛΗΡΟΔΟΤΗΜΑ: ΤΟ ΠΑΛΙΟ «ΟΧΙ» ΔΙΑΒΑΖΕΤΑΙ, ΔΕΝ ΑΓΝΟΕΙΤΑΙ (§9.21)
// ============================================================================

describe('Κ — ο,τι βγαινει απο τη βαση διαβαζεται fail-closed', () => {
  it('Κ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: εγκυρη κατασταση περνα ΑΘΙΚΤΗ και δηλωνεται ΑΝΕΠΙΣΚΕΥΑΣΤΗ', () => {
    // Χωρις αυτο, ενας μεταφραστης που απαντα ΠΑΝΤΑ `declined-final` θα ηταν πρασινος
    // σε καθε επομενο test — και θα εκλεινε σιωπηλα καθε εκκρεμες αιτημα του εργου.
    for (const status of MANDATE_REQUEST_STATUSES) {
      expect(readStoredRequestStatus(status)).toEqual({ status, repaired: 'none' });
    }
  });

  it('Κ1 — το παλιο `declined` γινεται `declined-final`, ΚΑΙ Η ΕΠΙΣΚΕΥΗ ΛΕΓΕΤΑΙ', () => {
    expect(readStoredRequestStatus('declined')).toEqual({
      status: 'declined-final',
      repaired: 'legacy-declined',
    });
  });

  it('Κ2 — ΑΓΝΩΣΤΟ != ΚΕΝΟ: ο,τι δεν διαβαζεται κλεινει την πορτα, δεν εξαφανιζεται', () => {
    for (const rubbish of ['', 'ΟΤΙΝΑΝΑΙ', 'DECLINED', null, undefined, 7, {}]) {
      const reading = readStoredRequestStatus(rubbish);
      expect(reading.status).toBe('declined-final');
      expect(reading.repaired).toBe('unreadable');
    }
  });

  it('Κ3 — ΜΙΑ ΠΗΓΗ: ο μεταφραστης εγγραφου διαβαζει την ΙΔΙΑ συναρτηση', () => {
    const stored = { ...request(), status: 'declined' } as MandateRequestDocument;
    const parsed = mandateRequestFromStored(stored);

    expect(parsed.status).toBe('declined-final');
    // Και ΤΙΠΟΤΑ αλλο δεν αγγιζεται: ο μεταφραστης επισκευαζει ΕΝΑ πεδιο.
    expect({ ...parsed, status: 'declined' }).toEqual(stored);
  });

  it('Κ4 — Η ΣΥΝΕΠΕΙΑ ΕΙΝΑΙ Η ΑΣΦΑΛΗΣ: επισκευασμενο αιτημα ΔΕΝ αποκαλυπτει, ΔΕΝ κρινεται', () => {
    // Ο λογος που το αγνωστο γινεται `declined-final` και οχι `accepted`: καθε καταντη
    // ερωτηση παιρνει την ασφαλη απαντηση, χωρις δευτερο φρουρο πουθενα.
    const parsed = mandateRequestFromStored(
      { ...request(), status: 'ΧΑΛΑΣΜΕΝΟ' } as MandateRequestDocument,
    );
    expect(disclosedTo(parsed).engaged).toBe(false);
    expect(isRequestActionable(parsed, NOW)).toBe(false);
  });
});

// ============================================================================
// Δ — Η ΑΠΟΚΑΛΥΨΗ (§8.6)
// ============================================================================

describe('Δ — τι έχει φτάσει στο γραφείο: ΥΠΟΛΟΓΙΖΕΤΑΙ, δεν καταγράφεται', () => {
  it('🔑 Δ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η αποδοχή ΑΛΛΑΖΕΙ την απάντηση', () => {
    const pending = disclosedTo(request({ status: 'pending' }));
    const accepted = disclosedTo(
      request({ status: 'accepted', clientContactId: 'cont_x' }),
    );

    // Χωρίς αυτό, κάθε επόμενο test θα ήταν πράσινο και με συνάρτηση που
    // επιστρέφει ΠΑΝΤΑ το ίδιο.
    expect(accepted.items.length).toBeGreaterThan(pending.items.length);
    expect(pending.engaged).toBe(false);
    expect(accepted.engaged).toBe(true);
  });

  it('🔴 Δ1 — ΠΡΙΝ την αποδοχή ταξιδεύει ΤΙΠΟΤΑ του προσώπου (§8.2)', () => {
    const level = disclosedTo(request({ status: 'pending' }));
    const data = level.items.map((i) => i.datum);

    expect(data).toEqual(['listing', 'terms']);
    expect(data).not.toContain('name');
    expect(data).not.toContain('email');
    expect(data).not.toContain('vatNumber');
    // Και με το ΠΑΛΙΟ ονομα, ωστε μια «επαναφορα» της μετονομασιας να κοκκινισει.
    expect(DISCLOSED_DATA as readonly string[]).not.toContain('taxId');
  });

  it('🔴 Δ2 — ΑΡΝΗΣΗ και ΑΝΑΚΛΗΣΗ δίνουν ΤΑΥΤΟΣΗΜΗ απάντηση με την αναμονή (§8.4)', () => {
    const pending = disclosedTo(request({ status: 'pending' }));

    // ΚΑΙ ΤΑ ΔΥΟ «ΟΧΙ»: διαφερουν σε *τι επιτρεπεται μετα*, ΠΟΤΕ σε *τι εσταλη πριν*.
    // Ενα `declined-revisable` που αποκαλυπτε λιγο περισσοτερο «επειδη η συζητηση
    // συνεχιζεται» ειναι η ολισθηρη κλιμακα που το §8.2 κλεινει.
    for (const status of ['declined-revisable', 'declined-final', 'withdrawn'] as const) {
      const level = disclosedTo(request({ status }));
      expect(level.engaged).toBe(false);
      expect(level.items).toEqual(pending.items);
    }
  });

  it('Δ3 — ΜΕΤΑ την αποδοχή: όνομα + ΕΝΑ email + ΑΦΜ — και τίποτε άλλο (§8.3)', () => {
    const level = disclosedTo(
      request({ status: 'accepted', clientContactId: 'cont_x' }),
    );
    const data = level.items.map((i) => i.datum);

    expect(data).toEqual(['listing', 'terms', 'name', 'email', 'vatNumber']);
    // ⛔ ΤΗΛΕΦΩΝΟ ΟΧΙ: «useful but not objectively necessary» (EDPB 2/2019). Δίνεται
    //    με ξεχωριστή, ρητή πράξη — 6§1α, ανακλητή χωριστά.
    expect(DISCLOSED_DATA as readonly string[]).not.toContain('phone');
  });

  it('🔴 Δ4 — ΤΟ ΑΦΜ ΕΧΕΙ ΑΛΛΗ ΒΑΣΗ ΚΑΙ ΔΕΝ ΔΙΑΓΡΑΦΕΤΑΙ (§8.1)', () => {
    const level = disclosedTo(
      request({ status: 'accepted', clientContactId: 'cont_x' }),
    );

    const vatNumber = level.items.find((i) => i.datum === 'vatNumber');
    const email = level.items.find((i) => i.datum === 'email');

    // Δύο βάσεις, δύο δικαιώματα του υποκειμένου. Ένα σκαλάρ «επίπεδο» θα τα
    // συγχέει και θα έδινε ΛΑΘΟΣ απάντηση σε αίτημα διαγραφής — με σιγουριά.
    expect(vatNumber?.basis).toBe('6-1-c');
    expect(vatNumber?.erasable).toBe(false);
    expect(email?.basis).toBe('6-1-b-performance');
    expect(email?.erasable).toBe(true);
  });

  it('Δ5 — η αίτηση του ΥΠΟΚΕΙΜΕΝΟΥ είναι προσυμβατική, όχι εκτέλεση', () => {
    const level = disclosedTo(request({ status: 'pending' }));
    for (const item of level.items) {
      expect(item.basis).toBe('6-1-b-precontractual');
      expect(item.erasable).toBe(true);
    }
  });

  it('🔑 Δ6 — ΜΙΑ ΠΗΓΗ: ο βοηθός της οθόνης διαβάζει την ΙΔΙΑ συνάρτηση', () => {
    const pending = request({ status: 'pending' });
    const accepted = request({ status: 'accepted', clientContactId: 'cont_x' });

    expect(hasBeenDisclosed(pending, 'vatNumber')).toBe(false);
    expect(hasBeenDisclosed(accepted, 'vatNumber')).toBe(true);
    expect(hasBeenDisclosed(pending, 'listing')).toBe(true);
  });

  it('Δ7 — δεν εξαρτάται από ΤΙΠΟΤΑ άλλο πέρα από την κατάσταση', () => {
    // Ίδια κατάσταση, εντελώς άλλα πεδία ⇒ ίδια απάντηση. Αν κάποτε μπει
    // «αποκάλυψη επειδή το είδε» (`seenAt`), αυτό εδώ κοκκινίζει.
    const a = disclosedTo(request({ status: 'pending', seenAt: null }));
    const b = disclosedTo(
      request({ status: 'pending', seenAt: NOW, initiatedBy: 'agency' }),
    );
    expect(a).toEqual(b);
  });
});

// ============================================================================
// Ζ — ΤΙ ΕΙΝΑΙ ΑΚΟΜΗ ΖΩΝΤΑΝΟ
// ============================================================================

describe('Ζ — το αίτημα λήγει με ΡΟΛΟΪ, όχι με πεδίο', () => {
  it('🔑 Ζ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: εκκρεμές αίτημα με έγκυρη διάρκεια ΕΙΝΑΙ ενεργό', () => {
    expect(isRequestActionable(request(), NOW)).toBe(true);
  });

  it('Ζ1 — ό,τι έχει κριθεί δεν ξανακρίνεται', () => {
    for (const status of [
      'accepted',
      'declined-revisable',
      'declined-final',
      'withdrawn',
    ] as const) {
      const decided: MandateRequestStatus = status;
      expect(isRequestActionable(request({ status: decided }), NOW)).toBe(false);
    }
  });

  it('🔴 Ζ2 — ΙΔΙΟ αίτημα, ΔΥΟ ρολόγια, ΔΥΟ απαντήσεις', () => {
    const req = request();
    expect(isRequestActionable(req, NOW)).toBe(true);
    // Μία ημέρα μετά τη λήξη της προτεινόμενης εντολής.
    expect(isRequestActionable(req, '2027-04-30T10:00:00.000Z')).toBe(false);
  });

  it('🔴 Ζ3 — μη αναγνώσιμη ημερομηνία ⇒ ΟΧΙ ενεργό (fail-closed, άγνωστο ≠ κενό)', () => {
    const broken = request({
      terms: { ...request().terms, expiresAt: 'ΟΧΙ-ΗΜΕΡΟΜΗΝΙΑ' },
    });
    expect(isRequestActionable(broken, NOW)).toBe(false);
    expect(isRequestActionable(request(), 'ΟΧΙ-ΡΟΛΟΪ')).toBe(false);
  });

  it('🔑 Ζ4 — ΤΟ ΜΑΘΗΜΑ ΤΟΥ Μ3: η ασφάλεια είναι ιδιότητα της ΜΟΡΦΗΣ, όχι φρουρού', () => {
    // Ο ρητός έλεγχος `Number.isNaN(...)` ήταν **αδρανής**: η μετάλλαξη που τον
    // αφαιρούσε βγήκε ΠΡΑΣΙΝΗ, γιατί κάθε σύγκριση με NaN απαντά ήδη `false`.
    // Επικίνδυνη είναι η **λογικά ισοδύναμη αναστροφή** — και μόνο αυτή.
    const brokenExpiry = Date.parse('ΟΧΙ-ΗΜΕΡΟΜΗΝΙΑ');
    const now = Date.parse(NOW);

    expect(brokenExpiry > now).toBe(false); // ← η μορφή που χρησιμοποιείται
    expect(!(brokenExpiry <= now)).toBe(true); // ← η μορφή που ΘΑ ΕΛΕΓΕ «ζωντανό»

    // Άρα: αν κάποιος «απλοποιήσει» σε αναστροφή, το Ζ3 κοκκινίζει. Αυτή η γραμμή
    // υπάρχει ώστε ο λόγος να μη χαθεί στην επόμενη ανάγνωση.
    expect(isRequestActionable(
      request({ terms: { ...request().terms, expiresAt: 'ΟΧΙ-ΗΜΕΡΟΜΗΝΙΑ' } }),
      NOW,
    )).toBe(false);
  });
});

// ============================================================================
// Ι — ΤΑ ΑΜΕΤΑΒΛΗΤΑ
// ============================================================================

describe('Ι — τι δεν επιτρέπεται να γεννηθεί', () => {
  it('🔑 Ι0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: έγκυρο αίτημα δεν παράγει καμία παραβίαση', () => {
    expect(mandateRequestInvariantViolations(request(), NOW)).toEqual([]);
  });

  it('Ι1 — αίτημα χωρίς αγγελία ή χωρίς γραφείο', () => {
    expect(
      mandateRequestInvariantViolations(request({ ownerPropertyId: '  ' }), NOW),
    ).toContain('request-listing-missing');
    expect(
      mandateRequestInvariantViolations(request({ agencyCompanyId: '' }), NOW),
    ).toContain('request-agency-missing');
  });

  it('🔴 Ι2 — ΕΝΑΣ κωδικός για την άκυρη ημερομηνία, όχι δύο', () => {
    const found = mandateRequestInvariantViolations(
      request({ terms: { ...request().terms, expiresAt: 'χχχ' } }),
      NOW,
    );
    expect(found).toEqual(['request-expiry-invalid']);
    // ⚠️ Κάθε σύγκριση με NaN απαντά `false` ⇒ αν συνεχίζαμε τον έλεγχο, το
    //    «ξεπερνά τον νόμο» θα σιωπούσε πάνω σε χαλασμένο έγγραφο.
    expect(found).not.toContain('request-expiry-past');
  });

  it('🔴 Ι3 — ΔΕΝ ΞΑΝΑΓΡΑΦΕΙ ΤΟΝ ΝΟΜΟ: ρωτά την ίδια αρχή με τη δεύτερη πόρτα', () => {
    // Αποκλειστική εντολή 12 μηνών — άκυρη (άρθρο 200 §4: ανώτατο 8).
    const tooLong = request({
      terms: {
        ...request().terms,
        agreement: EXCLUSIVE_AGENCY,
        expiresAt: '2027-08-29T10:00:00.000Z',
      },
    });
    expect(mandateRequestInvariantViolations(tooLong, NOW)).toContain(
      'request-term-exceeds-statute',
    );

    // 🔑 Η ΙΔΙΑ διάρκεια σε ΑΠΛΗ εντολή περνά (§3: ανώτατο 12) — δηλαδή το όριο
    //    έρχεται ΑΠΟ ΤΟ ΕΙΔΟΣ, όχι από σταθερά γραμμένη εδώ.
    const openListing = request({
      terms: {
        ...request().terms,
        agreement: OPEN_LISTING,
        expiresAt: '2027-08-29T10:00:00.000Z',
      },
    });
    expect(mandateRequestInvariantViolations(openListing, NOW)).toEqual([]);
  });

  it('🔴 Ι4 — Η ΕΠΑΦΗ ΓΕΝΝΙΕΤΑΙ ΜΟΝΟ ΜΕ ΤΗΝ ΑΠΟΔΟΧΗ, ΚΑΙ ΠΑΝΤΑ (§8.4)', () => {
    // Αποδοχή ΧΩΡΙΣ επαφή — η ατομική πράξη έσπασε στη μέση.
    expect(
      mandateRequestInvariantViolations(request({ status: 'accepted' }), NOW),
    ).toContain('request-contact-inconsistent');

    // Άρνηση ΜΕ επαφή — το γραφείο κράτησε άνθρωπο που δεν έπρεπε να λάβει ποτέ.
    expect(
      mandateRequestInvariantViolations(
        request({ status: 'declined-revisable', clientContactId: 'cont_x' }),
        NOW,
      ),
    ).toContain('request-contact-inconsistent');

    // Και η σωστή αποδοχή δεν παράγει τίποτα.
    expect(
      mandateRequestInvariantViolations(
        request({ status: 'accepted', clientContactId: 'cont_x' }),
        NOW,
      ),
    ).toEqual([]);
  });

  it('Ι5 — επιστρέφει ΟΛΑ όσα βρίσκει, όχι το πρώτο', () => {
    const broken = request({
      ownerPropertyId: '',
      agencyCompanyId: '',
      status: 'accepted',
    });
    const found = mandateRequestInvariantViolations(broken, NOW);
    expect(found).toContain('request-listing-missing');
    expect(found).toContain('request-agency-missing');
    expect(found).toContain('request-contact-inconsistent');
  });

  it('🔴 Ι7 — ΑΔΙΑΒΑΣΤΗ ΕΝΑΡΞΗ ΔΕΝ ΣΙΩΠΑ ΤΟΝ ΝΟΜΟ (ADR-832)', () => {
    // 🔴 Ο νόμος μετριέται **από την έναρξη**, και κάθε σύγκριση με `NaN` απαντά
    //    `false`. Χωρίς τον δικό του κωδικό, χαλασμένο `startsAt` θα έκανε το
    //    `request-term-exceeds-statute` **αδρανές** — αίτημα οποιασδήποτε διάρκειας
    //    θα περνούσε (N.12: «άγνωστο» δεν γίνεται «καθαρό»).
    const found = mandateRequestInvariantViolations(
      request({
        terms: { ...request().terms, startsAt: 'ΟΧΙ-ΗΜΕΡΟΜΗΝΙΑ', expiresAt: '2099-01-01T00:00:00.000Z' },
      }),
      NOW,
    );
    expect(found).toContain('request-start-invalid');
    // ⚠️ Και **δεν** ισχυρίζεται ότι έκρινε τη διάρκεια: δεν μπόρεσε.
    expect(found).not.toContain('request-term-exceeds-statute');
  });

  it('🏆 Ι8 — ΠΡΟΓΡΑΜΜΑΤΙΣΜΕΝΗ εντολή δεν είναι παράνομη (ADR-832 §5.8)', () => {
    // 🏆 Οκτάμηνη αποκλειστική που **αρχίζει σε έξι μήνες**. Μετρημένη από «τώρα»
    //    ήταν δεκατετράμηνη ⇒ απορριπτόταν. Μετρημένη από την **έναρξη**, είναι
    //    ακριβώς αυτό που ο νόμος επιτρέπει — και είναι η δυνατότητα που κανένα MLS
    //    δεν προσφέρει (ADR-832 §4 #3).
    expect(
      mandateRequestInvariantViolations(
        request({
          terms: {
            ...request().terms,
            startsAt: '2027-02-28T00:00:00.000Z',
            expiresAt: '2027-08-28T23:59:59.999Z',
          },
        }),
        NOW,
      ),
    ).toEqual([]);
  });

  it('Ι6 — κάθε δηλωμένο αμετάβλητο είναι ΠΡΑΓΜΑΤΙ παραγώγιμο (κανένα νεκρό)', () => {
    const reachable = new Set<string>([
      ...mandateRequestInvariantViolations(
        request({ ownerPropertyId: '', agencyCompanyId: '', status: 'accepted' }),
        NOW,
      ),
      ...mandateRequestInvariantViolations(
        request({ terms: { ...request().terms, expiresAt: 'χχχ' } }),
        NOW,
      ),
      ...mandateRequestInvariantViolations(request(), '2027-04-30T10:00:00.000Z'),
      ...mandateRequestInvariantViolations(
        request({
          terms: { ...request().terms, expiresAt: '2027-08-29T10:00:00.000Z' },
        }),
        NOW,
      ),
      // Δ4 (§9.17 δ) — η αλυσίδα αναθεώρησης που δείχνει στον εαυτό της.
      ...mandateRequestInvariantViolations(
        request({ supersedesRequestId: 'mreq_test_0001' }),
        NOW,
      ),
      // ADR-832 — **ανάποδο διάστημα**: λήγει πριν αρχίσει.
      ...mandateRequestInvariantViolations(
        request({ terms: { ...request().terms, startsAt: '2027-06-01T00:00:00.000Z' } }),
        NOW,
      ),
    ]);

    for (const invariant of MANDATE_REQUEST_INVARIANTS) {
      expect(reachable).toContain(invariant);
    }
  });
});

// ============================================================================
// Κ — Δ4: Η ΑΛΥΣΙΔΑ ΑΝΑΘΕΩΡΗΣΗΣ ΚΑΙ Η ΤΑΥΤΟΤΗΤΑ ΤΗΣ ΕΡΩΤΗΣΗΣ (ADR-827 §9.17 δ)
// ============================================================================

describe('Κ — η αναθεώρηση είναι αλυσίδα, και η ερώτηση έχει ταυτότητα', () => {
  it('Κ1 — αίτημα που αναθεωρεί ΤΟΝ ΕΑΥΤΟ ΤΟΥ είναι άκυρο', () => {
    expect(
      mandateRequestInvariantViolations(
        request({ supersedesRequestId: 'mreq_test_0001' }),
        NOW,
      ),
    ).toContain('request-supersedes-self');
  });

  it('Κ2 — αίτημα που αναθεωρεί ΑΛΛΟ αίτημα είναι απολύτως έγκυρο', () => {
    // ⚠️ Ο φρουρός δεν επιτρέπεται να καταδικάζει τη νόμιμη αναθεώρηση — αλλιώς
    //    θα ήταν «ποτέ ξανά», που είναι η εναλλακτική που ΑΠΟΡΡΙΦΘΗΚΕ (§9.17 δ).
    expect(
      mandateRequestInvariantViolations(
        request({ supersedesRequestId: 'mreq_test_0000' }),
        NOW,
      ),
    ).toEqual([]);
  });

  it('Κ3 — και το `null` (πρώτο αίτημα) δεν παράγει τίποτα', () => {
    expect(mandateRequestInvariantViolations(request(), NOW)).toEqual([]);
  });

  it('Κ4 — ΙΔΙΟΙ όροι ⇒ ίδια ερώτηση (ιδεμποτησία Stripe)', () => {
    expect(sameProposedTerms(request().terms, request().terms)).toBe(true);
    // Και δύο ΞΕΧΩΡΙΣΤΑ αντικείμενα με τις ίδιες τιμές — ποτέ σύγκριση αναφοράς.
    expect(
      sameProposedTerms(request().terms, { ...request().terms }),
    ).toBe(true);
  });

  it('Κ5 — ΚΑΘΕ ένας από τους τρεις όρους αλλάζει την ταυτότητα, χωριστά', () => {
    const base = request().terms;
    // 🔑 Τρεις ανεξάρτητοι ισχυρισμοί: μονή μετάλλαξη σε οποιονδήποτε όρο πρέπει
    //    να κοκκινίζει ΜΟΝΗ της (το μάθημα του §9.16 γ).
    expect(sameProposedTerms(base, { ...base, agreement: OPEN_LISTING })).toBe(false);
    expect(sameProposedTerms(base, { ...base, expiresAt: '2027-01-01T23:59:59.999Z' })).toBe(false);
    expect(
      sameProposedTerms(base, {
        ...base,
        compensation: { type: 'percentage', percentage: 3, vatIncluded: false },
      }),
    ).toBe(false);
  });

  it('Κ6 — η ΑΜΟΙΒΗ συγκρίνεται ανά σκέλος: τύπος, ποσό, ΦΠΑ — και τα τρία', () => {
    const base = request().terms;
    const pct = (o: Partial<{ percentage: number; vatIncluded: boolean }>) => ({
      ...base,
      compensation: {
        type: 'percentage' as const,
        percentage: 2,
        vatIncluded: false,
        ...o,
      },
    });

    expect(sameProposedTerms(pct({}), pct({}))).toBe(true);
    expect(sameProposedTerms(pct({}), pct({ percentage: 2.5 }))).toBe(false);
    // 🔴 Ο ΦΠΑ ΜΟΝΟΣ ΤΟΥ αλλάζει τι πληρώνει ο άνθρωπος — δεν είναι λεπτομέρεια.
    expect(sameProposedTerms(pct({}), pct({ vatIncluded: true }))).toBe(false);

    // Άλλο σκέλος της ένωσης εξ ολοκλήρου.
    expect(
      sameProposedTerms(pct({}), {
        ...base,
        compensation: { type: 'fixed', amountEUR: 2, vatIncluded: false },
      }),
    ).toBe(false);
  });

  it('Κ7 — ΣΤΑΘΕΡΗ αμοιβή: το ποσό και ο ΦΠΑ, χωριστά', () => {
    const fixed = (amountEUR: number, vatIncluded: boolean) => ({
      ...request().terms,
      compensation: { type: 'fixed' as const, amountEUR, vatIncluded },
    });
    expect(sameProposedTerms(fixed(3000, false), fixed(3000, false))).toBe(true);
    expect(sameProposedTerms(fixed(3000, false), fixed(3500, false))).toBe(false);
    expect(sameProposedTerms(fixed(3000, false), fixed(3000, true))).toBe(false);
  });

  it('Κ8 — 🔴 Ο ΧΡΟΝΟΣ ΔΕΝ ΕΙΝΑΙ ΟΡΟΣ: δύο πατήματα σε άλλη στιγμή = ΙΔΙΑ ερώτηση', () => {
    // 🔴 Χωρίς αυτό, ένα `JSON.stringify(request)` θα περνούσε όλες τις παραπάνω
    //    και θα έκανε ΚΑΘΕ αίτημα μοναδικό — ιδεμποτησία που δεν πυροδοτεί ποτέ.
    const first = request({ requestedAt: '2026-08-29T10:00:00.000Z' });
    const second = request({ requestedAt: '2026-08-29T10:00:03.000Z', id: 'mreq_test_0002' });
    expect(sameProposedTerms(first.terms, second.terms)).toBe(true);
  });
});
