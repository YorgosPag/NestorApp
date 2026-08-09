/**
 * Άγκυρες — ΠΑΡΑΓΩΓΗ κατάστασης από ΔΙΑΘΕΣΕΙΣ (ADR-777 Α20).
 *
 * 🔑 **ΔΕΥΤΕΡΗ ΦΩΝΗ, ΕΠΙΤΗΔΕΣ.** Ο πίνακας προσδοκιών είναι **χειρόγραφος**. Ένα
 * test που έχτιζε την προσδοκία καλώντας τα ίδια κατηγορήματα (`isLiveOffer`,
 * `kindsInLifecycle`) θα ήταν ο κριτής που κρίνει τον εαυτό του — το σχήμα που
 * το ADR-777 §8.7 πλήρωσε ήδη μία φορά, και που στη Φ.1 του ADR-771 άφησε **170
 * tests πράσινα πάνω σε αλλαγμένη συμπεριφορά**.
 *
 * 🔑 **ΚΛΕΙΣΤΗ ΚΑΛΥΨΗ.** Κρίνονται **και οι 12** συνδυασμοί `kind × lifecycle`
 * (3 × 4), ρητά και ονομαστικά, ώστε τέταρτο είδος ή πέμπτος κύκλος ζωής να μην
 * μπορεί να προσγειωθεί χωρίς να αποφασίσει κάποιος τι σημαίνει.
 */

import {
  closeOffer,
  deriveCommercialStatus,
  deriveOfferKinds,
  hasDuplicateLiveOfferKind,
  offerKindsWithoutLegacyProjection,
} from '../derive-commercial-status';
import {
  OFFER_KINDS,
  OFFER_LIFECYCLES,
  type ExchangeOffer,
  type LeaseOutOffer,
  type OfferLifecycle,
  type PropertyOffer,
  type SellOffer,
} from '@/types/property-offers';
import { COMMERCIAL_STATUSES } from '@/constants/commercial-statuses';

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
        const offer: PropertyOffer =
          kind === 'sell'
            ? sell(lifecycle)
            : kind === 'leaseOut'
              ? leaseOut(lifecycle)
              : exchange(lifecycle);

        expect(COMMERCIAL_STATUSES).toContain(deriveCommercialStatus([offer]));
      }
    }
  });
});

// =============================================================================
// Κ1 — ΚΛΕΙΣΤΗ ΚΑΛΥΨΗ: 3 είδη × 4 κύκλοι ζωής = 12, χειρόγραφα
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
  ];

  it.each(TABLE)('%s → %s', (_label, offer, expected) => {
    expect(deriveCommercialStatus([offer])).toBe(expected);
  });

  it('ο πίνακας καλύπτει ΚΑΘΕ συνδυασμό — κλειστή λογιστική', () => {
    expect(TABLE).toHaveLength(OFFER_KINDS.length * OFFER_LIFECYCLES.length);
    expect(TABLE).toHaveLength(12);
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
