/**
 * @fileoverview **ΤΟ ΕΥΡΟΣ ΤΙΜΗΣ ΦΕΡΕΙ ΜΟΝΑΔΑ** — ADR-777 §8.60.14 Φάση 2.
 * @related lib/criteria/listing-criterion-reading.ts · lib/properties/price-resolver.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ — ΚΑΙ ΗΤΑΝ ΑΟΡΑΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως τις 2026-09-17 ο άξονας `price` διάβαζε `getEffectivePrice(listing)?.amount`, **χωρίς
 * ρόλο**. Το «έως 1.000 €» δεχόταν ενοίκιο **900 €/μήνα** και διανυκτέρευση **50 €/νύχτα**
 * — ποσά που διαφέρουν κατά **τριάντα φορές**. Κάθε test ήταν πράσινο: το φίλτρο
 * **δούλευε**, απλώς πάνω σε μέγεθος που **δεν υπάρχει**.
 *
 * 🔑 **Η άγκυρα δεν ελέγχει «υπάρχουν τρεις άξονες».** Ελέγχει ότι ένα εύρος σε €/μήνα
 * **δεν αποκλείει** μια πώληση και **δεν τη χρεώνει ως σιωπή** — δηλαδή ότι η τέταρτη
 * κατάσταση (`not-applicable`) πράγματι φτάνει ως την ετυμηγορία.
 */

import { UNASKED_LISTING_ATTRIBUTES, type ListedAt, type PublicListing } from '@/types/public-listing';
import { priceClassOf } from '@/lib/properties/price-resolver';
import { readNumericAnswer } from '../listing-criterion-reading';
import { judgeCriterion, matchListingCriteria } from '../listing-criteria-judge';
import type { ListingCriteria } from '../listing-criteria';
import { CRITERION_PARAM, RETIRED_RANGE_PARAMS, readRetiredPriceRange } from '../listing-criteria-url';

const AT = '2026-09-17T10:00:00.000Z';
const KNOWN: ListedAt = { kind: 'known', at: AT };
const NO_AMOUNTS = { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate: null };

function listingOf(
  id: string,
  commercialStatus: PublicListing['commercialStatus'],
  commercial: PublicListing['commercial'],
  offerKinds: PublicListing['offerKinds'],
): PublicListing {
  return {
    id,
    title: id,
    listedAt: KNOWN,
    projectedAt: AT,
    commercialStatus,
    commercial,
    stay: null,
    exchange: null,
    coverImage: null,
    gallery: [],
    floorplans: [],
    type: 'apartment',
    areaSqm: 90,
    offerKinds,
    position: { kind: 'unknown', reason: 'never-asked' },
    place: null,
    floor: null,
    bedrooms: null,
    ...UNASKED_LISTING_ATTRIBUTES,
    legality: [],
    authorship: 'agency',
    agencyName: 'ΑΛΦΑ',
    agencyId: 'comp_alfa',
  };
}

/** 170.000 € πώλησης. */
const SALE = listingOf('sale', 'for-sale', { ...NO_AMOUNTS, askingPrice: 170_000 }, ['sell']);
/** 900 €/μήνα. */
const RENT = listingOf('rent', 'for-rent', { ...NO_AMOUNTS, rentPrice: 900 }, ['leaseOut']);
/** 50 €/νύχτα — η μόνη μορφή που δίνει ρόλο `nightly` (ADR-835 §4.4). */
const STAY = listingOf('stay', 'unavailable', { ...NO_AMOUNTS, nightlyRate: 50 }, ['leaseShort']);
/** Στην αγορά, χωρίς καταχωρημένο ποσό. */
const UNPRICED = listingOf('unpriced', 'for-sale', NO_AMOUNTS, ['sell']);

describe('Α. Η ΕΦΑΡΜΟΣΙΜΟΤΗΤΑ — ο άξονας ρωτά ΜΙΑ μονάδα', () => {
  it('Α1 — ο άξονας του ενοικίου διαβάζει ΜΟΝΟ ενοίκια', () => {
    expect(readNumericAnswer(RENT, 'priceRent').state).toBe('declared');
    expect(readNumericAnswer(SALE, 'priceRent').state).toBe('not-applicable');
    expect(readNumericAnswer(STAY, 'priceRent').state).toBe('not-applicable');
  });

  it('Α2 — ο άξονας της πώλησης διαβάζει ΜΟΝΟ πωλήσεις', () => {
    expect(readNumericAnswer(SALE, 'priceSale').state).toBe('declared');
    expect(readNumericAnswer(RENT, 'priceSale').state).toBe('not-applicable');
  });

  it('Α3 — ο άξονας της διανυκτέρευσης διαβάζει ΜΟΝΟ καταλύματα', () => {
    expect(readNumericAnswer(STAY, 'priceNightly').state).toBe('declared');
    expect(readNumericAnswer(SALE, 'priceNightly').state).toBe('not-applicable');
  });

  it('🔴 Α4 — ΧΩΡΙΣ ΤΙΜΗ: «δεν με αφορά» σε ΚΑΙ ΤΟΥΣ ΤΡΕΙΣ, ποτέ «σιωπή του κατόχου»', () => {
    // Η τιμή **δεν** είναι δήλωση του κατόχου — προκύπτει από τις διαθέσεις. Ένα
    // `never-asked` θα την έβαζε στον κάδο «δεν το δήλωσαν», δηλαδή θα ζητούσε από τον
    // κάτοχο να «δηλώσει» κάτι που το σύστημα υπολογίζει.
    for (const key of ['priceSale', 'priceRent', 'priceNightly'] as const) {
      expect(readNumericAnswer(UNPRICED, key).state).toBe('not-applicable');
    }
    expect(priceClassOf(UNPRICED)).toBe('unpriced');
  });
});

