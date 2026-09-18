/**
 * @fileoverview **ΑΓΚΥΡΑ — «ΜΙΑ ΑΝΑΓΚΗ, ΠΟΛΛΕΣ ΕΝΑΛΛΑΚΤΙΚΕΣ, Η ΚΑΘΕΜΙΑ ΜΕ ΤΗ ΜΟΝΑΔΑ ΤΗΣ»** (ADR-777 §8.60.15).
 *
 * 🔴 **Τι φυλάει**: ως τις 2026-09-18 η ζήτηση είχε **ένα** αμονάδιστο εύρος για **όλες** τις
 * διαθέσεις. «Αγορά ή ενοικίαση, 160.000-180.000» ⇒ **κάθε** ενοίκιο έβγαινε `price-below`, και το μισό
 * της ζήτησης δεν ταίριαζε **ποτέ** — σιωπηλά, χωρίς κανένα κόκκινο. Εδώ ασκείται **ολόκληρη** η
 * αλυσίδα: ανάγνωση αγγελίας ανά ρόλο → μηχανή → σύνδεσμος → ομοιότητα.
 *
 * 🔑 **Δεύτερη φωνή**: οι προσδοκίες είναι χειρόγραφοι αριθμοί, ποτέ ξαναϋπολογισμένοι με τις ίδιες
 * συναρτήσεις που κρίνονται.
 */

import { readNumericAnswer } from '@/lib/criteria/listing-criterion-reading';
import { rangeOf } from '@/lib/criteria/listing-criteria';
import { resolvePriceForRole } from '@/lib/properties/price-by-role';

import { matchDemandAgainstListing } from '../demand-matching';
import { priceAxisOutcome } from '../demand-match-price';
import { listingFiltersFromDemand } from '../demand-listing-filters';
import { demandsAreSimilar } from '../demand-similarity';
import { TODAY, demand, facts, listing, seek } from './demand-fixtures';

/** Αγγελία **πώληση και ενοικίαση**: 200.000 € ή 800 €/μήνα. */
const SALE_AND_RENT = listing({
  commercialStatus: 'for-sale-and-rent',
  commercial: { askingPrice: 200_000, finalPrice: null, rentPrice: 800, nightlyRate: null },
  offerKinds: ['sell', 'leaseOut'],
});

/** Αγγελία **μόνο ενοικίαση**: 800 €/μήνα. */
const RENT_ONLY = listing({
  commercialStatus: 'for-rent',
  commercial: { askingPrice: null, finalPrice: null, rentPrice: 800, nightlyRate: null },
  offerKinds: ['leaseOut'],
});

/** «Αγορά 160.000-180.000 € **ή** ενοικίαση έως 900 €/μήνα» — το σενάριο του ελαττώματος. */
const BUY_OR_RENT = demand({
  seeks: [seek('sell', { min: 160_000, max: 180_000 }), seek('leaseOut', { max: 900 })],
});

describe('Ρ — η αγγελία απαντά σε ΚΑΘΕ ρόλο που προσφέρει', () => {
  it('🔴 «πώληση + ενοικίαση» απαντά στο `priceRent` με το ενοίκιο (πριν: αόρατο — μόνο η κύρια τιμή)', () => {
    expect(readNumericAnswer(SALE_AND_RENT, 'priceRent')).toEqual({ state: 'declared', value: 800 });
    expect(readNumericAnswer(SALE_AND_RENT, 'priceSale')).toEqual({ state: 'declared', value: 200_000 });
  });

  it('η νύχτα μιλά ΜΟΝΟ όταν η βραχυχρόνια διάθεση είναι δηλωμένη', () => {
    const withNight = listing({
      commercial: { askingPrice: 200_000, finalPrice: null, rentPrice: null, nightlyRate: 70 },
      offerKinds: ['sell', 'leaseShort'],
    });
    const staleNight = listing({
      commercial: { askingPrice: 200_000, finalPrice: null, rentPrice: null, nightlyRate: 70 },
      offerKinds: ['sell'],
    });
    expect(resolvePriceForRole(withNight, 'nightly')?.amount).toBe(70);
    expect(resolvePriceForRole(staleNight, 'nightly')).toBeNull();
  });

  it('υπερσύνολο, ποτέ αλλαγή: η κύρια τιμή του ρόλου της μένει ίδια', () => {
    expect(resolvePriceForRole(SALE_AND_RENT, 'sale')?.amount).toBe(200_000);
    expect(resolvePriceForRole(RENT_ONLY, 'rent')?.amount).toBe(800);
    expect(resolvePriceForRole(RENT_ONLY, 'sale')).toBeNull();
  });
});

