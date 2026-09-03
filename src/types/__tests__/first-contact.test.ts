/**
 * Άγκυρες του **ADR-843** — η πράξη της πρώτης επαφής.
 *
 * 🔑 **Κάθε `describe` εδώ αντιστοιχεί σε ΦΡΟΥΡΟ, όχι σε συνάρτηση.** Ένα test που
 * απλώς «καλύπτει» το `disclosedToOfferer` θα ήταν πράσινο και μετά την πιο επικίνδυνη
 * αλλαγή· αυτά ρωτούν **τι υπόσχεται το ADR** και το **εκτελούν**.
 *
 * ⚠️ Το CHECK 3.54 ρωτά *«μπορεί αυτό το αρχείο να κοκκινίσει κάτι;»* — γι' αυτό κάθε
 * ομάδα σημειώνει **τη μετάλλαξη** που πρέπει να τη ρίξει.
 */

import {
  contactDetailsStillVisible,
  disclosedToOfferer,
  firstContactInvariantViolations,
  readStoredLifecycle,
  shownToSeeker,
  type FirstContact,
  type SeekerDisclosure,
} from '../first-contact';

const DISCLOSURE: SeekerDisclosure = {
  displayName: 'Ελένη Π.',
  email: 'eleni@example.gr',
  phone: null,
  acceptsPlatformMessages: false,
};

function makeContact(overrides: Partial<FirstContact> = {}): FirstContact {
  return {
    id: 'fcon_test_0001',
    seekerUserId: 'user-eleni',
    target: { kind: 'listing', listingId: 'ownp_0001' },
    demandId: 'dmnd_0001',
    disclosure: DISCLOSURE,
    matchReason: { unmetAxes: ['price-above'], declaredAxes: 5 },
    lifecycle: 'open',
    createdAt: '2026-09-03T10:00:00.000Z',
    withdrawnAt: null,
    seenAt: null,
    ...overrides,
  };
}

// ===========================================================================
// ΦΡΟΥΡΟΣ Κ10 — «ανακαλείται η ΣΧΕΣΗ, ποτέ η ΙΣΤΟΡΙΑ»
// ===========================================================================
// Μετάλλαξη που ΠΡΕΠΕΙ να ρίξει αυτή την ομάδα:
//   `disclosure: contact.disclosure` (χωρίς τον έλεγχο `open`)
//   — δηλαδή «η απόσυρση δεν σβήνει τίποτα από την οθόνη του άλλου».
// ===========================================================================

describe('ΠΕ6/Κ10 — η απόσυρση κόβει τα ΣΤΟΙΧΕΙΑ, κρατά το ΓΕΓΟΝΟΣ', () => {
  it('όσο είναι ανοιχτή, ο προσφέρων βλέπει τα στοιχεία', () => {
    const view = disclosedToOfferer(makeContact());

    expect(view.disclosure).toEqual(DISCLOSURE);
    expect(view.matchReason).not.toBeNull();
  });

  it('🔴 μόλις αποσυρθεί, τα στοιχεία ΦΕΥΓΟΥΝ από την προβολή', () => {
    const view = disclosedToOfferer(
      makeContact({ lifecycle: 'withdrawn', withdrawnAt: '2026-09-04T09:00:00.000Z' }),
    );

    expect(view.disclosure).toBeNull();
    expect(view.matchReason).toBeNull();
  });

  it('🔑 αλλά το ΓΕΓΟΝΟΣ και ο ΧΡΟΝΟΣ μένουν — το ίχνος είναι ΤΩΝ ΔΥΟ, όχι δικό μας', () => {
    const view = disclosedToOfferer(
      makeContact({ lifecycle: 'withdrawn', withdrawnAt: '2026-09-04T09:00:00.000Z' }),
    );

    expect(view.requestedAt).toBe('2026-09-03T10:00:00.000Z');
    expect(view.withdrawnAt).toBe('2026-09-04T09:00:00.000Z');
    expect(view.target).toEqual({ kind: 'listing', listingId: 'ownp_0001' });
  });

  it('το `contactDetailsStillVisible` δεν είναι δεύτερη λογική — συμφωνεί πάντα', () => {
    expect(contactDetailsStillVisible(makeContact())).toBe(true);
    expect(
      contactDetailsStillVisible(
        makeContact({ lifecycle: 'withdrawn', withdrawnAt: '2026-09-04T09:00:00.000Z' }),
      ),
    ).toBe(false);
  });
});

// ===========================================================================
// Η ΠΡΟΒΟΛΗ ΔΕΝ ΔΙΑΡΡΕΕΙ — ό,τι δεν είναι γραμμένο, δεν φεύγει
// ===========================================================================
// Μετάλλαξη: προσθήκη `demandId` ή `seekerUserId` στο `FirstContactForOfferer`.
// ===========================================================================

