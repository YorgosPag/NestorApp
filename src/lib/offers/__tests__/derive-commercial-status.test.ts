/**
 * Άγκυρες — ΠΑΡΑΓΩΓΗ κατάστασης από ΔΙΑΘΕΣΕΙΣ (ADR-777 Α20).
 *
 * 🔑 **ΔΕΥΤΕΡΗ ΦΩΝΗ, ΕΠΙΤΗΔΕΣ.** Ο πίνακας προσδοκιών είναι **χειρόγραφος**. Ένα
 * test που έχτιζε την προσδοκία καλώντας τα ίδια κατηγορήματα (`isLiveOffer`,
 * `kindsInLifecycle`) θα ήταν ο κριτής που κρίνει τον εαυτό του — το σχήμα που
 * το ADR-777 §8.7 πλήρωσε ήδη μία φορά, και που στη Φ.1 του ADR-771 άφησε **170
 * tests πράσινα πάνω σε αλλαγμένη συμπεριφορά**.
 *
 * 🔑 **ΚΛΕΙΣΤΗ ΚΑΛΥΨΗ.** Κρίνονται **και οι 16** συνδυασμοί `kind × lifecycle`
 * (4 × 4), ρητά και ονομαστικά, ώστε πέμπτο είδος ή πέμπτος κύκλος ζωής να μην
 * μπορεί να προσγειωθεί χωρίς να αποφασίσει κάποιος τι σημαίνει.
 *
 * ✅ **ΚΑΙ ΑΚΡΙΒΩΣ ΑΥΤΟ ΕΓΙΝΕ** (ADR-835, 2026-08-31): το `leaseShort` **κοκκίνισε**
 * αυτόν τον πίνακα πριν προλάβει να φτάσει σε οθόνη. Οι τέσσερις νέες γραμμές δεν
 * είναι κόστος — είναι η **απόδειξη** ότι ο φρουρός δουλεύει.
 */

import {
  closeOffer,
  deriveCommercialStatus,
  deriveOfferKinds,
  hasDuplicateLiveOfferKind,
  offerKindsFromLegacyStatus,
  offerKindsWithoutLegacyProjection,
  STATUSES_THAT_PROVE_NO_OFFER_KIND,
} from '../derive-commercial-status';
import {
  OFFER_KINDS,
  OFFER_LIFECYCLES,
  type ExchangeOffer,
  type LeaseOutOffer,
  type OfferKind,
  type OfferLifecycle,
  type PropertyOffer,
  type SellOffer,
  type ShortLeaseOffer,
} from '@/types/property-offers';
import {
  COMMERCIAL_STATUSES,
  type CommercialStatus,
} from '@/constants/commercial-statuses';

// =============================================================================
// ΒΟΗΘΗΤΙΚΑ
// =============================================================================

function sell(lifecycle: OfferLifecycle, askingPrice: number | null = 250000): SellOffer {
  return { id: `offr_sell_${lifecycle}`, kind: 'sell', lifecycle, askingPrice };
}

function leaseOut(lifecycle: OfferLifecycle, rentPrice: number | null = 700): LeaseOutOffer {
  return { id: `offr_lease_${lifecycle}`, kind: 'leaseOut', lifecycle, rentPrice };
}

function exchange(lifecycle: OfferLifecycle, percentage: number | null = 35): ExchangeOffer {
  return { id: `offr_exch_${lifecycle}`, kind: 'exchange', lifecycle, percentage };
}

function leaseShort(
  lifecycle: OfferLifecycle,
  nightlyRate: number | null = 65,
): ShortLeaseOffer {
  return {
    id: `offr_stay_${lifecycle}`,
    kind: 'leaseShort',
    lifecycle,
    nightlyRate,
    minNights: null,
    maxGuests: null,
  };
}

/**
 * Ένα δείγμα κάθε είδους — **`switch` χωρίς `default`**, ώστε πέμπτο είδος να μη
 * μεταγλωττίζεται εδώ. Ήταν φωλιασμένη τριαδική έκφραση, που **έπεφτε σιωπηλά** στο
 * `exchange` για κάθε άγνωστο είδος: η εξαντλητική δοκιμή θα έμενε πράσινη ελέγχοντας
 * την αντιπαροχή **τέσσερις** φορές, δηλαδή «πράσινο επειδή ρώτησα λάθος ερώτηση».
 */
