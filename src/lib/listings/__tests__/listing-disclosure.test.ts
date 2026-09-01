/**
 * Άγκυρες για την **αποκάλυψη της οθόνης 3** (ADR-777 Α3 · Α7 · Α17).
 *
 * 🔑 Η σημαντικότερη ομάδα **δεν** είναι η λογιστική — είναι η **Κ7**: ότι κάθε κλειδί
 * που ζητά η οθόνη 3 **υπάρχει και στις δύο γλώσσες**. Είναι η μόνη ομάδα που πιάνει
 * την οικογένεια σφάλματος που αυτό το repo έχει πληρώσει τέσσερις φορές (CHECK 3.34 ·
 * 3.36 · 3.51): **ωμό κλειδί στην οθόνη, με όλες τις πύλες πράσινες**.
 *
 * ⚠️ Τα **στατικά** κλειδιά της Κ7 είναι γραμμένα **στο χέρι, επίτηδες** (ίδια σύμβαση
 * με τα «Π» των πυλών, ADR-587 §6.1): αν τα παρήγαγε το ίδιο αρχείο που κρίνει, η
 * άγκυρα θα επιβεβαίωνε τον εαυτό της. Ένα κλειδί που σβήνεται από τον κώδικα **και**
 * από το locale πρέπει να αφήνει **αυτή** τη λίστα να φωνάξει.
 */

import fs from 'fs';
import path from 'path';

import {
  LISTING_DISCLOSURE,
  LISTING_ATTRIBUTE_KEYS,
  LISTING_OPEN_SUBJECTS,
  isAttributeDeclared,
  listingAttributeLedger,
  attributeLedgerBalances,
  type ListingAttributeKey,
} from '../listing-disclosure';
import { MISSING_PRICE_KEY, PRICE_ROLE_KEY } from '../listing-price-keys';
import { SHAPE_LABEL_KEY, SHAPE_MEANING_KEY, shapeMeaningKey } from '../listing-shape-keys';
import { listingDetailHref, searchResultsHref, SEARCH_RESULTS_ROUTE } from '../listing-routes';
import { LOCATION_PROVENANCES } from '@/lib/location/location-provenance';
import { OFFER_KINDS } from '@/types/property-offers';
import { PROPERTY_TYPES, PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';
import type { PublicListing } from '@/types/public-listing';

const AT = '2026-08-10T10:00:00.000Z';

/**
 * **Πραγματικό σχήμα προβολής**, όχι μερικό — και αυτό είναι το νόημα της Κ1: το
 * `Object.keys` αυτού του αντικειμένου είναι ο **παρονομαστής** έναντι του οποίου
 * κρίνεται ο πίνακας αποκάλυψης.
 */
function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'prop_a0000001',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 200000, finalPrice: null, rentPrice: null, nightlyRate: null },
    stay: null,
    coverImage: null,
    gallery: [],
    type: 'apartment',
    areaSqm: 95,
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    // 🔴 **ΤΑ ΤΡΙΑ ΠΟΥ ΕΛΕΙΠΑΝ ΚΑΙ ΕΔΩ** (2026-08-31): το σχόλιο από πάνω λέει
    //    «**πραγματικό** σχήμα προβολής, όχι μερικό» — και ήταν μερικό. Ο πίνακας
    //    αποκάλυψης έλειπε τα ΙΔΙΑ τρία, οπότε η Κ1 συνέκρινε δύο ελλιπείς λίστες
    //    και έβγαινε πράσινη. Ο **παρονομαστής** πρέπει να είναι πλήρης, αλλιώς δεν
    //    είναι παρονομαστής.
    place: null,
    authorship: 'agency',
    agencyName: null,
    // ✅ **ADR-841 §7 (Α1)** — και η Κ1 κοκκίνισε ξανά, όπως οφείλει: ο παρονομαστής
    //    οφείλει να είναι **πλήρης**, αλλιώς δεν είναι παρονομαστής (μάθημα 31/08).
    agencyId: null,
    floor: 1,
    bedrooms: 3,
    title: 'Δοκιμή',
    // Α17 (ADR-838): κενός πίνακας = «κανείς δεν ρώτησε». Οι άγκυρες που κρίνουν
    // ΠΕΡΙΕΧΟΜΕΝΟ νομιμότητας ζουν στο `legality-signal.test.ts` — εδώ κρίνεται ΣΧΗΜΑ.
    legality: [],
    projectedAt: AT,
    ...over,
  };
}

