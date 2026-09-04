/**
 * 🔴 **ΟΙ ΔΥΟ ΑΡΙΘΜΟΙ ΑΝΑ ΕΠΙΛΟΓΗ** — άγκυρα τομέα (ADR-777 §8.51).
 *
 * ⚠️ **ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ**: ότι το πλήθος απαντά *«αν πατήσω ΑΥΤΟ, πόσα θα δω;»* —
 * δηλαδή ότι ο **ίδιος** ο άξονας αφαιρείται ενώ οι **υπόλοιποι** μένουν — και ότι η
 * σιωπή μετριέται **χωριστά** από το μηδέν. Μια υλοποίηση που τα ισοπέδωνε θα περνούσε
 * κάθε έλεγχο τύπων και θα έλεγε **ψέματα στην οθόνη**.
 */

import { UNASKED_LISTING_ATTRIBUTES, type PublicListing } from '@/types/public-listing';

import { criterionOptionTallies } from '../criterion-option-counts';
import { EMPTY_LISTING_CRITERIA, withValues, withRange } from '../listing-criteria';
import { CRITERION_VALUES } from '../listing-criterion-values';

const AT = '2026-09-04T10:00:00.000Z';

function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'l1',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 200000, finalPrice: null, rentPrice: null, nightlyRate: null },
    stay: null,
    coverImage: null,
    gallery: [],
    type: 'apartment',
    areaSqm: 95,
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    floor: 1,
    bedrooms: 3,
    title: 'Δοκιμή',
    ...UNASKED_LISTING_ATTRIBUTES,
    place: null,
    authorship: 'agency',
    agencyName: null,
    agencyId: null,
    legality: [],
    projectedAt: AT,
    ...over,
  };
}

/** Το πλήθος μιας συγκεκριμένης επιλογής, για να διαβάζονται οι δοκιμές. */
function tally(
  listings: readonly PublicListing[],
  criteria: Parameters<typeof criterionOptionTallies>[1],
  key: Parameters<typeof criterionOptionTallies>[2],
  value: string
) {
  const found = criterionOptionTallies(listings, criteria, key).find((t) => t.value === value);
  if (found === undefined) throw new Error(`Η επιλογή «${value}» λείπει από τον άξονα «${key}»`);
  return found.count;
}

// =============================================================================
// Α — ΚΑΘΕ ΕΠΙΛΟΓΗ ΤΟΥ ΛΕΞΙΛΟΓΙΟΥ ΕΧΕΙ ΓΡΑΜΜΗ, ΚΑΙ ΣΤΗ ΣΕΙΡΑ ΤΟΥ
// =============================================================================

describe('Α — ο κατάλογος επιλογών', () => {
  it('🔴 ΚΑΜΙΑ επιλογή δεν εξαφανίζεται στο μηδέν — αυτή είναι όλη η διαφορά', () => {
    // Η καταγεγραμμένη σύμβαση των μηχανών είναι «πέτα τους άδειους κάδους». Εδώ
    // **μένουν**, γιατί ο άδειος κάδος είναι ακριβώς η πληροφορία που λείπει αλλού.
    const tallies = criterionOptionTallies([], EMPTY_LISTING_CRITERIA, 'heatingType');
    expect(tallies.map((t) => t.value)).toEqual([...CRITERION_VALUES.heatingType]);
    expect(tallies.every((t) => t.count.matching === 0)).toBe(true);
  });

  it('η σειρά είναι η σειρά του ΛΕΞΙΛΟΓΙΟΥ, όχι της συχνότητας', () => {
    // Μια ταξινόμηση κατά πλήθος θα έκανε τα τετραγωνίδια να **χοροπηδούν** σε κάθε
    // κλικ — ο άνθρωπος θα πατούσε εκεί που ήταν, όχι εκεί που είναι.
    const listings = [listing({ id: 'a', heatingType: CRITERION_VALUES.heatingType[2] })];
    const tallies = criterionOptionTallies(listings, EMPTY_LISTING_CRITERIA, 'heatingType');
    expect(tallies.map((t) => t.value)).toEqual([...CRITERION_VALUES.heatingType]);
  });
});

// =============================================================================
// Β — 🔴 Ο ΙΔΙΟΣ Ο ΑΞΟΝΑΣ ΑΦΑΙΡΕΙΤΑΙ, ΟΙ ΥΠΟΛΟΙΠΟΙ ΜΕΝΟΥΝ
// =============================================================================

describe('Β — διαζευκτικές όψεις: ο άξονας φεύγει, τα υπόλοιπα φίλτρα μένουν', () => {
  const [first, second] = CRITERION_VALUES.heatingType;

  const catalogue = [
    listing({ id: 'a', heatingType: first, areaSqm: 50 }),
    listing({ id: 'b', heatingType: second, areaSqm: 50 }),
    listing({ id: 'c', heatingType: second, areaSqm: 500 }),
  ];

  it('🔴 ΜΙΑ ΗΔΗ ΕΠΙΛΕΓΜΕΝΗ ΤΙΜΗ ΔΕΝ ΜΗΔΕΝΙΖΕΙ ΤΙΣ ΥΠΟΛΟΙΠΕΣ', () => {
    // Χωρίς την αφαίρεση, ο άνθρωπος που διάλεξε το `first` θα διάβαζε «`second` (0)»
    // και θα συμπέραινε ότι δεν υπάρχει — ενώ απλώς δεν το έχει ζητήσει.
    const criteria = withValues(EMPTY_LISTING_CRITERIA, 'heatingType', [first]);
    expect(tally(catalogue, criteria, 'heatingType', second).matching).toBe(2);
    expect(tally(catalogue, criteria, 'heatingType', first).matching).toBe(1);
  });

  it('⚠️ ΤΑ ΑΛΛΑ ΦΙΛΤΡΑ ΟΜΩΣ ΜΕΤΡΑΝΕ — αλλιώς το πλήθος υπόσχεται ό,τι δεν παραδίδει', () => {
    // Με εμβαδόν ≤ 100, το «c» (500 τ.μ.) βγαίνει από τη συζήτηση.
    const criteria = withRange(EMPTY_LISTING_CRITERIA, 'areaSqm', { min: null, max: 100 });
    expect(tally(catalogue, criteria, 'heatingType', second).matching).toBe(1);
  });
});

