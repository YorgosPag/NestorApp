/**
 * @fileoverview **Τα invariants της προσφοράς** — η ίδια συνάρτηση που φρουρεί την πύλη.
 * @related ADR-777 §7 (Α14 · Α20 · Α22) · §25.6 · types/owner-property.ts
 */

import {
  isLiveOwnerProperty,
  isOwnerPropertyLifecycle,
  newOwnerProperty,
  ownerPropertyOfferKinds,
} from '../owner-property';
import {
  ownerPropertyInvariantViolations,
  OWNER_PROPERTY_INVARIANTS,
} from '../owner-property-invariants';
import {
  offerOf,
  validDraft,
  validOwnerProperty,
} from '@/lib/owner-property/__tests__/owner-property-fixtures';

describe('ownerPropertyInvariantViolations — ΟΛΕΣ, ποτέ η πρώτη', () => {
  it('Κ1 — ένα πλήρες προσχέδιο δεν παραβιάζει τίποτα (ο παρονομαστής)', () => {
    expect(ownerPropertyInvariantViolations(validDraft())).toEqual([]);
  });

  it('Κ2 — καμία ζωντανή διάθεση ⇒ `no-live-offer`', () => {
    expect(ownerPropertyInvariantViolations(validDraft({ offers: [] }))).toContain(
      'no-live-offer',
    );
  });

  it('Κ3 — ΑΠΟΣΥΡΜΕΝΗ μόνο διάθεση μετράει ως καμία ζωντανή', () => {
    const draft = validDraft({ offers: [offerOf('sell', 1, 'withdrawn')] });
    expect(ownerPropertyInvariantViolations(draft)).toContain('no-live-offer');
  });

  it('Κ4 — δύο ζωντανές ίδιου είδους ⇒ `duplicate-offer-kind` (Α20 §5)', () => {
    const draft = validDraft({
      offers: [offerOf('sell', 1, 'active', 'offr_a'), offerOf('sell', 2, 'active', 'offr_b')],
    });
    expect(ownerPropertyInvariantViolations(draft)).toContain('duplicate-offer-kind');
  });

  it('Κ5 — πώληση χωρίς τιμή ⇒ `offer-amount-missing` (Α22)', () => {
    const draft = validDraft({ offers: [offerOf('sell', null)] });
    expect(ownerPropertyInvariantViolations(draft)).toContain('offer-amount-missing');
  });

  it('🔴 Κ6 — ΑΝΤΙΠΑΡΟΧΗ χωρίς ποσοστό ⇒ επίσης `offer-amount-missing`', () => {
    // Το κενό που το παλιό λεξιλόγιο **δεν μπορούσε να δει**: το `exchange`
    // προβάλλεται σε `unavailable`, που δεν ζητά καμία τιμή.
    // ⚠️ `type: 'plot'` από τις 2026-08-20 (ADR-777 §8.32): πριν, το draft ήταν
    // `apartment` και παρήγαγε **δεύτερη** παραβίαση (`exchange-requires-land`) που
    // το `toContain` δεν έβλεπε. Ο έλεγχος αφορά το **ποσό** — το είδος οφείλει να
    // είναι έγκυρο, αλλιώς η άγκυρα κρίνει δύο πράγματα και ονομάζει ένα.
    const draft = validDraft({ type: 'plot', offers: [offerOf('exchange', null)] });
    expect(ownerPropertyInvariantViolations(draft)).toContain('offer-amount-missing');
  });

  it('Κ7 — ποσοστό εκτός εύρους ⇒ ΞΕΧΩΡΙΣΤΟΣ κωδικός (άλλη θεραπεία)', () => {
    const draft = validDraft({ type: 'plot', offers: [offerOf('exchange', 250)] });
    const found = ownerPropertyInvariantViolations(draft);
    expect(found).toContain('exchange-percentage-out-of-range');
    expect(found).not.toContain('offer-amount-missing');
    expect(found).not.toContain('exchange-requires-land');
  });

  it('Κ8 — τα τρία βασικά πεδία του §25.6 κρίνονται ονομαστικά', () => {
    expect(ownerPropertyInvariantViolations(validDraft({ type: '' }))).toContain(
      'type-missing',
    );
    expect(ownerPropertyInvariantViolations(validDraft({ areaSqm: null }))).toContain(
      'area-not-positive',
    );
    expect(ownerPropertyInvariantViolations(validDraft({ areaSqm: 0 }))).toContain(
      'area-not-positive',
    );
    expect(ownerPropertyInvariantViolations(validDraft({ title: '   ' }))).toContain(
      'title-missing',
    );
  });

  it('🔑 Κ9 — το `0` είναι ΥΠΑΡΚΤΗ τιμή σε όροφο και υπνοδωμάτια', () => {
    // Ισόγειο + γκαρσονιέρα: **δεν** είναι «κενό».
    expect(ownerPropertyInvariantViolations(validDraft({ floor: 0, bedrooms: 0 }))).toEqual(
      [],
    );
    expect(ownerPropertyInvariantViolations(validDraft({ bedrooms: -1 }))).toContain(
      'bedrooms-negative',
    );
  });

  it('🔑 Κ10 — αρνητικός ΟΡΟΦΟΣ είναι νόμιμος (υπόγειο) — κανένας κωδικός', () => {
    expect(ownerPropertyInvariantViolations(validDraft({ floor: -1 }))).toEqual([]);
  });

  it('🔴 Κ11 — επιστρέφονται ΟΛΕΣ μαζί, ποτέ η πρώτη (Α14 §17.2)', () => {
    const found = ownerPropertyInvariantViolations(
      validDraft({ offers: [], type: '', areaSqm: null, title: '' }),
    );
    expect(found).toEqual(
      expect.arrayContaining([
        'no-live-offer',
        'type-missing',
        'area-not-positive',
        'title-missing',
      ]),
    );
    expect(found.length).toBeGreaterThanOrEqual(4);
  });

  it('Κ12 — κάθε κωδικός του κλειστού συνόλου είναι ΠΑΡΑΓΩΓΙΜΟΣ (κανείς αδρανής φρουρός)', () => {
    // ADR-749 §5: ένας κωδικός που καμία είσοδος δεν παράγει είναι φρουρός χωρίς
    // απόδειξη ζωής. Εδώ κατασκευάζεται ρητά είσοδος για **κάθε** έναν.
    const produced = new Set<string>([
      ...ownerPropertyInvariantViolations(validDraft({ offers: [] })),
      ...ownerPropertyInvariantViolations(
        validDraft({
          offers: [offerOf('sell', 1, 'active', 'a'), offerOf('sell', 2, 'active', 'b')],
        }),
      ),
      ...ownerPropertyInvariantViolations(validDraft({ offers: [offerOf('sell', null)] })),
      ...ownerPropertyInvariantViolations(
        validDraft({ type: 'plot', offers: [offerOf('exchange', 250)] }),
      ),
      // Έγκυρο ποσοστό σε **διαμέρισμα**: παράγει **μόνο** το `exchange-requires-land`.
      // Χωρίς αυτή τη γραμμή ο νέος κωδικός θα περνούσε «κατά τύχη», μαζί με το
      // out-of-range — δηλαδή ο φρουρός θα είχε απόδειξη ζωής που δεν είναι δική του.
      ...ownerPropertyInvariantViolations(validDraft({ offers: [offerOf('exchange', 40)] })),
      // ADR-835 — οι δύο όροι διαμονής, **ΧΩΡΙΣΤΑ ο καθένας**: μια είσοδος με `0` και
      // στα δύο θα άναβε και τους δύο κωδικούς και θα άφηνε αναπόδεικτο ότι ο καθένας
      // κρίνει **το δικό του** πεδίο. Το `nightlyRate` μένει έγκυρο ώστε να μη
      // συμπαρασύρεται το `offer-amount-missing`.
      ...ownerPropertyInvariantViolations(
        validDraft({
          offers: [
            { id: 'offr_stay', kind: 'leaseShort', lifecycle: 'active', nightlyRate: 65, minNights: 0, maxGuests: 4 },
          ],
        }),
      ),
      ...ownerPropertyInvariantViolations(
        validDraft({
          offers: [
            { id: 'offr_stay', kind: 'leaseShort', lifecycle: 'active', nightlyRate: 65, minNights: 2, maxGuests: 0 },
          ],
        }),
      ),
      ...ownerPropertyInvariantViolations(validDraft({ type: '' })),
      ...ownerPropertyInvariantViolations(validDraft({ areaSqm: null })),
      ...ownerPropertyInvariantViolations(validDraft({ title: '' })),
      ...ownerPropertyInvariantViolations(validDraft({ bedrooms: -3 })),
    ]);

    for (const code of OWNER_PROPERTY_INVARIANTS) {
      expect(produced.has(code)).toBe(true);
    }
  });

  // ==========================================================================
  // ADR-777 §8.32 — Η ΑΝΤΙΠΑΡΟΧΗ ΑΦΟΡΑ ΜΟΝΟ ΤΗ ΓΗ
  // ==========================================================================

  it('🔴 Κ14 — αντιπαροχή σε ΔΙΑΜΕΡΙΣΜΑ ⇒ `exchange-requires-land`', () => {
    // Ο κανόνας του τομέα (Giorgio 2026-08-20). Μέχρι σήμερα ήταν **αδύνατο να
    // παραβιαστεί και αδύνατο να τηρηθεί**: η λίστα των ειδών δεν είχε γη, οπότε
    // κάθε αντιπαροχή γραφόταν αναγκαστικά πάνω σε χτισμένη μονάδα.
    const draft = validDraft({ type: 'apartment', offers: [offerOf('exchange', 40)] });
    expect(ownerPropertyInvariantViolations(draft)).toContain('exchange-requires-land');
  });

  it('Κ15 — η ΙΔΙΑ αντιπαροχή σε οικόπεδο ή αγροτεμάχιο ⇒ καμία παραβίαση', () => {
    // Ο παρονομαστής του Κ14: χωρίς αυτό, ένα invariant που κοκκινίζει **πάντα**
    // θα ήταν εξίσου πράσινο στο Κ14 και εξίσου άχρηστο.
    for (const land of ['plot', 'parcel'] as const) {
      const draft = validDraft({ type: land, offers: [offerOf('exchange', 40)] });
      expect(ownerPropertyInvariantViolations(draft)).toEqual([]);
    }
  });

  it('Κ16 — πώληση/ενοικίαση σε διαμέρισμα ΔΕΝ αγγίζονται από τον νέο κανόνα', () => {
    // Ο κανόνας αφορά **μόνο** την ανταλλαγή. Ένας έλεγχος που κοίταζε «είναι γη;»
    // ανεξαρτήτως είδους διάθεσης θα απαγόρευε το 100% των σημερινών αγγελιών.
    for (const kind of ['sell', 'leaseOut'] as const) {
      const draft = validDraft({ type: 'apartment', offers: [offerOf(kind, 150_000)] });
      expect(ownerPropertyInvariantViolations(draft)).toEqual([]);
    }
  });

  it('🔴 Κ17 — ΚΛΕΙΣΜΕΝΗ αντιπαροχή σε διαμέρισμα είναι ΙΣΤΟΡΙΚΟ, όχι παραβίαση', () => {
    // Κρίνονται μόνο οι **ζωντανές** διαθέσεις. Ένα invariant που κοκκινίζει σε
    // ολοκληρωμένη πράξη θα κρατούσε όμηρο ένα ακίνητο για κάτι που ήδη τελείωσε —
    // και θα έκανε αδύνατη κάθε μελλοντική επεξεργασία της αγγελίας.
    const draft = validDraft({
      type: 'apartment',
      offers: [offerOf('exchange', 40, 'closed', 'offr_old'), offerOf('sell', 200_000)],
    });
    expect(ownerPropertyInvariantViolations(draft)).not.toContain('exchange-requires-land');
  });
});