function offerOf(kind: OfferKind, lifecycle: OfferLifecycle): PropertyOffer {
  switch (kind) {
    case 'sell':
      return sell(lifecycle);
    case 'leaseOut':
      return leaseOut(lifecycle);
    case 'exchange':
      return exchange(lifecycle);
    case 'leaseShort':
      return leaseShort(lifecycle);
  }
}

// =============================================================================
// Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ: το λεξιλόγιο δεν μεγάλωσε
// =============================================================================

describe('Μ0 — καμία όγδοη τιμή (Α20 σημείο 1)', () => {
  it('το COMMERCIAL_STATUSES παραμένει στις 7 τιμές', () => {
    expect(COMMERCIAL_STATUSES).toHaveLength(7);
  });

  it('κάθε παραγόμενη τιμή ανήκει στο υπάρχον λεξιλόγιο — εξαντλητικά', () => {
    // Κάθε δυνατός συνδυασμός ενός είδους με έναν κύκλο ζωής.
    for (const kind of OFFER_KINDS) {
      for (const lifecycle of OFFER_LIFECYCLES) {
        const offer: PropertyOffer = offerOf(kind, lifecycle);

        expect(COMMERCIAL_STATUSES).toContain(deriveCommercialStatus([offer]));
      }
    }
  });
});

// =============================================================================
// Κ1 — ΚΛΕΙΣΤΗ ΚΑΛΥΨΗ: 4 είδη × 4 κύκλοι ζωής = 16, χειρόγραφα
// =============================================================================

describe('Κ1 — ο πλήρης πίνακας μονής διάθεσης (χειρόγραφος)', () => {
  const TABLE: ReadonlyArray<readonly [string, PropertyOffer, string]> = [
    // --- ΠΩΛΗΣΗ ---
    ['πώληση ενεργή',        sell('active'),          'for-sale'],
    ['πώληση δεσμευμένη',    sell('reserved'),        'reserved'],
    ['πώληση κλεισμένη',     sell('closed'),          'sold'],
    ['πώληση αποσυρμένη',    sell('withdrawn'),       'unavailable'],
    // --- ΕΚΜΙΣΘΩΣΗ ---
    ['ενοικίαση ενεργή',     leaseOut('active'),      'for-rent'],
    ['ενοικίαση δεσμευμένη', leaseOut('reserved'),    'reserved'],
    ['ενοικίαση κλεισμένη',  leaseOut('closed'),      'rented'],
    ['ενοικίαση αποσυρμένη', leaseOut('withdrawn'),   'unavailable'],
    // --- ΑΝΤΙΠΑΡΟΧΗ — καμία προβολή, σε ΚΑΝΕΝΑΝ κύκλο ζωής ---
    ['αντιπαροχή ενεργή',    exchange('active'),      'unavailable'],
    ['αντιπαροχή δεσμευμένη', exchange('reserved'),   'unavailable'],
    ['αντιπαροχή κλεισμένη', exchange('closed'),      'unavailable'],
    ['αντιπαροχή αποσυρμένη', exchange('withdrawn'),  'unavailable'],
    // --- ΒΡΑΧΥΧΡΟΝΙΑ — καμία προβολή, σε ΚΑΝΕΝΑΝ κύκλο ζωής (ADR-835 §4.2) ---
    //
    // 🔴 Η **κλεισμένη** και η **δεσμευμένη** είναι οι δύο γραμμές που θα ήταν εύκολο
    // να γραφτούν λάθος, και είναι λάθος **με νόημα**:
    //   · `closed` → **ΟΧΙ `rented`**: μια ολοκληρωμένη διαμονή αφήνει το κατάλυμα
    //     ξανά ελεύθερο αύριο, ενώ το `rented` σημαίνει «έφυγε από την αγορά».
    //   · `reserved` → **ΟΧΙ `reserved`**: κρατημένες είναι κάποιες **ημέρες**, όχι
    //     το ακίνητο. Το επτάτιμο λεξιλόγιο δεν έχει λέξη για ημέρες.
    ['βραχυχρόνια ενεργή',     leaseShort('active'),    'unavailable'],
    ['βραχυχρόνια δεσμευμένη', leaseShort('reserved'),  'unavailable'],
    ['βραχυχρόνια κλεισμένη',  leaseShort('closed'),    'unavailable'],
    ['βραχυχρόνια αποσυρμένη', leaseShort('withdrawn'), 'unavailable'],
  ];

  it.each(TABLE)('%s → %s', (_label, offer, expected) => {
    expect(deriveCommercialStatus([offer])).toBe(expected);
  });

  it('ο πίνακας καλύπτει ΚΑΘΕ συνδυασμό — κλειστή λογιστική', () => {
    expect(TABLE).toHaveLength(OFFER_KINDS.length * OFFER_LIFECYCLES.length);
    expect(TABLE).toHaveLength(16);
  });
});