describe('🔴 η προβολή του προσφέροντος δεν κουβαλά κλειδιά προς το επίπεδο Β', () => {
  it('καμία ταυτότητα χρήστη και κανένα `demandId` δεν φτάνει στον παραλήπτη', () => {
    const view = disclosedToOfferer(makeContact());

    expect(view).not.toHaveProperty('seekerUserId');
    expect(view).not.toHaveProperty('demandId');
  });

  it('🔑 και ΚΑΝΕΝΑ ΜΕΓΕΘΟΣ απόκλισης — η τιμή επιφύλαξης είναι διαπραγματευτική θέση', () => {
    // Ο προσφέρων ξέρει τη ΔΙΚΗ ΤΟΥ τιμή· ένα `priceOverBy` θα του έδινε με μια
    // αφαίρεση την οροφή προϋπολογισμού του ζητούντος, στο ευρώ. Ο άνθρωπος διάλεξε
    // να αποκαλύψει ΠΟΙΟΣ ΕΙΝΑΙ, όχι ΠΟΣΟ ΜΠΟΡΕΙ ΝΑ ΔΩΣΕΙ.
    const reason = disclosedToOfferer(makeContact()).matchReason!;

    expect(Object.keys(reason).sort()).toEqual(['declaredAxes', 'unmetAxes']);
    expect(reason).not.toHaveProperty('priceOverBy');
    expect(reason).not.toHaveProperty('areaShortBy');
    expect(reason).not.toHaveProperty('distanceOverMetres');
  });

  it('οι ΑΞΟΝΕΣ όμως ταξιδεύουν — «η τιμή είναι πάνω από ό,τι ψάχνει», χωρίς πόσο', () => {
    expect(disclosedToOfferer(makeContact()).matchReason!.unmetAxes).toEqual(['price-above']);
  });

  it('ο ζητών βλέπει ΤΗ ΔΙΚΗ ΤΟΥ πράξη πλήρη, μαζί με το αν την είδε ο άλλος', () => {
    const view = shownToSeeker(makeContact({ seenAt: '2026-09-03T12:00:00.000Z' }));

    expect(view.seenAt).toBe('2026-09-03T12:00:00.000Z');
    expect(view.matchReason).not.toBeNull();
  });
});

// ===========================================================================
// FAIL-CLOSED — άγνωστη κατάσταση διαβάζεται ως `withdrawn`
// ===========================================================================
// Μετάλλαξη: `? { lifecycle: 'open', ... }` στο fallback του readStoredLifecycle.
// ===========================================================================

describe('η ανάγνωση αποθηκευμένης κατάστασης αστοχεί προς την ΑΣΦΑΛΗ πλευρά', () => {
  it('γνωστή τιμή περνά αυτούσια, χωρίς σημάδι επισκευής', () => {
    expect(readStoredLifecycle('open')).toEqual({ lifecycle: 'open', repaired: 'none' });
  });

  it.each([['ενεργή'], [''], [null], [undefined], [42], [{}]])(
    '🔴 άγνωστη τιμή (%p) ⇒ `withdrawn`: παραβίαση ιδιωτικότητας > σφάλμα μέτρησης κατά ένα',
    (value) => {
      expect(readStoredLifecycle(value)).toEqual({
        lifecycle: 'withdrawn',
        repaired: 'unreadable',
      });
    },
  );
});

// ===========================================================================
// ΤΑ ΑΜΕΤΑΒΛΗΤΑ
// ===========================================================================

describe('τα αμετάβλητα κρατούν την πράξη απαντήσιμη', () => {
  it('έγκυρη πράξη δεν παράγει καμία παραβίαση', () => {
    expect(firstContactInvariantViolations(makeContact())).toEqual([]);
  });

  it('🔴 πράξη χωρίς ΚΑΝΕΝΑ κανάλι είναι αδιέξοδο, όχι επαφή', () => {
    const orphan = makeContact({
      disclosure: { ...DISCLOSURE, email: null, phone: null, acceptsPlatformMessages: false },
    });

    expect(firstContactInvariantViolations(orphan)).toContain('contact-no-channel');
  });

  it.each([
    ['email', { ...DISCLOSURE, email: 'a@b.gr', phone: null, acceptsPlatformMessages: false }],
    ['τηλέφωνο', { ...DISCLOSURE, email: null, phone: '2310000000', acceptsPlatformMessages: false }],
    ['χώρος', { ...DISCLOSURE, email: null, phone: null, acceptsPlatformMessages: true }],
  ])('ΕΝΑ κανάλι αρκεί — ο άνθρωπος διαλέγει ποιο (%s)', (_label, disclosure) => {
    expect(firstContactInvariantViolations(makeContact({ disclosure })))
      .not.toContain('contact-no-channel');
  });

  it('όνομα μόνο με κενά μετρά ως απόν — ανώνυμο χτύπημα, όχι γνωριμία', () => {
    const nameless = makeContact({ disclosure: { ...DISCLOSURE, displayName: '   ' } });

    expect(firstContactInvariantViolations(nameless)).toContain('contact-no-name');
  });

  it.each([
    ['αποσυρμένη χωρίς χρόνο', { lifecycle: 'withdrawn' as const, withdrawnAt: null }],
    ['ανοιχτή ΜΕ χρόνο απόσυρσης', { lifecycle: 'open' as const, withdrawnAt: '2026-09-04T09:00:00.000Z' }],
  ])('η κατάσταση οφείλει να συμφωνεί με τον χρόνο της (%s)', (_label, patch) => {
    expect(firstContactInvariantViolations(makeContact(patch)))
      .toContain('contact-withdrawal-timeless');
  });

  it('ταυτότητα εκτός του ADR-843 προδίδει χειρόγραφο id (N.6)', () => {
    expect(firstContactInvariantViolations(makeContact({ id: 'mreq_0001' })))
      .toContain('contact-foreign-id');
  });

  it('🔑 λόγος χωρίς πηγή είναι ισχυρισμός που κανείς δεν μπορεί να ελέγξει', () => {
    const groundless = makeContact({ demandId: null });

    expect(firstContactInvariantViolations(groundless))
      .toContain('contact-reason-without-demand');
  });

  it('πράξη χωρίς ζήτηση ΚΑΙ χωρίς λόγο είναι απολύτως έγκυρη — ο καθένας πατά το κουμπί', () => {
    expect(firstContactInvariantViolations(makeContact({ demandId: null, matchReason: null })))
      .toEqual([]);
  });
});
