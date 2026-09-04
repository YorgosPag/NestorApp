/**
 * **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΛΕΞΙΛΟΓΙΟΥ ΚΡΙΤΗΡΙΩΝ** (ADR-777 §7 Α3 · Α5 · §8.32 · ADR-842 Φ3).
 *
 * ⚠️ **Κάθε ομάδα εδώ ΕΚΤΕΛΕΙ τη ζωντανή συνάρτηση**, ποτέ αντίγραφο της λογικής της —
 * ένα test που ξαναγράφει τον κανόνα επικυρώνει τον εαυτό του (CHECK 3.54, «μπορεί
 * αυτό το αρχείο να κοκκινίσει κάτι;»).
 */

import { OFFER_KINDS } from '@/types/property-offers';
import { UNASKED_LISTING_ATTRIBUTES, type PublicListing } from '@/types/public-listing';
import {
  LISTING_ATTRIBUTE_KEYS,
  LISTING_FEATURE_SET_KEYS,
} from '@/lib/listings/listing-disclosure';

import {
  LISTING_CRITERION_ASKING,
  LISTING_CRITERION_KEYS,
  LAND_CANNOT_ANSWER,
  criterionKeysWithShape,
  type RangeCriterionKey,
  type ValueSetCriterionKey,
} from '../listing-criterion-asking';
import {
  CRITERION_PARAM,
  LEGACY_PARAM_ALIASES,
  RESERVED_SEARCH_PARAMS,
  parseListingCriteria,
  rangeParams,
  writeListingCriteria,
} from '../listing-criteria-url';
import { CRITERION_VALUES } from '../listing-criterion-values';
import {
  EMPTY_LISTING_CRITERIA,
  askedCriterionKeys,
  withFlag,
  withRange,
  withValues,
} from '../listing-criteria';
import {
  computeCriteriaLedger,
  criteriaLedgerBalances,
  judgeCriterion,
  listingSurvivesCriteria,
  matchListingCriteria,
} from '../listing-criteria-judge';
import { criterionAppliesTo, readValuesAnswer } from '../listing-criterion-reading';

const AT = '2026-08-10T10:00:00.000Z';

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

// =============================================================================
// Κ — Ο ΠΙΝΑΚΑΣ ΕΙΝΑΙ ΕΞΑΝΤΛΗΤΙΚΟΣ ΚΑΙ ΤΑ ΟΝΟΜΑΤΑ ΜΟΝΑΔΙΚΑ
// =============================================================================