// =============================================================================
// Κ2 — ΣΥΝΔΥΑΣΜΟΙ: εδώ ζει η προτεραιότητα
// =============================================================================

describe('Κ2 — συνδυασμοί διαθέσεων', () => {
  it('πώληση ΚΑΙ ενοικίαση ενεργές → for-sale-and-rent', () => {
    expect(deriveCommercialStatus([sell('active'), leaseOut('active')]))
      .toBe('for-sale-and-rent');
  });

  it('🔴 κλεισμένη πώληση ΝΙΚΑ ενεργή ενοικίαση — πουλημένο δεν είναι «προς»', () => {
    expect(deriveCommercialStatus([sell('closed'), leaseOut('active')])).toBe('sold');
  });

  it('δέσμευση νικά διαθεσιμότητα', () => {
    expect(deriveCommercialStatus([sell('reserved'), leaseOut('active')])).toBe('reserved');
  });

  it('η σειρά του πίνακα ΔΕΝ αλλάζει το αποτέλεσμα', () => {
    const a = deriveCommercialStatus([sell('closed'), leaseOut('active')]);
    const b = deriveCommercialStatus([leaseOut('active'), sell('closed')]);
    expect(a).toBe(b);
  });
});

// =============================================================================
// Κ3 — 🔴 Η ΑΝΤΙΠΑΡΟΧΗ ΔΕΝ ΣΒΗΝΕΙ ΤΙΣ ΑΛΛΕΣ ΔΙΑΘΕΣΕΙΣ
// =============================================================================

describe('Κ3 — το είδος χωρίς προβολή δεν καταπίνει τα υπόλοιπα', () => {
  it('αντιπαροχή ενεργή + πώληση ενεργή → for-sale', () => {
    expect(deriveCommercialStatus([exchange('active'), sell('active')])).toBe('for-sale');
  });

  it('🔴 αντιπαροχή ΚΛΕΙΣΜΕΝΗ + πώληση ενεργή → for-sale, ΟΧΙ unavailable', () => {
    // Αν το `closed` έκανε πρόωρη έξοδο, μια κλεισμένη αντιπαροχή θα έκρυβε
    // σιωπηλά μια ζωντανή πώληση.
    expect(deriveCommercialStatus([exchange('closed'), sell('active')])).toBe('for-sale');
  });

  it('αντιπαροχή δεσμευμένη + ενοικίαση ενεργή → for-rent', () => {
    expect(deriveCommercialStatus([exchange('reserved'), leaseOut('active')])).toBe('for-rent');
  });
});

// =============================================================================
// Κ4 — ΚΕΝΕΣ ΕΙΣΟΔΟΙ
// =============================================================================

describe('Κ4 — κενό / απόν', () => {
  it.each([
    ['κενός πίνακας', [] as PropertyOffer[]],
    ['null', null],
    ['undefined', undefined],
  ])('%s → unavailable', (_label, offers) => {
    expect(deriveCommercialStatus(offers)).toBe('unavailable');
  });

  it('μόνο αποσυρμένες → unavailable (το ιστορικό δεν βάφει την οθόνη)', () => {
    expect(deriveCommercialStatus([sell('withdrawn'), leaseOut('withdrawn')]))
      .toBe('unavailable');
  });
});

// =============================================================================
// Κ5 — Ο ΔΕΥΤΕΡΟΣ ΑΞΟΝΑΣ: εδώ ΔΕΝ χάνεται τίποτα
// =============================================================================