describe('Μ — η μηχανή κρίνει κάθε εναλλακτική ΣΤΗ ΜΟΝΑΔΑ ΤΗΣ', () => {
  it('🔴 ενοίκιο 800 €/μήνα ταιριάζει «ενοικίαση έως 900» — ΟΧΙ `price-below` απέναντι στις 160.000', () => {
    const match = matchDemandAgainstListing(BUY_OR_RENT, facts({ listing: RENT_ONLY }), TODAY);
    expect(match.verdict).toBe('match');
    expect(match.pricedAs).toBe('rent');
  });

  it('πώληση + ενοικίαση: η πώληση (200.000) αστοχεί, το ενοίκιο (800) ικανοποιεί ⇒ ταίριασμα ως ενοικίαση', () => {
    const match = matchDemandAgainstListing(BUY_OR_RENT, facts({ listing: SALE_AND_RENT }), TODAY);
    expect(match.verdict).toBe('match');
    expect(match.pricedAs).toBe('rent');
  });

  it('καμία εναλλακτική δεν χωρά ⇒ τα κενά είναι της ΠΙΟ ΚΟΝΤΙΝΗΣ, στη μονάδα της', () => {
    const tight = demand({ seeks: [seek('sell', { max: 150_000 }), seek('leaseOut', { max: 700 })] });
    const match = matchDemandAgainstListing(tight, facts({ listing: SALE_AND_RENT }), TODAY);
    expect(match.blockers).toEqual(['price-above']);
    // Ισοπαλία σε πλήθος εμποδίων ⇒ η σειρά του ανθρώπου: πρώτα η πώληση.
    expect(match.pricedAs).toBe('sale');
    expect(match.gaps.priceOverBy).toBe(50_000);
  });

  it('εναλλακτική ΧΩΡΙΣ όριο που η αγγελία προσφέρει ⇒ η τιμή δεν εμποδίζει', () => {
    const open = demand({ seeks: [seek('sell', { max: 100_000 }), seek('leaseOut')] });
    const match = matchDemandAgainstListing(open, facts({ listing: SALE_AND_RENT }), TODAY);
    expect(match.verdict).toBe('match');
  });

  it('🔴 ανοιχτή εναλλακτική που η αγγελία ΔΕΝ προσφέρει ΔΕΝ συγχωρεί την τιμή', () => {
    // «Αγορά έως 100.000 ή ενοικίαση χωρίς όριο» απέναντι σε αγγελία ΜΟΝΟ πώλησης 200.000 €:
    // η ενοικίαση δεν υπάρχει εδώ, άρα κρίνεται μόνο η αγορά — και είναι ακριβή.
    const open = demand({ seeks: [seek('sell', { max: 100_000 }), seek('leaseOut')] });
    const match = matchDemandAgainstListing(open, facts(), TODAY);
    expect(match.blockers).toEqual(['price-above']);
    expect(match.gaps.priceOverBy).toBe(100_000);
  });
});

describe('Σ — ο σύνδεσμος «δες τι υπάρχει» γράφει ΚΑΘΕ άξονα (πριν: κανέναν, με πολλές διαθέσεις)', () => {
  it('δύο εναλλακτικές ⇒ δύο άξονες τιμής, ο καθένας με το δικό του εύρος', () => {
    const { criteria } = listingFiltersFromDemand(BUY_OR_RENT);
    expect(rangeOf(criteria, 'priceSale')).toEqual({ min: 160_000, max: 180_000 });
    expect(rangeOf(criteria, 'priceRent')).toEqual({ min: null, max: 900 });
    expect(rangeOf(criteria, 'priceNightly')).toBeUndefined();
  });
});

