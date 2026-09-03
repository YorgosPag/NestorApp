/**
 * @fileoverview **ΦΟΡΜΑ ⇄ ΠΡΟΣΦΟΡΑ** — η μία μετάφραση, και το invariant ταυτότητας.
 * @related ADR-777 §7 (Α14 §17.2 · Α20 σημείο 4) · lib/owner-property/owner-property-form-values.ts
 */

import {
  EMPTY_OWNER_PROPERTY_FORM,
  ownerPropertyDraftFrom,
  ownerPropertyFormBlockers,
  ownerPropertyFormFrom,
  ownerPropertyFormSchema,
  type OfferIdentitySource,
  type OwnerPropertyFormParsed,
  type OwnerPropertyFormValues,
} from '../owner-property-form-values';
import { validateOwnerPropertyForm } from '../owner-property-form-validation';
import { offerOf, validOwnerProperty } from './owner-property-fixtures';

/** Ένα φορτίο φόρμας που περνά — η βάση κάθε δοκιμής. */
function formValues(
  overrides: Partial<OwnerPropertyFormValues> = {},
): OwnerPropertyFormValues {
  return {
    ...EMPTY_OWNER_PROPERTY_FORM,
    title: 'Διαμέρισμα 92 τ.μ.',
    type: 'apartment',
    areaSqm: 92,
    floor: 3,
    bedrooms: 2,
    offerKinds: ['sell'],
    askingPrice: 210_000,
    placeAnswer: 'declared',
    placeQuery: 'Εγνατίας 147, Θεσσαλονίκη',
    placePoint: { lat: 40.63, lng: 22.95 },
    placeAccuracy: 'exact',
    ...overrides,
  };
}

function parse(values: OwnerPropertyFormValues): OwnerPropertyFormParsed {
  const parsed = ownerPropertyFormSchema.safeParse(values);
  if (!parsed.success) throw new Error(`fixture δεν αναλύεται: ${parsed.error.message}`);
  return parsed.data;
}

/** Ταυτότητες που **μετρώνται**, ώστε η δοκιμή να βλέπει πόσες γεννήθηκαν. */
function identitySource(previous: OfferIdentitySource['previous'] = []): {
  source: OfferIdentitySource;
  minted: () => number;
} {
  let count = 0;
  return {
    source: {
      previous,
      mintOfferId: () => {
        count += 1;
        return `offr_new_${count}`;
      },
    },
    minted: () => count,
  };
}

// =============================================================================
// Σ — ΤΟ ΣΧΗΜΑ
// =============================================================================

describe('ownerPropertyFormSchema — κρίνει ΣΧΗΜΑ, ποτέ κανόνες', () => {
  it('Σ1 — το κενό αριθμητικό πεδίο γίνεται `null`, ΠΟΤΕ `0`', () => {
    const parsed = parse(formValues({ floor: '', bedrooms: '' } as never));
    expect(parsed.floor).toBeNull();
    expect(parsed.bedrooms).toBeNull();
  });

  it('🔑 Σ2 — το ρητό `0` επιβιώνει (ισόγειο · γκαρσονιέρα)', () => {
    const parsed = parse(formValues({ floor: 0, bedrooms: 0 }));
    expect(parsed.floor).toBe(0);
    expect(parsed.bedrooms).toBe(0);
  });

  it('Σ3 — γράμματα σε αριθμητικό πεδίο δίνουν `null`, όχι `NaN`', () => {
    const parsed = parse(formValues({ areaSqm: 'εκατό' } as never));
    expect(parsed.areaSqm).toBeNull();
  });
});

// =============================================================================
// Μ — Η ΜΕΤΑΦΡΑΣΗ
// =============================================================================