describe('Κ5 — deriveOfferKinds', () => {
  it('🔑 η αντιπαροχή ΠΕΡΙΛΑΜΒΑΝΕΤΑΙ — εδώ ζει η αλήθεια', () => {
    expect(deriveOfferKinds([exchange('active')])).toEqual(['exchange']);
  });

  it('οι αποσυρμένες ΕΞΑΙΡΟΥΝΤΑΙ', () => {
    expect(deriveOfferKinds([sell('withdrawn')])).toEqual([]);
  });

  it('ταξινομημένο — ίδιες διαθέσεις, άλλη σειρά ⇒ ΤΑΥΤΟΣΗΜΟ αποτέλεσμα', () => {
    const a = deriveOfferKinds([leaseOut('active'), exchange('active'), sell('active')]);
    const b = deriveOfferKinds([sell('active'), leaseOut('active'), exchange('active')]);
    expect(a).toEqual(b);
    expect(a).toEqual(['exchange', 'leaseOut', 'sell']);
  });

  it('χωρίς διπλότυπα', () => {
    expect(deriveOfferKinds([sell('active'), sell('reserved')])).toEqual(['sell']);
  });

  it('κενό/απόν → κενός πίνακας', () => {
    expect(deriveOfferKinds(null)).toEqual([]);
    expect(deriveOfferKinds(undefined)).toEqual([]);
    expect(deriveOfferKinds([])).toEqual([]);
  });
});

// =============================================================================
// Κ6 — ΤΟ ΚΛΕΙΣΙΜΟ ΑΠΟΣΥΡΕΙ ΤΙΣ ΑΛΛΕΣ (Α20 σημείο 4)
// =============================================================================

describe('Κ6 — closeOffer', () => {
  it('🏆 κλείνοντας την πώληση, η ενοικίαση αποσύρεται ΤΗΝ ΙΔΙΑ ΣΤΙΓΜΗ', () => {
    const offers = [sell('active'), leaseOut('active')];
    const next = closeOffer(offers, 'offr_sell_active', null);

    expect(next.find((o) => o.kind === 'sell')?.lifecycle).toBe('closed');
    expect(next.find((o) => o.kind === 'leaseOut')?.lifecycle).toBe('withdrawn');
    // Και η παραγόμενη κατάσταση συμφωνεί, χωρίς ενδιάμεσο βήμα.
    expect(deriveCommercialStatus(next)).toBe('sold');
  });

  it('δεν αγγίζει ΗΔΗ κλεισμένες ή αποσυρμένες — το ιστορικό δεν ξαναγράφεται', () => {
    const historic = sell('closed');
    const withdrawnLease = leaseOut('withdrawn');
    const next = closeOffer([historic, withdrawnLease, exchange('active')], 'offr_exch_active', null);

    expect(next.find((o) => o.id === historic.id)?.lifecycle).toBe('closed');
    expect(next.find((o) => o.id === withdrawnLease.id)?.lifecycle).toBe('withdrawn');
  });

  it('άγνωστο id → αμετάβλητο περιεχόμενο', () => {
    const offers = [sell('active'), leaseOut('active')];
    expect(closeOffer(offers, 'offr_δεν_υπάρχει', null)).toEqual(offers);
  });

  it('🔑 ΚΑΘΑΡΗ — δεν μεταλλάσσει την είσοδο', () => {
    const offers = [sell('active'), leaseOut('active')];
    const snapshot = JSON.parse(JSON.stringify(offers)) as unknown;
    closeOffer(offers, 'offr_sell_active', null);
    expect(JSON.parse(JSON.stringify(offers))).toEqual(snapshot);
  });
});

// =============================================================================
// Κ7 — INVARIANT: μία ζωντανή διάθεση ανά είδος
// =============================================================================

describe('Κ7 — hasDuplicateLiveOfferKind', () => {
  it('δύο ενεργές πωλήσεις = δύο τιμές για ένα πράγμα ⇒ παράβαση', () => {
    expect(hasDuplicateLiveOfferKind([sell('active'), sell('reserved')])).toBe(true);
  });

  it('πώληση + ενοικίαση ενεργές = νόμιμο', () => {
    expect(hasDuplicateLiveOfferKind([sell('active'), leaseOut('active')])).toBe(false);
  });

  it('μία ζωντανή + μία αποσυρμένη ΙΔΙΟΥ είδους = νόμιμο (ιστορικό)', () => {
    expect(hasDuplicateLiveOfferKind([sell('active'), sell('withdrawn')])).toBe(false);
  });
});