describe('🔴 Β. Η ΚΡΙΣΗ — το «έως 1.000 €/μήνα» ΔΕΝ αγγίζει τις πωλήσεις', () => {
  const RENT_UP_TO_1000: ListingCriteria = { priceRent: { min: null, max: 1000 } };

  it('🔴 Β1 — ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: 50 €/νύχτα ΔΕΝ περνά πια για «έως 1.000 €/μήνα»', () => {
    // Με τον παλιό μονό άξονα το `50 ≤ 1000` ήταν **αληθές** και το κατάλυμα περνούσε
    // ως «ενοίκιο ως 1.000 €» — ενώ 50 €/νύχτα είναι ~1.500 €/μήνα.
    expect(judgeCriterion(STAY, RENT_UP_TO_1000, 'priceRent')).toBe('not-applicable');
    expect(judgeCriterion(RENT, RENT_UP_TO_1000, 'priceRent')).toBe('satisfied');
  });

  it('🔴 Β2 — η πώληση ΔΕΝ αποκλείεται από ερώτηση που δεν της έγινε', () => {
    // `excluded` θα την εξαφάνιζε· `undeclared` θα τη χρέωνε ως σιωπή. Και τα δύο θα
    // ήταν ισχυρισμοί για την **αγγελία**, ενώ το γεγονός αφορά την **ερώτηση**.
    expect(judgeCriterion(SALE, RENT_UP_TO_1000, 'priceRent')).toBe('not-applicable');

    const verdict = matchListingCriteria(SALE, RENT_UP_TO_1000);
    expect(verdict.verdict).toBe('matches');
    expect(verdict.excludedBy).toEqual([]);
    expect(verdict.undeclaredOn).toEqual([]);
  });

  it('Β3 — μέσα στη ΔΙΚΗ του μονάδα ο άξονας κρίνει κανονικά', () => {
    expect(judgeCriterion(RENT, { priceRent: { min: null, max: 800 } }, 'priceRent')).toBe('excluded');
    expect(judgeCriterion(RENT, { priceRent: { min: 500, max: null } }, 'priceRent')).toBe('satisfied');
  });

  it('🏆 Β4 — ΔΥΟ ΠΡΟΫΠΟΛΟΓΙΣΜΟΙ ΤΑΥΤΟΧΡΟΝΑ — κάτι που η Zillow δεν εκφράζει', () => {
    // «Πωλήσεις ως 200.000 ΚΑΙ ενοίκια ως 900» δεν είναι αντίφαση: είναι **δύο**
    // ερωτήσεις, σε δύο μονάδες, και κάθε αγγελία κρίνεται από τη **δική της**.
    const both: ListingCriteria = {
      priceSale: { min: null, max: 200_000 },
      priceRent: { min: null, max: 900 },
    };
    expect(matchListingCriteria(SALE, both).verdict).toBe('matches');
    expect(matchListingCriteria(RENT, both).verdict).toBe('matches');

    const tooDear = listingOf('dear', 'for-sale', { ...NO_AMOUNTS, askingPrice: 900_000 }, ['sell']);
    expect(matchListingCriteria(tooDear, both).excludedBy).toEqual(['priceSale']);
  });
});

describe('Γ. Η ΔΙΕΥΘΥΝΣΗ — η μονάδα ζει ΜΕΣΑ στο όνομα', () => {
  it('Γ1 — τρία ονόματα, ένα ανά μονάδα, κανένα κοινό', () => {
    const names = [CRITERION_PARAM.priceSale, CRITERION_PARAM.priceRent, CRITERION_PARAM.priceNightly];
    expect(new Set(names).size).toBe(3);
  });

  it('🔴 Γ2 — το ΠΑΛΙΟ `p` ΔΕΝ ανακυκλώθηκε σε κανέναν ρόλο', () => {
    // Ανακύκλωσή του θα ήταν **εικασία με στολή συμβατότητας**: ο άνθρωπος που έγραψε
    // «έως 1.000» μπορεί να εννοούσε ενοίκιο.
    expect(Object.values(CRITERION_PARAM)).not.toContain('p');
  });

  it('🏆 Γ3 — ο παλιός σύνδεσμος ΑΝΑΓΝΩΡΙΖΕΤΑΙ, δεν πετιέται σιωπηλά', () => {
    const params = new URLSearchParams(
      `${RETIRED_RANGE_PARAMS.price.min}=100&${RETIRED_RANGE_PARAMS.price.max}=1000`,
    );
    expect(readRetiredPriceRange(params)).toEqual({ min: 100, max: 1000 });
  });

  it('Γ4 — μονό άκρο είναι πλήρες αίτημα· καθόλου άκρα είναι καμία ερώτηση', () => {
    expect(readRetiredPriceRange(new URLSearchParams('pmax=1000'))).toEqual({ min: null, max: 1000 });
    expect(readRetiredPriceRange(new URLSearchParams('beds=2'))).toBeNull();
  });
});