function readLocale(language: 'el' | 'en', namespace = 'search-results'): Record<string, unknown> {
  const file = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'i18n',
    'locales',
    language,
    `${namespace}.json`
  );
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

/** Επίλυση κλειδιού με τελείες. Δέχεται **και** το πρόθεμα namespace. */
function lookup(bundle: Record<string, unknown>, key: string): unknown {
  const withoutNamespace = key.startsWith('search-results:') ? key.slice('search-results:'.length) : key;
  let node: unknown = bundle;
  for (const part of withoutNamespace.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

// ============================================================================
// Κ1 — Ο ΠΙΝΑΚΑΣ ΑΠΟΚΑΛΥΨΗΣ ΚΑΛΥΠΤΕΙ ΑΚΡΙΒΩΣ ΤΑ ΠΕΔΙΑ ΠΟΥ ΔΗΜΟΣΙΕΥΟΝΤΑΙ
// ============================================================================

describe('Κ1 — κάθε δημοσιευμένο πεδίο έχει απόφαση εμφάνισης', () => {
  it('ο πίνακας έχει ακριβώς τα κλειδιά μιας πραγματικής αγγελίας', () => {
    // Ο μεταγλωττιστής εγγυάται τη μία κατεύθυνση (`satisfies Record<keyof …>`).
    // Εδώ κρίνεται η ΑΛΛΗ: ότι το σχήμα που πράγματι ταξιδεύει δεν έχει πεδίο που
    // ο πίνακας δεν ξέρει — δηλαδή ότι ο τύπος δεν έχει αποκλίνει από τα δεδομένα.
    expect(Object.keys(LISTING_DISCLOSURE).sort()).toEqual(Object.keys(listing()).sort());
  });

  it('καμία τιμή δεν λείπει', () => {
    for (const [key, treatment] of Object.entries(LISTING_DISCLOSURE)) {
      expect(typeof treatment).toBe('string');
      expect(treatment.length).toBeGreaterThan(0);
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('το `commercialStatus` ΔΕΝ έχει δικό του ρόλο εμφάνισης — τροφοδοτεί την τιμή', () => {
    // Α20: είναι **ρητά lossy**. Τυπωμένο αυτούσιο θα έλεγε «μη διαθέσιμο» για ένα
    // ακίνητο που διατίθεται προς αντιπαροχή.
    expect(LISTING_DISCLOSURE.commercialStatus).toBe('price');
  });
});

// ============================================================================
// Κ2 — Ο ΚΑΤΑΛΟΓΟΣ ΙΔΙΟΤΗΤΩΝ ΠΑΡΑΓΕΤΑΙ, ΜΕ ΤΗ ΣΕΙΡΑ ΤΟΥ ΠΙΝΑΚΑ
// ============================================================================

describe('Κ2 — οι ιδιότητες παράγονται από τον πίνακα', () => {
  it('περιέχει ακριβώς όσα κλειδιά έχουν ρόλο `attribute`', () => {
    const expected = Object.entries(LISTING_DISCLOSURE)
      .filter(([, treatment]) => treatment === 'attribute')
      .map(([key]) => key);
    expect([...LISTING_ATTRIBUTE_KEYS]).toEqual(expected);
  });

  it('η σειρά είναι η σειρά δήλωσης — είδος πρώτο (5ο βασικό πεδίο του §25.6)', () => {
    expect(LISTING_ATTRIBUTE_KEYS[0]).toBe<ListingAttributeKey>('type');
  });
});

// ============================================================================
// Κ3 — ΤΟ `0` ΕΙΝΑΙ ΤΙΜΗ, ΟΧΙ ΑΠΟΥΣΙΑ
// ============================================================================

describe('Κ3 — ισόγειο και studio δεν εξαφανίζονται', () => {
  it('`floor: 0` είναι δηλωμένο (ισόγειο)', () => {
    expect(isAttributeDeclared(listing({ floor: 0 }), 'floor')).toBe(true);
  });

  it('`bedrooms: 0` είναι δηλωμένο (studio)', () => {
    expect(isAttributeDeclared(listing({ bedrooms: 0 }), 'bedrooms')).toBe(true);
  });

  it('`null` είναι απουσία — και στα δύο', () => {
    expect(isAttributeDeclared(listing({ floor: null }), 'floor')).toBe(false);
    expect(isAttributeDeclared(listing({ bedrooms: null }), 'bedrooms')).toBe(false);
    expect(isAttributeDeclared(listing({ areaSqm: null }), 'areaSqm')).toBe(false);
  });
});

// ============================================================================
// Κ4 — «ΔΗΛΩΜΕΝΟ» ΣΗΜΑΙΝΕΙ ΟΝΟΜΑΣΙΜΟ
// ============================================================================

describe('Κ4 — τύπος που δεν έχει ετικέτα δεν μετριέται ως δηλωμένος', () => {
  it('κανονικός τύπος ⇒ δηλωμένος', () => {
    expect(isAttributeDeclared(listing({ type: 'apartment' }), 'type')).toBe(true);
  });

  it('παλαιά ελληνική τιμή Firestore ⇒ δηλωμένη (ο resolver την αναγνωρίζει)', () => {
    expect(isAttributeDeclared(listing({ type: 'Στούντιο' }), 'type')).toBe(true);
  });

  it('άγνωστη τιμή ⇒ ΜΗ δηλωμένη — αλλιώς η λογιστική θα έλεγε 4/4 με 3 γραμμές', () => {
    expect(
      isAttributeDeclared(listing({ type: 'κάτι που δεν υπάρχει' as PublicListing['type'] }), 'type')
    ).toBe(false);
  });
});

// ============================================================================
// Κ5 — Η ΛΟΓΙΣΤΙΚΗ ΚΛΕΙΝΕΙ ΠΑΝΤΑ
// ============================================================================

describe('Κ5 — κλειστή λογιστική ιδιοτήτων', () => {
  it('πλήρης αγγελία: όλα δηλωμένα, το άθροισμα κλείνει', () => {
    const ledger = listingAttributeLedger(listing());
    expect(ledger.declared).toBe(LISTING_ATTRIBUTE_KEYS.length);
    expect(ledger.undeclared).toBe(0);
    expect(attributeLedgerBalances(ledger)).toBe(true);
  });

  it('άδεια αγγελία: μόνο το είδος, το άθροισμα κλείνει', () => {
    const ledger = listingAttributeLedger(
      listing({ areaSqm: null, floor: null, bedrooms: null })
    );
    expect(ledger.declared).toBe(1);
    expect(ledger.undeclared).toBe(LISTING_ATTRIBUTE_KEYS.length - 1);
    expect(attributeLedgerBalances(ledger)).toBe(true);
  });

  it('το `total` ΕΙΝΑΙ ο κατάλογος — όχι σταθερός αριθμός γραμμένος δίπλα', () => {
    expect(listingAttributeLedger(listing()).total).toBe(LISTING_ATTRIBUTE_KEYS.length);
  });
});

// ============================================================================
// Κ6 — ΤΑ ΑΝΟΙΧΤΑ ΘΕΜΑΤΑ ΕΙΝΑΙ ΚΛΕΙΣΤΟ, ΜΗ ΚΕΝΟ ΣΥΝΟΛΟ
// ============================================================================

describe('Κ6 — τα δηλωμένα κενά', () => {
  it('η νομιμότητα (Α17) ΕΦΥΓΕ — λύθηκε, δεν ξεχάστηκε', () => {
    // 🔴 Η ΠΡΟΗΓΟΥΜΕΝΗ ΜΟΡΦΗ ΑΥΤΗΣ ΤΗΣ ΑΓΚΥΡΑΣ ΕΛΕΓΕ *«η νομιμότητα είναι ΜΕΣΑ, και
    //    πρώτη»*, με σχόλιο *«αν κάποτε υλοποιηθεί η Α17, αυτή η άγκυρα είναι το σημείο
    //    που θα το θυμίσει: η γραμμή φεύγει από εδώ ΚΑΙ από την οθόνη, μαζί»*.
    //    Έγινε ακριβώς αυτό (ADR-838) — και η άγκυρα **αντιστρέφεται** αντί να
    //    διαγραφεί, ώστε επαναφορά του `'legality'` εδώ να **κοκκινίσει**: θα σήμαινε
    //    ότι η σελίδα ξαναδηλώνει κενό που έχει ήδη κλείσει.
    expect(LISTING_OPEN_SUBJECTS).not.toContain('legality');
  });

  it('ο κατάλογος ΔΕΝ άδειασε — δύο θέματα μένουν ανοιχτά, με όνομα', () => {
    expect([...LISTING_OPEN_SUBJECTS]).toEqual(['floorplan', 'dossier']);
  });

  it('χωρίς διπλότυπα', () => {
    expect(new Set(LISTING_OPEN_SUBJECTS).size).toBe(LISTING_OPEN_SUBJECTS.length);
  });
});

// ============================================================================
// Κ7 — ΚΑΘΕ ΚΛΕΙΔΙ ΤΗΣ ΟΘΟΝΗΣ 3 ΥΠΑΡΧΕΙ ΣΕ **ΚΑΙ ΤΙΣ ΔΥΟ** ΓΛΩΣΣΕΣ
// ============================================================================

/**
 * Τα **στατικά** κλειδιά — χειρόγραφα επίτηδες (δεύτερη φωνή, ADR-587 §6.1).
 * Τα **παραγόμενα** έρχονται από τους ίδιους πίνακες που διαβάζει η οθόνη.
 */
const STATIC_DETAIL_KEYS: readonly string[] = [
  'detail.back',
  'detail.loading',
  'detail.absent.title',
  'detail.absent.body',
  'detail.error.title',
  'detail.error.body',
  'detail.price.heading',
  'detail.media.absent',
  'detail.attributes.heading',
  'detail.attributes.ledger',
  'detail.attributes.undeclared',
  'detail.offers.heading',
  'detail.position.heading',
  'detail.position.precision',
  'detail.position.source',
  'detail.position.unknown',
  'detail.open.heading',
  'detail.open.intro',
  'detail.provenance.projectedAt',
];

function allRequiredKeys(): readonly string[] {
  return [
    ...STATIC_DETAIL_KEYS,
    ...Object.values(MISSING_PRICE_KEY),
    ...Object.values(PRICE_ROLE_KEY),
    ...Object.values(SHAPE_LABEL_KEY),
    ...Object.values(SHAPE_MEANING_KEY),
    ...LISTING_ATTRIBUTE_KEYS.map((key) => `detail.attributes.label.${key}`),
    ...LISTING_OPEN_SUBJECTS.map((subject) => `detail.open.${subject}`),
    ...LOCATION_PROVENANCES.map((p) => `detail.position.provenance.${p}`),
    ...OFFER_KINDS.map((kind) => `card.offer.${kind}`),
    'unmapped.reason.neverAsked',
    'unmapped.reason.ownerDeclined',
  ];
}

describe.each(['el', 'en'] as const)('Κ7 — κανένα ωμό κλειδί στην οθόνη 3 [%s]', (language) => {
  const bundle = readLocale(language);

  it.each(allRequiredKeys())('%s υπάρχει και είναι μη κενό κείμενο', (key) => {
    const value = lookup(bundle, key);
    expect(typeof value).toBe('string');
    expect((value as string).trim().length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Κ7β — ΤΟ ΕΙΔΟΣ ΖΕΙ ΣΕ **ΑΛΛΟ** NAMESPACE, ΚΑΙ ΓΙ' ΑΥΤΟ ΡΩΤΙΕΤΑΙ ΞΕΧΩΡΙΣΤΑ
// ============================================================================

/**
 * 🔴 Η οθόνη 3 είναι ο **πρώτος** δημόσιος καταναλωτής του `properties-enums`. Η Κ7
 * κοιτάζει **μόνο** το `search-results` — αν σταματούσε εκεί, η ετικέτα του είδους
 * θα μπορούσε να λείπει και η απόδειξη θα ήταν **πράσινη**: το ακριβές σχήμα
 * «κοίταξα κάπου αλλού και είπα ότι είναι καθαρό».
 */
describe.each(['el', 'en'] as const)('Κ7β — ετικέτα είδους ακινήτου [%s]', (language) => {
  const bundle = readLocale(language, 'properties-enums');

  it.each([...PROPERTY_TYPES])('%s έχει ετικέτα', (type) => {
    const value = lookup(bundle, PROPERTY_TYPE_I18N_KEYS[type]);
    expect(typeof value).toBe('string');
    expect((value as string).trim().length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Κ8 — ΟΙ ΔΙΕΥΘΥΝΣΕΙΣ: ΤΑ ΦΙΛΤΡΑ ΤΑΞΙΔΕΥΟΥΝ, ΤΟ ΚΕΝΟ `?` ΟΧΙ
// ============================================================================

describe('Κ8 — οι διαδρομές των τριών οθονών', () => {
  it('χωρίς φίλτρα δεν γράφεται κενό ερώτημα', () => {
    expect(listingDetailHref('prop_a0000001')).toBe('/listing/prop_a0000001');
    expect(listingDetailHref('prop_a0000001', '')).toBe('/listing/prop_a0000001');
    expect(searchResultsHref('')).toBe(SEARCH_RESULTS_ROUTE);
  });

  it('με φίλτρα, ταξιδεύουν αυτούσια', () => {
    expect(listingDetailHref('x', 'offer=sell&r=10')).toBe('/listing/x?offer=sell&r=10');
    expect(searchResultsHref('offer=sell')).toBe('/search/results?offer=sell');
  });

  it('η ταυτότητα κωδικοποιείται — ένα `#` δεν σπάει τη διεύθυνση σιωπηλά', () => {
    expect(listingDetailHref('a#b')).toBe('/listing/a%23b');
  });
});

// ============================================================================
// Κ9 — ΤΟ `none` ΔΕΝ ΕΧΕΙ ΕΞΗΓΗΣΗ ΣΧΗΜΑΤΟΣ (έχει ΑΙΤΙΑ, που είναι άλλο ερώτημα)
// ============================================================================

describe('Κ9 — χωρίς σχήμα, καμία εξήγηση σχήματος', () => {
  it('`none` ⇒ null', () => {
    expect(shapeMeaningKey('none')).toBeNull();
  });

  it('κάθε άλλο σχήμα ⇒ κλειδί', () => {
    for (const shape of Object.keys(SHAPE_MEANING_KEY) as Array<keyof typeof SHAPE_MEANING_KEY>) {
      expect(shapeMeaningKey(shape)).toBe(SHAPE_MEANING_KEY[shape]);
    }
  });

  it('η ετικέτα υπάρχει για ΟΛΑ τα σχήματα, και για το `none`', () => {
    expect(SHAPE_LABEL_KEY.none).toBe('search-results:map.shape.none');
  });
});