// =============================================================================
// Κ8 — Η ΑΠΩΛΕΙΑ ΤΗΣ ΠΡΟΒΟΛΗΣ ΕΙΝΑΙ ΟΝΟΜΑΣΜΕΝΗ, ΟΧΙ ΣΙΩΠΗΛΗ
// =============================================================================

describe('Κ8 — offerKindsWithoutLegacyProjection', () => {
  it('ονομάζει την αντιπαροχή', () => {
    expect(offerKindsWithoutLegacyProjection([exchange('active')])).toEqual(['exchange']);
  });

  it('δεν ονομάζει είδη που ΕΧΟΥΝ προβολή', () => {
    expect(offerKindsWithoutLegacyProjection([sell('active'), leaseOut('active')])).toEqual([]);
  });
});

// =============================================================================
// Π — ΑΓΚΥΡΑ ΤΑΥΤΟΤΗΤΑΣ: τα 6 ΔΟΚΙΜΑΣΤΙΚΑ ΑΚΙΝΗΤΑ
// =============================================================================

/**
 * 🔑 **Η ΑΠΟΔΕΙΞΗ ΜΗΔΕΝΙΚΗΣ ΑΛΛΑΓΗΣ.** Τα έξι δοκιμαστικά ακίνητα
 * (`prop_a000000{1..6}`) έχουν **σημερινό, γνωστό** `commercialStatus`. Αν οι
 * ισοδύναμες διαθέσεις παράγουν **ταυτόσημη** τιμή, τότε η προσθήκη του μοντέλου
 * **δεν αλλάζει τίποτα** σε καμία υπάρχουσα οθόνη.
 *
 * ⚠️ Ο παρονομαστής είναι η **σημερινή τιμή στη βάση**, γραμμένη χειρόγραφα από
 * τον πίνακα του handoff §7 — **όχι** κάτι που υπολογίζει ο ίδιος ο κώδικας που
 * ελέγχεται.
 */
describe('Π — ισοδυναμία με τα 6 δοκιμαστικά ακίνητα (ADR-777 handoff §7)', () => {
  const FIXTURES: ReadonlyArray<readonly [string, PropertyOffer[], string]> = [
    ['Α — ενοικίαση ΜΕ ενοίκιο 500',       [leaseOut('active', 500)],                'for-rent'],
    ['Β — ενοικίαση ΧΩΡΙΣ ενοίκιο',        [leaseOut('active', null)],               'for-rent'],
    ['Γ — πώληση 250.000 + ενοίκιο 700',   [sell('active', 250000), leaseOut('active', 700)], 'for-sale-and-rent'],
    ['Δ — διπλό χωρίς ενοίκιο',            [sell('active', 250000), leaseOut('active', null)], 'for-sale-and-rent'],
    ['Ε — πωλημένο 185.000 (ζητούσε 200)', [{ ...sell('closed', 200000), finalPrice: 185000 }], 'sold'],
    ['ΣΤ — πωλημένο στην τιμή ζήτησης',    [{ ...sell('closed', 180000), finalPrice: 180000 }], 'sold'],
  ];

  it.each(FIXTURES)('%s → %s (ίδιο με σήμερα)', (_label, offers, expected) => {
    expect(deriveCommercialStatus(offers)).toBe(expected);
  });

  it('🔴 Β και Δ παραμένουν ΚΡΥΦΑ — η αυστηροποίηση της Α22 δεν αναιρείται', () => {
    // Η παραγωγή δίνει listed status· η ΠΥΛΗ ΕΜΦΑΝΙΣΗΣ είναι που τα κρύβει,
    // επειδή λείπει η τιμή. Δύο διαφορετικά ερωτήματα — και πρέπει να μείνουν δύο.
    expect(deriveCommercialStatus([leaseOut('active', null)])).toBe('for-rent');
  });
});

// =============================================================================
// Κ9 — Η ΑΝΤΙΣΤΡΟΦΗ: ο πλήρης πίνακας, ΧΕΙΡΟΓΡΑΦΟΣ
// =============================================================================
//
// 🔑 **ΔΕΥΤΕΡΗ ΦΩΝΗ.** Οι προσδοκίες γράφτηκαν διαβάζοντας τους **κλάδους** της
// `deriveCommercialStatus` — όχι καλώντας τον πίνακα που ελέγχεται. Ένα test που
// έγραφε `expect(fn(s)).toEqual(TABLE[s])` θα επικύρωνε τον εαυτό του.