describe('ownerPropertyDraftFrom — επίπεδη φόρμα → διακριτές ενώσεις', () => {
  it('Μ1 — τα τσεκαρισμένα είδη γίνονται διαθέσεις με το ΔΙΚΟ τους ποσό', () => {
    const { source } = identitySource();
    const draft = ownerPropertyDraftFrom(
      parse(formValues({ offerKinds: ['sell', 'leaseOut'], askingPrice: 210_000, rentPrice: 800 })),
      source,
    );

    expect(draft.offers).toHaveLength(2);
    const sell = draft.offers.find((o) => o.kind === 'sell');
    const lease = draft.offers.find((o) => o.kind === 'leaseOut');
    expect(sell?.kind === 'sell' ? sell.askingPrice : null).toBe(210_000);
    expect(lease?.kind === 'leaseOut' ? lease.rentPrice : null).toBe(800);
  });

  it('🔑 Μ2 — τα ΜΗ τσεκαρισμένα ποσά ΔΕΝ ταξιδεύουν (η φόρμα τα κρατά, το έγγραφο όχι)', () => {
    const { source } = identitySource();
    // Ο άνθρωπος έγραψε ενοίκιο, μετά ξετσέκαρε την ενοικίαση.
    const draft = ownerPropertyDraftFrom(
      parse(formValues({ offerKinds: ['sell'], rentPrice: 800 })),
      source,
    );
    expect(draft.offers.map((o) => o.kind)).toEqual(['sell']);
  });

  it('🔴 Μ2β — ΓΗ ⇒ ο όροφος και τα υπνοδωμάτια ΔΕΝ ταξιδεύουν (ADR-777 §8.32)', () => {
    const { source } = identitySource();
    // Ο άνθρωπος γέμισε «3ος όροφος, 2 υπνοδωμάτια» για διαμέρισμα, μετά άλλαξε το
    // είδος σε «Οικόπεδο». Η φόρμα **δεν σβήνει ό,τι κρύβει** (Α14 §17.2), οπότε οι
    // τιμές είναι ακόμη εκεί — και χωρίς αυτόν τον κανόνα θα αποθηκευόταν
    // **οικόπεδο στον 3ο όροφο**, σιωπηλά.
    const draft = ownerPropertyDraftFrom(
      parse(formValues({ type: 'plot', floor: 3, bedrooms: 2, areaSqm: 480 })),
      source,
    );

    expect(draft.floor).toBeNull();
    expect(draft.bedrooms).toBeNull();
    // Ο παρονομαστής: το **εμβαδόν** είναι το μέγεθος της γης και μένει.
    expect(draft.areaSqm).toBe(480);
  });

  it('🔴 Μ2β2 — ΩΜΗ ΠΑΛΑΙΑ ΤΙΜΗ ⇒ ο ΙΔΙΟΣ μηδενισμός (ADR-842 §7.6.11)', () => {
    // 🔑 **Το σκέλος που διαφοροποιεί.** Το Μ2β από πάνω περνά `'plot'` — κανονική
    // τιμή, άρα ήταν **πράσινο και με τον ασθενή κριτή**. Εδώ περνά ό,τι κουβαλά ένα
    // **παλιό έγγραφο Firestore** (`'Οικόπεδο'`), που το ίδιο το `PropertyType`
    // επιτρέπει ρητά *«για συμβατότητα με παλιά έγγραφα»* — και μέχρι το §7.6.11 το
    // `isLandPropertyType` απαντούσε **«όχι γη»**, οπότε ο μηδενισμός **δεν έτρεχε**
    // και γραφόταν κυριολεκτικά «οικόπεδο στον 3ο όροφο».
    //
    // ⚠️ Η διαδρομή είναι **πραγματική, όχι κατασκευασμένη**: το `ownerPropertyFormFrom`
    // γράφει `type: property.type` **αυτούσιο** και το πεδίο της φόρμας είναι
    // `z.string()` — δηλαδή μια παλιά αγγελία που ανοίγει για επεξεργασία φτάνει εδώ
    // με ακριβώς αυτή την τιμή.
    const { source } = identitySource();
    const draft = ownerPropertyDraftFrom(
      parse(formValues({ type: 'Οικόπεδο', floor: 3, bedrooms: 2, areaSqm: 480 })),
      source,
    );

    expect(draft.floor).toBeNull();
    expect(draft.bedrooms).toBeNull();
    expect(draft.areaSqm).toBe(480);
  });

  it('Μ2γ — σε ΧΤΙΣΜΕΝΗ μονάδα τα ίδια πεδία περνούν άθικτα', () => {
    // Χωρίς αυτό, ένας μηδενισμός «για όλους» θα ήταν εξίσου πράσινος στο Μ2β και θα
    // είχε σβήσει τον όροφο κάθε διαμερίσματος της εφαρμογής.
    const { source } = identitySource();
    const draft = ownerPropertyDraftFrom(
      parse(formValues({ type: 'apartment', floor: 3, bedrooms: 2 })),
      source,
    );
    expect(draft.floor).toBe(3);
    expect(draft.bedrooms).toBe(2);
  });

  it('Μ3 — οι διαθέσεις είναι ΤΑΞΙΝΟΜΗΜΕΝΕΣ (ίδιο έγγραφο ανεξάρτητα από σειρά κλικ)', () => {
    const { source } = identitySource();
    const a = ownerPropertyDraftFrom(
      parse(formValues({ offerKinds: ['sell', 'exchange', 'leaseOut'], rentPrice: 1, exchangePercentage: 40 })),
      source,
    );
    const b = ownerPropertyDraftFrom(
      parse(formValues({ offerKinds: ['leaseOut', 'sell', 'exchange'], rentPrice: 1, exchangePercentage: 40 })),
      identitySource().source,
    );
    expect(a.offers.map((o) => o.kind)).toEqual(b.offers.map((o) => o.kind));
  });

  it('Μ4 — «θα δηλώσω θέση» ΧΩΡΙΣ λυμένο σημείο πέφτει σε `declined` (ολική συνάρτηση)', () => {
    const { source } = identitySource();
    const draft = ownerPropertyDraftFrom(
      parse(formValues({ placeAnswer: 'declared', placePoint: null })),
      source,
    );
    expect(draft.place.kind).toBe('declined');
  });

  it('🔑 Μ5 — το ΚΕΙΜΕΝΟ αποθηκεύεται ως `label` (σε αντίθεση με τη ζήτηση)', () => {
    const { source } = identitySource();
    const draft = ownerPropertyDraftFrom(parse(formValues()), source);
    expect(draft.place.kind === 'declared' ? draft.place.label : null).toBe(
      'Εγνατίας 147, Θεσσαλονίκη',
    );
  });

  it('Μ6 — η ΑΚΡΙΒΕΙΑ ταξιδεύει μαζί με το σημείο (ολόκληρη η Α5)', () => {
    const { source } = identitySource();
    const draft = ownerPropertyDraftFrom(parse(formValues()), source);
    expect(draft.place.kind === 'declared' ? draft.place.accuracy : 'x').toBe('exact');
  });
});