// =============================================================================
// Γ — 🔴 Ο ΔΕΥΤΕΡΟΣ ΑΡΙΘΜΟΣ: Η ΣΙΩΠΗ
// =============================================================================

describe('Γ — «0 · 8 χωρίς δήλωση» — ο αριθμός που κανείς δεν δίνει', () => {
  it('🔴 ΤΟ ΜΗΔΕΝ ΚΑΙ Η ΣΙΩΠΗ ΕΙΝΑΙ ΔΥΟ ΑΡΙΘΜΟΙ, ΟΧΙ ΕΝΑΣ', () => {
    // Οκτώ αγγελίες που **καμία** δεν δήλωσε θέρμανση. Ένας μονός αριθμός θα έλεγε
    // «0» — δηλαδή «δεν υπάρχει τέτοιο σπίτι», που είναι **ψευδές**.
    const silent = Array.from({ length: 8 }, (_, i) => listing({ id: `s${i}` }));
    const count = tally(silent, EMPTY_LISTING_CRITERIA, 'heatingType', CRITERION_VALUES.heatingType[0]);
    expect(count.matching).toBe(0);
    expect(count.undeclared).toBe(8);
  });

  it('η σιωπή είναι ιδιότητα του ΑΞΟΝΑ — ίδιος αριθμός σε κάθε επιλογή του', () => {
    const mixed = [
      listing({ id: 'a', heatingType: CRITERION_VALUES.heatingType[0] }),
      listing({ id: 'b' }),
      listing({ id: 'c' }),
    ];
    const tallies = criterionOptionTallies(mixed, EMPTY_LISTING_CRITERIA, 'heatingType');
    expect(new Set(tallies.map((t) => t.count.undeclared))).toEqual(new Set([2]));
  });

  it('🔴 Η ΓΗ ΔΕΝ ΜΕΤΡΙΕΤΑΙ ΩΣ ΣΙΩΠΗ — δεν είναι στη συζήτηση', () => {
    // Ένα οικόπεδο **δεν έχει** θέρμανση. Μετρημένο ως «δεν το δήλωσε», η οθόνη θα
    // κατηγορούσε τον κάτοχο για πεδίο που δεν υπάρχει στο ακίνητό του (§8.32).
    const land = [listing({ id: 'p', type: 'plot' }), listing({ id: 'q', type: 'parcel' })];
    const count = tally(land, EMPTY_LISTING_CRITERIA, 'heatingType', CRITERION_VALUES.heatingType[0]);
    expect(count.matching).toBe(0);
    expect(count.undeclared).toBe(0);
  });

  it('«δήλωσε ότι δεν έχει καμία» μετριέται ως σιωπή ΑΠΕΝΑΝΤΙ ΣΕ ΜΙΑ ΤΙΜΗ', () => {
    // Το `declared-none` είναι **απάντηση** στη λογιστική της οθόνης 3 («δηλώθηκε ότι
    // δεν υπάρχουν»), αλλά απέναντι στο *«έχει τζάκι;»* δεν λέει **ναι** — και το
    // τετραγωνίδιο ρωτά ακριβώς αυτό.
    const declaredEmpty = [listing({ id: 'a', interiorFeatures: [] })];
    const count = tally(
      declaredEmpty,
      EMPTY_LISTING_CRITERIA,
      'interiorFeatures',
      CRITERION_VALUES.interiorFeatures[0]
    );
    expect(count.matching).toBe(0);
    expect(count.undeclared).toBe(1);
  });
});

// =============================================================================
// Δ — ΤΑ ΣΥΝΟΛΑ: ΜΙΑ ΑΓΓΕΛΙΑ ΠΡΟΣΑΥΞΑΝΕΙ ΠΟΛΛΟΥΣ ΚΑΔΟΥΣ
// =============================================================================

describe('Δ — μια αγγελία με πολλές τιμές μετριέται σε ΚΑΘΕ μία', () => {
  it('τρεις παροχές ⇒ τρεις κάδοι +1, από ΕΝΑ πέρασμα', () => {
    const [a, b, c] = CRITERION_VALUES.amenities;
    const listings = [listing({ id: 'a', amenities: [a, b, c] })];
    expect(tally(listings, EMPTY_LISTING_CRITERIA, 'amenities', a).matching).toBe(1);
    expect(tally(listings, EMPTY_LISTING_CRITERIA, 'amenities', b).matching).toBe(1);
    expect(tally(listings, EMPTY_LISTING_CRITERIA, 'amenities', c).matching).toBe(1);
    expect(tally(listings, EMPTY_LISTING_CRITERIA, 'amenities', a).undeclared).toBe(0);
  });
});