describe('Κ9 — offerKindsFromLegacyStatus: ό,τι ΑΠΟΔΕΙΚΝΥΕΙ η κατάσταση', () => {
  const TABLE: ReadonlyArray<readonly [CommercialStatus, readonly OfferKind[], string]> = [
    ['for-sale',          ['sell'],             'ενεργή sell — βέβαιο'],
    ['for-rent',          ['leaseOut'],         'ενεργή leaseOut — βέβαιο'],
    ['for-sale-and-rent', ['leaseOut', 'sell'], 'ενεργές ΚΑΙ ΟΙ ΔΥΟ — βέβαιο'],
    ['sold',              ['sell'],             'κλεισμένη sell — βέβαιο'],
    ['rented',            ['leaseOut'],         'κλεισμένη leaseOut — βέβαιο'],
    ['reserved',          [],                   'sell Ή leaseOut — ΔΙΑΖΕΥΞΗ, δεν ονομάζεται'],
    ['unavailable',       [],                   'καμία ζωντανή Ή μόνο exchange — ΔΙΑΖΕΥΞΗ'],
  ];

  it.each(TABLE)('%s → [%s] (%s)', (status, expected) => {
    expect(offerKindsFromLegacyStatus(status)).toEqual(expected);
  });

  it('🔑 ΚΛΕΙΣΤΗ ΚΑΛΥΨΗ — κρίνονται και οι 7 τιμές, καμία δεν ξεφεύγει', () => {
    expect(TABLE.map(([status]) => status).sort()).toEqual([...COMMERCIAL_STATUSES].sort());
  });

  it('οι πίνακες είναι ΤΑΞΙΝΟΜΗΜΕΝΟΙ — ίδιο συμβόλαιο με το deriveOfferKinds', () => {
    for (const status of COMMERCIAL_STATUSES) {
      const kinds = offerKindsFromLegacyStatus(status);
      expect(kinds).toEqual([...kinds].sort());
    }
  });

  it('επιστρέφει ΝΕΟ πίνακα — ο πίνακας-πηγή δεν μολύνεται από τον καλούντα', () => {
    const first = offerKindsFromLegacyStatus('for-sale-and-rent');
    first.push('exchange');
    expect(offerKindsFromLegacyStatus('for-sale-and-rent')).toEqual(['leaseOut', 'sell']);
  });

  it('περνά από τον υπάρχοντα resolver — ελληνικά και legacy aliases, ΟΧΙ δεύτερος parser', () => {
    expect(offerKindsFromLegacyStatus('προς πώληση')).toEqual(['sell']);
    expect(offerKindsFromLegacyStatus('available')).toEqual(['sell']);
    expect(offerKindsFromLegacyStatus('  SOLD  ')).toEqual(['sell']);
  });

  it('άγνωστη / μη-συμβολοσειρά είσοδος ⇒ κενό, ποτέ σφάλμα (έρχεται από Firestore)', () => {
    expect(offerKindsFromLegacyStatus('κάτι τυχαίο')).toEqual([]);
    expect(offerKindsFromLegacyStatus(null)).toEqual([]);
    expect(offerKindsFromLegacyStatus(undefined)).toEqual([]);
    expect(offerKindsFromLegacyStatus(42)).toEqual([]);
    expect(offerKindsFromLegacyStatus('')).toEqual([]);
  });
});

// =============================================================================
// Κ10 — Η ΑΓΝΟΙΑ ΕΙΝΑΙ ΟΝΟΜΑΣΜΕΝΗ, ΚΑΙ ΠΑΡΑΓΟΜΕΝΗ ΑΠΟ ΜΙΑ ΠΗΓΗ
// =============================================================================