// =============================================================================
// Τ — Η ΤΑΥΤΟΤΗΤΑ ΤΩΝ ΔΙΑΘΕΣΕΩΝ (Α20 σημείο 4)
// =============================================================================

describe('🔴 Τ — η ταυτότητα διάθεσης ΕΠΙΒΙΩΝΕΙ της επεξεργασίας', () => {
  it('Τ1 — υπάρχον είδος ΚΡΑΤΑΕΙ το `offr_*` του· καμία νέα ταυτότητα δεν γεννιέται', () => {
    const previous = [offerOf('sell', 200_000, 'active', 'offr_ORIGINAL')];
    const { source, minted } = identitySource(previous);

    const draft = ownerPropertyDraftFrom(
      parse(formValues({ offerKinds: ['sell'], askingPrice: 230_000 })),
      source,
    );

    expect(draft.offers[0].id).toBe('offr_ORIGINAL');
    expect(minted()).toBe(0);
  });

  it('Τ2 — ΝΕΟ είδος παίρνει νέα ταυτότητα, το υπάρχον κρατά τη δική του', () => {
    const previous = [offerOf('sell', 200_000, 'active', 'offr_ORIGINAL')];
    const { source, minted } = identitySource(previous);

    const draft = ownerPropertyDraftFrom(
      parse(formValues({ offerKinds: ['sell', 'leaseOut'], rentPrice: 800 })),
      source,
    );

    expect(draft.offers.find((o) => o.kind === 'sell')?.id).toBe('offr_ORIGINAL');
    expect(draft.offers.find((o) => o.kind === 'leaseOut')?.id).toBe('offr_new_1');
    expect(minted()).toBe(1);
  });
});

// =============================================================================
// Ε — ΕΠΕΞΕΡΓΑΣΙΑ: ΠΡΟΣΦΟΡΑ → ΦΟΡΜΑ
// =============================================================================