describe('Κ — ο πίνακας αξόνων: εξαντλητικός, και τα ονόματά του δεν συγκρούονται', () => {
  it('🔴 ΚΑΘΕ δημόσιο στοιχείο έχει σχήμα — νέο πεδίο δεν περνά αδήλωτο', () => {
    // Η εγγύηση είναι του μεταγλωττιστή (`Record<ListingAttributeKey | …>`)· αυτή η
    // άγκυρα την κάνει **ορατή σε χρόνο εκτέλεσης**, ώστε μια μελλοντική χαλάρωση
    // του τύπου (`Partial<>`, `as`) να μη γίνει σιωπηλά.
    for (const key of [...LISTING_ATTRIBUTE_KEYS, ...LISTING_FEATURE_SET_KEYS]) {
      expect(LISTING_CRITERION_ASKING).toHaveProperty(key);
    }
    expect(LISTING_CRITERION_KEYS.length).toBe(
      LISTING_ATTRIBUTE_KEYS.length + LISTING_FEATURE_SET_KEYS.length + 4,
    );
  });

  it('🔴 ΚΑΜΙΑ ΣΥΓΚΡΟΥΣΗ ΟΝΟΜΑΤΩΝ — ούτε μεταξύ αξόνων, ούτε με τους δεσμευμένους', () => {
    // Μια σύγκρουση εδώ θα ήταν **αόρατη**: η μία πλευρά θα διάβαζε σκουπίδια της
    // άλλης, σιωπηλά, μέσα σε κοινοποιημένο σύνδεσμο.
    const names: string[] = [...RESERVED_SEARCH_PARAMS, ...Object.keys(LEGACY_PARAM_ALIASES)];

    for (const key of LISTING_CRITERION_KEYS) {
      if (LISTING_CRITERION_ASKING[key] === 'range') {
        const { min, max } = rangeParams(key as RangeCriterionKey);
        names.push(min, max);
      } else {
        names.push(CRITERION_PARAM[key]);
      }
    }

    expect(new Set(names).size).toBe(names.length);
  });

  it('🔴 ΚΑΘΕ άξονας λεξιλογίου έχει κλειστό σύνολο τιμών, και δεν είναι κενό', () => {
    for (const key of [
      ...criterionKeysWithShape('enum-any'),
      ...criterionKeysWithShape('set-any'),
      ...criterionKeysWithShape('set-all'),
    ]) {
      const values: readonly string[] | undefined =
        CRITERION_VALUES[key as ValueSetCriterionKey];
      expect(values).toBeDefined();
      expect(values?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('η διάθεση δείχνει στο ΥΠΑΡΧΟΝ λεξιλόγιο, όχι σε αντίγραφό του', () => {
    expect(CRITERION_VALUES.offerKind).toBe(OFFER_KINDS);
  });
});

// =============================================================================
// Δ — Η ΔΙΕΥΘΥΝΣΗ
// =============================================================================

describe('Δ — διεύθυνση ⇄ κριτήρια', () => {
  function roundTrip(criteria: Parameters<typeof writeListingCriteria>[0]) {
    const params = new URLSearchParams();
    writeListingCriteria(criteria, params);
    return parseListingCriteria(params);
  }

  it('🔴 ΚΑΝΟΝΙΚΟΠΟΙΗΣΗ ΣΕΙΡΑΣ — δύο ίδιες ερωτήσεις δίνουν ΜΙΑ διεύθυνση', () => {
    // `?amen=elevator&amen=pool` και `?amen=pool&amen=elevator` είναι η **ίδια**
    // ερώτηση. Δύο διευθύνσεις για ένα περιεχόμενο είναι, για μηχανή αναζήτησης,
    // δύο σελίδες — η κλασική παθολογία της πλοήγησης με όψεις.
    const a = parseListingCriteria(new URLSearchParams('amen=elevator&amen=pool'));
    const b = parseListingCriteria(new URLSearchParams('amen=pool&amen=elevator'));
    expect(a).toEqual(b);
  });

  it('🔴 ΤΑ ΔΙΠΛΟΤΥΠΑ ΠΕΦΤΟΥΝ ΣΤΗΝ ΠΟΡΤΑ — διπλό κλικ δεν αλλάζει τη διεύθυνση', () => {
    const twice = parseListingCriteria(new URLSearchParams('amen=pool&amen=pool'));
    expect(twice.amenities).toEqual(['pool']);
  });

  it('το κενό κριτήριο ΔΕΝ γράφεται — ούτε ως εύρος χωρίς άκρα, ούτε ως κενό σύνολο', () => {
    let criteria = withRange(EMPTY_LISTING_CRITERIA, 'price', { min: null, max: null });
    criteria = withValues(criteria, 'amenities', []);
    expect(criteria).toEqual(EMPTY_LISTING_CRITERIA);

    const params = new URLSearchParams();
    writeListingCriteria(EMPTY_LISTING_CRITERIA, params);
    expect(params.toString()).toBe('');
  });

  it('🔴 ΙΔΕΜΠΟΤΕΝΤΙΚΟ — δεύτερο πέρασμα δεν αλλάζει τίποτα', () => {
    let criteria = withRange(EMPTY_LISTING_CRITERIA, 'floor', { min: 0, max: 3 });
    criteria = withValues(criteria, 'heatingType', ['autonomous']);
    criteria = withFlag(criteria, 'hasPhotos', true);

    const once = roundTrip(criteria);
    expect(once).toEqual(criteria);
    expect(roundTrip(once)).toEqual(once);
  });

  it('🔴 ΤΟ ΙΣΟΓΕΙΟ ΕΙΝΑΙ 0, ΚΑΙ ΤΟ 0 ΕΠΙΒΙΩΝΕΙ', () => {
    // Ένα `Number(raw) || null` θα το ισοπέδωνε σε «δεν ρωτήθηκε» — και κανένας
    // άνθρωπος δεν θα μπορούσε ποτέ να ζητήσει ισόγειο.
    const parsed = parseListingCriteria(new URLSearchParams('flmin=0&flmax=0'));
    expect(parsed.floor).toEqual({ min: 0, max: 0 });
  });
});

// =============================================================================
// Α — Ο ΤΡΙΤΟΣ ΚΑΔΟΣ: Η ΣΙΩΠΗ ΟΝΟΜΑΖΕΤΑΙ, ΔΕΝ ΕΞΑΦΑΝΙΖΕΙ
// =============================================================================

describe('Α — 🏆 ο τρίτος κάδος: «δεν το δήλωσαν» ≠ «δεν ταιριάζει»', () => {
  const wantsEnergyB = withValues(EMPTY_LISTING_CRITERIA, 'energyClass', ['B']);

  it('🔴 αγγελία ΧΩΡΙΣ ενεργειακή κλάση ΜΕΝΕΙ ορατή, και μετριέται χωριστά', () => {
    const silent = listing({ energyClass: null });
    expect(listingSurvivesCriteria(silent, wantsEnergyB)).toBe(true);
    expect(matchListingCriteria(silent, wantsEnergyB)).toEqual({
      verdict: 'undeclared',
      excludedBy: [],
      undeclaredOn: ['energyClass'],
    });
  });

  it('ο ΠΑΡΟΝΟΜΑΣΤΗΣ: αγγελία που ΑΠΑΝΤΗΣΕ και δεν ταιριάζει, αποκλείεται', () => {
    const wrong = listing({ energyClass: 'D' });
    expect(listingSurvivesCriteria(wrong, wantsEnergyB)).toBe(false);
    expect(matchListingCriteria(wrong, wantsEnergyB).excludedBy).toEqual(['energyClass']);
  });

  it('…και αυτή που ταιριάζει, ταιριάζει', () => {
    expect(matchListingCriteria(listing({ energyClass: 'B' }), wantsEnergyB).verdict)
      .toBe('matches');
  });

  it('🔴 Ο ΑΠΟΚΛΕΙΣΜΟΣ ΝΙΚΑΕΙ ΤΗΝ ΑΓΝΟΙΑ — κλειστή υπόθεση δεν γίνεται «ίσως»', () => {
    // Μια αγγελία ενοικίασης όταν ζητάς πώληση **δεν** γίνεται αβέβαιη επειδή
    // αγνοούμε την ενεργειακή της κλάση.
    const rental = listing({ offerKinds: ['leaseOut'], energyClass: null });
    const criteria = withValues(wantsEnergyB, 'offerKind', ['sell']);
    const match = matchListingCriteria(rental, criteria);
    expect(match.verdict).toBe('excluded');
    expect(match.excludedBy).toEqual(['offerKind']);
    // ⚠️ Η άγνοια **καταγράφεται κι ας έχασε**: αν χαλαρώσει ο αποκλείων άξονας,
    //    είναι ακόμη εκεί.
    expect(match.undeclaredOn).toEqual(['energyClass']);
  });

  it('🔴 «ΔΗΛΩΣΕ ΚΑΜΙΑ» ΕΙΝΑΙ ΑΠΑΝΤΗΣΗ — κρίνεται, δεν πάει στην άγνοια', () => {
    // ADR-842 Φ3: ο κάτοχος **απάντησε**. Το να μετρηθεί ως «δεν το δήλωσε» θα του
    // ζητούσε να ξαναπεί κάτι που είπε.
    const declaredNone = listing({ amenities: [] });
    const neverAsked = listing({ amenities: null });
    const wantsPool = withValues(EMPTY_LISTING_CRITERIA, 'amenities', ['pool']);

    expect(matchListingCriteria(declaredNone, wantsPool).verdict).toBe('excluded');
    expect(matchListingCriteria(neverAsked, wantsPool).verdict).toBe('undeclared');
  });

  it('🔴 ΑΞΟΝΑΣ ΠΟΥ ΔΕΝ ΡΩΤΗΘΗΚΕ ΔΕΝ ΠΑΡΑΓΕΙ ΑΓΝΟΙΑ', () => {
    // Αλλιώς κάθε αγγελία θα κουβαλούσε τις «27 μείον 12» σιωπές της σε **κάθε**
    // αναζήτηση, και ο κάδος θα ήταν μονίμως γεμάτος — δηλαδή άχρηστος.
    expect(matchListingCriteria(listing({ energyClass: null }), EMPTY_LISTING_CRITERIA))
      .toEqual({ verdict: 'matches', excludedBy: [], undeclaredOn: [] });
  });
});

// =============================================================================
// Γ — Η ΓΗ: «ΔΕΝ ΣΗΚΩΝΕΙ ΤΗΝ ΕΡΩΤΗΣΗ» ≠ «ΔΕΝ ΤΟ ΔΗΛΩΣΕ»
// =============================================================================

describe('Γ — 🔴 η τέταρτη κατάσταση: not-applicable (ADR-777 §8.32, γενικευμένο)', () => {
  const plot = listing({ id: 'plot', type: 'plot', floor: null, bedrooms: null });

  it('η γη ΕΠΙΒΙΩΝΕΙ φίλτρου ορόφου — και ΔΕΝ μετριέται ως «δεν το δήλωσε»', () => {
    // 🔑 Η διαφορά είναι ορατή στην οθόνη: κανείς δεν χρωστά στον κάτοχο γης δήλωση
    //    ορόφου, οπότε το οικόπεδο **δεν** ανήκει στον κάδο «3 δεν το δήλωσαν».
    const wantsThirdFloor = withRange(EMPTY_LISTING_CRITERIA, 'floor', { min: 3, max: null });
    expect(listingSurvivesCriteria(plot, wantsThirdFloor)).toBe(true);
    expect(matchListingCriteria(plot, wantsThirdFloor)).toEqual({
      verdict: 'matches',
      excludedBy: [],
      undeclaredOn: [],
    });
    expect(judgeCriterion(plot, wantsThirdFloor, 'floor')).toBe('not-applicable');
  });

  it('🔴 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ΔΙΑΜΕΡΙΣΜΑ χωρίς όροφο ΕΙΝΑΙ άγνοια, όχι μη εφαρμοσιμότητα', () => {
    const flat = listing({ id: 'flat', floor: null });
    const wantsThirdFloor = withRange(EMPTY_LISTING_CRITERIA, 'floor', { min: 3, max: null });
    expect(judgeCriterion(flat, wantsThirdFloor, 'floor')).toBe('undeclared');
    expect(matchListingCriteria(flat, wantsThirdFloor).undeclaredOn).toEqual(['floor']);
  });

  it('🔴 Ο ΚΑΝΟΝΑΣ ΓΕΝΙΚΕΥΤΗΚΕ — και οι 24 άξονες, όχι μόνο τα υπνοδωμάτια', () => {
    // Το ελάττωμα δεν ήταν η μία γραμμή· ήταν ότι ήταν **μία**.
    for (const key of LAND_CANNOT_ANSWER) {
      expect(criterionAppliesTo(plot, key)).toBe(false);
    }
    expect(LAND_CANNOT_ANSWER.length).toBeGreaterThan(20);
  });

  it('…αλλά η γη ΣΗΚΩΝΕΙ εμβαδόν, είδος, τιμή, διάθεση και ΠΡΟΣΑΝΑΤΟΛΙΣΜΟ', () => {
    // Ένα οικόπεδο **έχει** προσανατολισμό. Ένας υπερβολικά πλατύς κατάλογος
    // αρνήσεων θα έκανε φίλτρα να «περνούν» σιωπηλά χωρίς να κρίνουν τίποτα.
    for (const key of ['areaSqm', 'type', 'price', 'offerKind', 'orientations'] as const) {
      expect(criterionAppliesTo(plot, key)).toBe(true);
    }
  });
});

// =============================================================================
// Σ — ΤΑ ΣΧΗΜΑΤΑ ΣΥΝΟΛΟΥ ΚΡΙΝΟΥΝ ΔΙΑΦΟΡΕΤΙΚΑ
// =============================================================================

describe('Σ — `set-all` στενεύει, `set-any` χαλαρώνει', () => {
  it('🔴 ΟΙ ΠΑΡΟΧΕΣ ΕΙΝΑΙ ΑΠΑΙΤΗΣΕΙΣ: «τζάκι ΚΑΙ ασανσέρ» θέλει ΚΑΙ ΤΑ ΔΥΟ', () => {
    const both = listing({ amenities: ['elevator', 'pool'] });
    const one = listing({ id: 'one', amenities: ['elevator'] });
    const wants = withValues(EMPTY_LISTING_CRITERIA, 'amenities', ['elevator', 'pool']);

    expect(judgeCriterion(both, wants, 'amenities')).toBe('satisfied');
    expect(judgeCriterion(one, wants, 'amenities')).toBe('excluded');
  });

  it('🔴 Ο ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΣ ΕΙΝΑΙ ΠΕΡΙΓΡΑΦΗ: «νότιο Ή ανατολικό» αρκεί ΕΝΑ', () => {
    const south = listing({ orientations: ['south'] });
    const wants = withValues(EMPTY_LISTING_CRITERIA, 'orientations', ['south', 'east']);
    expect(judgeCriterion(south, wants, 'orientations')).toBe('satisfied');
  });

  it('🔴 Η ΔΙΑΘΕΣΗ ΚΡΑΤΑΕΙ ΤΗ ΣΗΜΕΡΙΝΗ ΤΟΜΗ — «πώληση Ή ενοικίαση» δέχεται και τα δύο', () => {
    const dual = listing({ offerKinds: ['sell', 'leaseOut'] });
    const wants = withValues(EMPTY_LISTING_CRITERIA, 'offerKind', ['leaseOut']);
    expect(judgeCriterion(dual, wants, 'offerKind')).toBe('satisfied');
  });
});

// =============================================================================
// Τ — ΤΟ ΕΙΔΟΣ ΚΑΝΟΝΙΚΟΠΟΙΕΙΤΑΙ
// =============================================================================

describe('Τ — 🔴 το παλαιό ελληνικό είδος ΑΠΑΝΤΑ στο κανονικό φίλτρο', () => {
  it('«Οικόπεδο» της βάσης ταιριάζει στο φίλτρο `plot`', () => {
    // Το `PublicListing.type` δηλώνει ρητά ότι κουβαλά παλαιές τιμές «για συμβατότητα
    // με παλιά έγγραφα Firestore». Χωρίς κανονικοποίηση, μια τέτοια αγγελία **δεν θα
    // απαντούσε ποτέ** στο φίλτρο — σιωπηλά.
    const legacy = listing({ type: 'Οικόπεδο' as PublicListing['type'] });
    expect(readValuesAnswer(legacy, 'type')).toEqual({ state: 'declared', value: ['plot'] });
  });
});

// =============================================================================
// Λ — Η ΛΟΓΙΣΤΙΚΗ ΚΛΕΙΝΕΙ
// =============================================================================

describe('Λ — «7 ταιριάζουν · 3 δεν το δήλωσαν»: το άθροισμα ελέγχεται', () => {
  it('τα τρία μέρη κλείνουν πάντα στο σύνολο', () => {
    const listings = [
      listing({ id: 'ok', energyClass: 'B' }),
      listing({ id: 'silent', energyClass: null }),
      listing({ id: 'wrong', energyClass: 'D' }),
    ];
    const ledger = computeCriteriaLedger(
      listings,
      withValues(EMPTY_LISTING_CRITERIA, 'energyClass', ['B']),
    );

    expect(ledger).toEqual({ total: 3, matching: 1, undeclared: 1, excluded: 1 });
    expect(criteriaLedgerBalances(ledger)).toBe(true);
  });

  it('τυπώνεται ΚΑΙ στο μηδέν — κενό σύνολο δεν σημαίνει «μην μετρήσεις»', () => {
    const ledger = computeCriteriaLedger([], EMPTY_LISTING_CRITERIA);
    expect(ledger).toEqual({ total: 0, matching: 0, undeclared: 0, excluded: 0 });
    expect(criteriaLedgerBalances(ledger)).toBe(true);
  });
});

// =============================================================================
// Ε — Η ΣΕΙΡΑ ΤΩΝ ΕΝΕΡΓΩΝ ΑΞΟΝΩΝ ΕΙΝΑΙ ΤΟΥ ΠΙΝΑΚΑ
// =============================================================================

describe('Ε — η σειρά έρχεται από τη δήλωση, όχι από το πάτημα των κουμπιών', () => {
  it('ίδιοι άξονες σε άλλη σειρά εισαγωγής ⇒ ΙΔΙΑ σειρά ανάγνωσης', () => {
    // Αλλιώς η λίστα των ενεργών φίλτρων χοροπηδά ανάλογα με το τι πάτησε πρώτο ο
    // άνθρωπος — και δύο ταυτόσημες αναζητήσεις διαβάζονται διαφορετικά.
    const a = withValues(
      withRange(EMPTY_LISTING_CRITERIA, 'price', { min: 1, max: null }),
      'amenities',
      ['pool'],
    );
    const b = withRange(
      withValues(EMPTY_LISTING_CRITERIA, 'amenities', ['pool']),
      'price',
      { min: 1, max: null },
    );
    expect(askedCriterionKeys(a)).toEqual(askedCriterionKeys(b));
  });
});