describe('Κ10 — STATUSES_THAT_PROVE_NO_OFFER_KIND', () => {
  it('είναι ΑΚΡΙΒΩΣ οι δύο διαζεύξεις — χειρόγραφα', () => {
    expect([...STATUSES_THAT_PROVE_NO_OFFER_KIND].sort()).toEqual(['reserved', 'unavailable']);
  });

  it('συμφωνεί με τη συνάρτηση για ΚΑΘΕ κατάσταση — μία αλήθεια, όχι δύο λίστες', () => {
    for (const status of COMMERCIAL_STATUSES) {
      const namesNothing = offerKindsFromLegacyStatus(status).length === 0;
      expect(STATUSES_THAT_PROVE_NO_OFFER_KIND.includes(status)).toBe(namesNothing);
    }
  });
});

// =============================================================================
// Θ — ΤΟ ΘΕΩΡΗΜΑ: η μετάφραση ΠΟΤΕ δεν ισχυρίζεται περισσότερα (125 σχήματα)
// =============================================================================
//
// 🏆 **ΑΠΟΔΕΙΞΗ, ΟΧΙ ΔΕΙΓΜΑ.** Κάθε είδος διάθεσης μπορεί να λείπει ή να έχει έναν
// από τους 4 κύκλους ζωής ⇒ **5³ = 125** εξαντλητικά σχήματα (το invariant «μία
// ζωντανή ανά είδος» τα κρατά όλα έγκυρα). Για καθένα ελέγχεται ότι
//
//   offerKindsFromLegacyStatus(deriveCommercialStatus(offers)) ⊆ deriveOfferKinds(offers)
//
// δηλαδή η επιστροφή στο νέο λεξιλόγιο **ποτέ δεν ονομάζει είδος που οι διαθέσεις
// δεν έχουν**. Τα MLS λύνουν την ίδια μετανάστευση με χαρτογράφηση σε υπολογιστικό
// φύλλο — **χωρίς κανένα αντικειμενικό κριτήριο ορθότητας**. Εδώ υπάρχει.

describe('Θ — ορθότητα της αντιστροφής σε ΟΛΑ τα 125 σχήματα διαθέσεων', () => {
  type Slot = OfferLifecycle | 'absent';
  const SLOTS: readonly Slot[] = [...OFFER_LIFECYCLES, 'absent'];

  const ALL_SHAPES: ReadonlyArray<readonly [string, PropertyOffer[]]> = SLOTS.flatMap((s) =>
    SLOTS.flatMap((l) =>
      SLOTS.map((e): readonly [string, PropertyOffer[]] => {
        const offers: PropertyOffer[] = [];
        if (s !== 'absent') offers.push(sell(s));
        if (l !== 'absent') offers.push(leaseOut(l));
        if (e !== 'absent') offers.push(exchange(e));
        return [`sell:${s} · leaseOut:${l} · exchange:${e}`, offers];
      })
    )
  );

  it('παράγονται πράγματι 125 σχήματα — ο παρονομαστής δηλώνεται', () => {
    expect(ALL_SHAPES).toHaveLength(125);
  });

  it.each(ALL_SHAPES)('%s — η μετάφραση είναι ΥΠΟΣΥΝΟΛΟ των πραγματικών ειδών', (_label, offers) => {
    const truth = new Set(deriveOfferKinds(offers));
    const translated = offerKindsFromLegacyStatus(deriveCommercialStatus(offers));

    for (const kind of translated) {
      expect(truth.has(kind)).toBe(true);
    }
  });

  it('🔴 και ΔΕΝ ισχύει ΚΕΝΑ: σε 70 από τα 125 η μετάφραση ονομάζει είδος', () => {
    // 🔑 Χωρίς αυτόν τον αριθμό το θεώρημα παραπάνω ισχύει **κενά**: μια συνάρτηση
    // που επιστρέφει πάντα `[]` το περνά καθαρή. Το «⊆» χρειάζεται πληθάριθμο.
    //
    // Ο παρονομαστής είναι **χειρόγραφος**, από τους κλάδους της παραγωγής:
    //   sell=closed                     → sold      →  1×5×5 = 25
    //   sell≠closed & lease=closed      → rented    →  4×1×5 = 20
    //   sell=active & lease=active      → for-s&r   →  1×1×5 =  5
    //   sell=active & lease∈{wd,absent} → for-sale  →  1×2×5 = 10
    //   lease=active & sell∈{wd,absent} → for-rent  →  2×1×5 = 10
    //                                                        ─────
    //                                                          70
    // Τα υπόλοιπα 55 είναι οι δύο διαζεύξεις: `reserved` (35) · `unavailable` (20).
    const naming = ALL_SHAPES.filter(
      ([, offers]) => offerKindsFromLegacyStatus(deriveCommercialStatus(offers)).length > 0
    );
    expect(naming).toHaveLength(70);
    expect(ALL_SHAPES.length - naming.length).toBe(55);
  });
});