describe('ownerPropertyFormFrom — ολική, χωρίς ένωση αποτελέσματος', () => {
  it('Ε1 — κύκλος: αγγελία → φόρμα → προσχέδιο δίνει τα ΙΔΙΑ πεδία', () => {
    const property = validOwnerProperty();
    const { source } = identitySource(property.offers);

    const back = ownerPropertyDraftFrom(parse(ownerPropertyFormFrom(property)), source);

    expect(back.title).toBe(property.title);
    expect(back.type).toBe(property.type);
    expect(back.areaSqm).toBe(property.areaSqm);
    expect(back.floor).toBe(property.floor);
    expect(back.bedrooms).toBe(property.bedrooms);
    expect(back.place).toEqual(property.place);
    expect(back.media).toEqual(property.media);
    expect(back.offers).toEqual(property.offers);
  });

  it('🔑 Ε2 — ΔΥΟ διαθέσεις διαβάζονται ΑΜΦΟΤΕΡΕΣ (όχι «η πρώτη»)', () => {
    const property = validOwnerProperty({
      offers: [
        offerOf('sell', 210_000, 'active', 'offr_s'),
        offerOf('leaseOut', 800, 'active', 'offr_l'),
      ],
    });

    const values = ownerPropertyFormFrom(property);
    expect(values.askingPrice).toBe(210_000);
    expect(values.rentPrice).toBe(800);
  });

  it('Ε3 — αγγελία ΧΩΡΙΣ θέση ανοίγει με `declined` και κενό κείμενο', () => {
    const values = ownerPropertyFormFrom(
      validOwnerProperty({ place: { kind: 'declined' } }),
    );
    expect(values.placeAnswer).toBe('declined');
    expect(values.placeQuery).toBe('');
    expect(values.placePoint).toBeNull();
  });
});

// =============================================================================
// Β — ΤΑ ΕΜΠΟΔΙΑ ΤΗΣ ΦΟΡΜΑΣ
// =============================================================================

describe('ownerPropertyFormBlockers — «δεν είναι ακόμη», όχι «είναι άκυρο»', () => {
  it('Β1 — δήλωσε θέση χωρίς εντοπισμό ⇒ `place-unresolved`', () => {
    expect(
      ownerPropertyFormBlockers(parse(formValues({ placePoint: null }))),
    ).toEqual(['place-unresolved']);
  });

  it('Β2 — «δεν θέλω να το πω» ΔΕΝ είναι εμπόδιο (Α5: έγκυρη απάντηση)', () => {
    expect(
      ownerPropertyFormBlockers(
        parse(formValues({ placeAnswer: 'declined', placePoint: null })),
      ),
    ).toEqual([]);
  });
});

// =============================================================================
// Β2 — Η ΜΙΑ ΑΡΧΗ ΕΓΚΥΡΟΤΗΤΑΣ
// =============================================================================

describe('validateOwnerPropertyForm — τρεις κριτές, σειρά-συμβόλαιο', () => {
  it('Β3 — πλήρης φόρμα ⇒ `ready` με προσχέδιο', () => {
    const result = validateOwnerPropertyForm(formValues(), identitySource().source);
    expect(result.kind).toBe('ready');
  });

  it('Β4 — εμπόδιο ΚΑΙ παραβίαση αναφέρονται ΜΑΖΙ (Α14 §17.2)', () => {
    const result = validateOwnerPropertyForm(
      formValues({ placePoint: null, offerKinds: [] }),
      identitySource().source,
    );

    expect(result.kind).toBe('incomplete');
    if (result.kind !== 'incomplete') return;
    expect(result.blockers).toContain('place-unresolved');
    expect(result.violations).toContain('no-live-offer');
  });

  it('🔑 Β5 — δυσανάγνωστο σχήμα ΚΟΒΕΙ πριν τους κανόνες (σειρά-συμβόλαιο)', () => {
    // Ένα `placeAnswer` εκτός κλειστού συνόλου: το σχήμα δεν διαβάζεται, οπότε οι
    // κανόνες θα έκριναν **τιμές που δεν υπάρχουν**.
    const result = validateOwnerPropertyForm(
      formValues({ placeAnswer: 'maybe' as never }),
      identitySource().source,
    );

    expect(result.kind).toBe('incomplete');
    if (result.kind !== 'incomplete') return;
    expect(result.malformed).toContain('placeAnswer');
    expect(result.blockers).toEqual([]);
    expect(result.violations).toEqual([]);
  });
});