describe('Ο — η ομοιότητα συγκρίνει ΜΟΝΟ στην ίδια μονάδα', () => {
  it('🔴 «αγορά έως 250.000» ΔΕΝ ανταγωνίζεται «ενοικίαση έως 900» — όσο κι αν «τέμνονται» ως αριθμοί', () => {
    const buyer = demand({ id: 'dmnd_b', seeks: [seek('sell', { max: 250_000 })] });
    const renter = demand({ id: 'dmnd_r', seeks: [seek('leaseOut', { max: 900 })] });
    expect(demandsAreSimilar(buyer, renter)).toBe(false);
  });

  it('κοινή ενοικίαση με εύρη που τέμνονται ⇒ ανταγωνίζονται, όποιες κι αν είναι οι άλλες εναλλακτικές', () => {
    const renter = demand({ id: 'dmnd_r', seeks: [seek('leaseOut', { min: 700, max: 900 })] });
    expect(demandsAreSimilar(BUY_OR_RENT, renter)).toBe(true);
  });

  it('κοινή ενοικίαση με ΞΕΝΑ εύρη ⇒ δεν ανταγωνίζονται', () => {
    const renter = demand({ id: 'dmnd_r', seeks: [seek('leaseOut', { min: 1_500 })] });
    const buyer = demand({ id: 'dmnd_b', seeks: [seek('leaseOut', { max: 900 })] });
    expect(demandsAreSimilar(buyer, renter)).toBe(false);
  });
});

// =============================================================================
// Τ — ADR-777 §8.60.16: «ΩΣ ΤΙ» ΤΑΙΡΙΑΖΕΙ — και η εναλλακτική που δεν προσφέρεται ΔΕΝ σώζει την τιμή
// =============================================================================

describe('Τ — η μηχανή λέει ΩΣ ΤΙ ταιριάζει η αγγελία (`metOn`)', () => {
  it('μόνο ενοίκιο 800 απέναντι σε «αγορά ή ενοικίαση ≤ 900» ⇒ ως ενοικίαση, 100 €/μήνα περιθώριο', () => {
    const match = matchDemandAgainstListing(BUY_OR_RENT, facts({ listing: RENT_ONLY }), TODAY);
    expect(match.metOn).toEqual([{ kind: 'leaseOut', role: 'rent', amount: 800, headroomBy: 100 }]);
  });

  it('πώληση + ενοικίαση, η πώληση εκτός ⇒ ΜΟΝΟ ως ενοικίαση (όχι ως αγορά)', () => {
    const match = matchDemandAgainstListing(BUY_OR_RENT, facts({ listing: SALE_AND_RENT }), TODAY);
    expect(match.metOn.map((met) => met.kind)).toEqual(['leaseOut']);
  });

  it('🔴 και οι δύο χωρούν ⇒ ΚΑΙ ΟΙ ΔΥΟ, με τη σειρά του ανθρώπου — το `pricedAs` θα έλεγε μόνο τη μία', () => {
    const wide = demand({ seeks: [seek('sell', { max: 250_000 }), seek('leaseOut', { max: 900 })] });
    const match = matchDemandAgainstListing(wide, facts({ listing: SALE_AND_RENT }), TODAY);
    expect(match.metOn).toEqual([
      { kind: 'sell', role: 'sale', amount: 200_000, headroomBy: 50_000 },
      { kind: 'leaseOut', role: 'rent', amount: 800, headroomBy: 100 },
    ]);
  });

  it('εναλλακτικές χωρίς όριο ⇒ ποσό ναι (για να ειπωθεί), περιθώριο όχι', () => {
    const open = demand({ seeks: [seek('sell'), seek('leaseOut')] });
    const match = matchDemandAgainstListing(open, facts({ listing: SALE_AND_RENT }), TODAY);
    expect(match.metOn).toEqual([
      { kind: 'sell', role: 'sale', amount: 200_000, headroomBy: null },
      { kind: 'leaseOut', role: 'rent', amount: 800, headroomBy: null },
    ]);
  });

  it('ακριβώς στο όριο ⇒ περιθώριο 0 (όχι null — «στο όριο» είναι γεγονός)', () => {
    const exact = demand({ seeks: [seek('leaseOut', { max: 800 })] });
    const match = matchDemandAgainstListing(exact, facts({ listing: RENT_ONLY }), TODAY);
    expect(match.metOn).toEqual([{ kind: 'leaseOut', role: 'rent', amount: 800, headroomBy: 0 }]);
  });

  it('η αντιπαροχή χωρίς οροφή ικανοποιείται — ποσοστό όχι ευρώ, «προς συζήτηση» όταν δεν δηλώθηκε', () => {
    const land = listing({ offerKinds: ['exchange'], exchange: { landownerShare: null } });
    const { metOn } = priceAxisOutcome(land, [seek('exchange')]);
    expect(metOn).toEqual([{ kind: 'exchange', landownerShare: null, headroomBy: null }]);
  });

  it('κοντινό αποτέλεσμα ⇒ κανένα «ως τι»', () => {
    const tight = demand({ seeks: [seek('sell', { max: 150_000 }), seek('leaseOut', { max: 700 })] });
    const match = matchDemandAgainstListing(tight, facts({ listing: SALE_AND_RENT }), TODAY);
    expect(match.verdict).toBe('near-miss');
    expect(match.metOn).toEqual([]);
  });
});