// =============================================================================
// Π2 — ΤΑ 6 ΔΟΚΙΜΑΣΤΙΚΑ: τι θα δει η οθόνη ΜΕΤΑ τη διόρθωση
// =============================================================================
//
// ⚠️ Ο παρονομαστής είναι η **σημερινή τιμή στη βάση** (ζωντανή μέτρηση
// `firestore_query` στο `public_listings`, 6/6), όχι κάτι που υπολογίζει ο κώδικας.

describe('Π2 — τα 6 δημόσια έγγραφα αποκτούν είδος διάθεσης', () => {
  const LIVE: ReadonlyArray<readonly [string, CommercialStatus, readonly OfferKind[]]> = [
    ['Μεζονέτα 95 τ.μ.',   'for-sale',          ['sell']],
    ['Διαμέρισμα 95 τ.μ.', 'for-sale',          ['sell']],
    ['ΔΟΚΙΜΗ Α',           'for-rent',          ['leaseOut']],
    ['ΔΟΚΙΜΗ Β',           'for-rent',          ['leaseOut']],
    ['ΔΟΚΙΜΗ Γ',           'for-sale-and-rent', ['leaseOut', 'sell']],
    ['ΔΟΚΙΜΗ Δ',           'for-sale-and-rent', ['leaseOut', 'sell']],
  ];

  it.each(LIVE)('%s (%s) → [%s]', (_title, status, expected) => {
    expect(offerKindsFromLegacyStatus(status)).toEqual(expected);
  });

  it('🔴 κανένα από τα 6 δεν μένει πια με κενό άξονα', () => {
    for (const [, status] of LIVE) {
      expect(offerKindsFromLegacyStatus(status).length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// Κ13 — Η ΑΓΚΥΡΑ ΤΟΥ ADR-835 §13: **ΑΟΡΑΤΟ ΣΤΟ ΠΑΛΙΟ, ΟΡΑΤΟ ΣΤΟ ΝΕΟ**
// =============================================================================

/**
 * 🔴 **Η σύζευξη είναι το ζητούμενο, όχι τα δύο σκέλη χωριστά.** Το πρώτο σκέλος μόνο
 * του θα ήταν ικανοποιημένο και από ένα ακίνητο **που δεν υπάρχει στην αγορά**· το
 * δεύτερο μόνο του δεν αποκλείει το `for-rent`. Μαζί λένε ακριβώς αυτό που αποφάσισε
 * το §4.2: *«δεν χάνεται, αλλά δεν μολύνει»*.
 */
describe('Κ13 — ακίνητο ΜΟΝΟ προς βραχυχρόνια', () => {
  const offers = [leaseShort('active')];

  it('η ΚΑΤΑΣΤΑΣΗ δεν το ονομάζει — και ποτέ ως `for-rent`', () => {
    expect(deriveCommercialStatus(offers)).toBe('unavailable');
    expect(deriveCommercialStatus(offers)).not.toBe('for-rent');
  });

  it('ο ΑΞΟΝΑΣ το κουβαλά — εκεί δεν χάνεται τίποτα', () => {
    expect(deriveOfferKinds(offers)).toContain('leaseShort');
  });

  it('και η απώλεια είναι ΟΝΟΜΑΣΜΕΝΗ, όχι σιωπηλή', () => {
    expect(offerKindsWithoutLegacyProjection(offers)).toEqual(['leaseShort']);
  });

  it('η ΑΝΤΙΣΤΡΟΦΗ δεν το εφευρίσκει από το `unavailable`', () => {
    // Το `unavailable` είναι **διάζευξη** (καμία ζωντανή Ή μόνο είδη χωρίς προβολή).
    // Μια αντίστροφη που μάντευε `['leaseShort']` θα μετέτρεπε παραδεγμένη άγνοια σε
    // ισχυρισμό — και θα έβγαζε καταλύματα εκεί που δεν υπάρχουν.
    expect(offerKindsFromLegacyStatus('unavailable')).toEqual([]);
  });
});