describe('newOwnerProperty — τα γεγονότα του συστήματος, σε ένα σημείο', () => {
  it('Κ13 — γεννιέται `listed`: καμία ουρά έγκρισης (απόφαση Giorgio 2026-08-11)', () => {
    const property = newOwnerProperty(validDraft(), {
      id: 'ownp_x',
      authorUserId: 'user-9',
      authorCompanyId: null,
      // 🔑 **Κενός πίνακας ΕΙΝΑΙ ο ιδιώτης** (ADR-832 §5.4) — η απουσία εντολής δεν
      //    χρειάζεται όνομα, και το παλιό `{ kind: 'self' }` ήταν ακριβώς αυτό.
      mandates: [],
    });
    expect(property.lifecycle).toBe('listed');
    expect(property.id).toBe('ownp_x');
    expect(property.authorUserId).toBe('user-9');
    expect(property.createdAt).toBe(property.updatedAt);
  });
});

describe('βοηθητικά κατηγορήματα', () => {
  it('Κ14 — `isLiveOwnerProperty` ⇔ `listed`', () => {
    expect(isLiveOwnerProperty(validOwnerProperty())).toBe(true);
    expect(isLiveOwnerProperty(validOwnerProperty({ lifecycle: 'withdrawn' }))).toBe(false);
  });

  it('Κ15 — `isOwnerPropertyLifecycle` δέχεται μόνο το κλειστό σύνολο', () => {
    expect(isOwnerPropertyLifecycle('listed')).toBe(true);
    expect(isOwnerPropertyLifecycle('withdrawn')).toBe(true);
    expect(isOwnerPropertyLifecycle('draft')).toBe(false);
    expect(isOwnerPropertyLifecycle(null)).toBe(false);
  });

  it('Κ16 — τα είδη επιστρέφονται ΤΑΞΙΝΟΜΗΜΕΝΑ και χωρίς διπλά', () => {
    const property = validOwnerProperty({
      offers: [
        offerOf('leaseOut', 800, 'active', 'offr_l'),
        offerOf('sell', 1, 'active', 'offr_s'),
        offerOf('exchange', 40, 'withdrawn', 'offr_e'),
      ],
    });
    expect(ownerPropertyOfferKinds(property)).toEqual(['leaseOut', 'sell']);
  });
});