describe('Υ — 🔴 η εναλλακτική που η αγγελία ΔΕΝ προσφέρει δεν σώζει την τιμή (σφάλμα κριτή, 18/09)', () => {
  /** Legacy status «πώληση + ενοικίαση» ⇒ ενοίκιο **δηλωμένο**· όμως διατίθεται ΜΟΝΟ για πώληση. */
  const SALE_WITH_STRAY_RENT = listing({
    commercialStatus: 'for-sale-and-rent',
    commercial: { askingPrice: 300_000, finalPrice: null, rentPrice: 800, nightlyRate: null },
    offerKinds: ['sell'],
  });

  it('πριν: ψευδές ταίριασμα «ως ενοικίαση» για ενοικίαση που δεν υπάρχει — τώρα η αγορά κρίνεται, και είναι ακριβή', () => {
    const match = matchDemandAgainstListing(BUY_OR_RENT, facts({ listing: SALE_WITH_STRAY_RENT }), TODAY);
    expect(match.verdict).toBe('near-miss');
    expect(match.blockers).toEqual(['price-above']);
    expect(match.gaps.priceOverBy).toBe(120_000);
    expect(match.pricedAs).toBe('sale');
    expect(match.metOn).toEqual([]);
  });

  it('στάση `partial` ανέπαφη: αγγελία ΧΩΡΙΣ ζητούμενη διάθεση κρίνεται ακόμη στην τιμή της', () => {
    const undeclared = listing({
      commercialStatus: 'for-rent',
      commercial: { askingPrice: null, finalPrice: null, rentPrice: 800, nightlyRate: null },
      offerKinds: [],
    });
    const renter = demand({ seeks: [seek('leaseOut', { max: 700 })] });
    const match = matchDemandAgainstListing(renter, facts({ listing: undeclared }), TODAY);
    expect(match.blockers).toEqual(expect.arrayContaining(['offer-kind', 'price-above']));
    expect(match.gaps.priceOverBy).toBe(100);
    expect(match.metOn).toEqual([]);
  });

  it('στάση `partial` με τιμή ΜΕΣΑ στο όριο ⇒ ακόμη κανένα «ως τι»: δεν ταιριάζει ως κάτι που δεν διατίθεται', () => {
    const undeclared = listing({
      commercialStatus: 'for-rent',
      commercial: { askingPrice: null, finalPrice: null, rentPrice: 800, nightlyRate: null },
      offerKinds: [],
    });
    const renter = demand({ seeks: [seek('leaseOut', { max: 900 })] });
    const match = matchDemandAgainstListing(renter, facts({ listing: undeclared }), TODAY);
    expect(match.blockers).toContain('offer-kind');
    expect(match.blockers).not.toContain('price-above');
    expect(match.metOn).toEqual([]);
  });
});
