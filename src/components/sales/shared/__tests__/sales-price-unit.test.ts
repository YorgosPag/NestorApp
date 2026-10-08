/**
 * Άγκυρες — ADR-777 §8.60.14.14 (Φάση 4): **οι σελίδες πωλήσεων βοηθητικών χώρων.**
 *
 * 1. Η κάρτα γράφει τιμή **και** τιμή/m² **με τη μονάδα του ρόλου** — πριν: «60 €» και «6 €/m²»
 *    για θέση που νοικιάζεται 60 €/μήνα.
 * 2. Το φίλτρο εύρους **φτάνει** στη μηχανή — πριν ο μεταφραστής του panel **πετούσε** τιμή και
 *    εμβαδόν: τα πεδία δέχονταν αριθμούς και δεν έκαναν τίποτα.
 */

import { mapCommonSpaceFilters, salesCardPricing, spacePanelFilters } from '../sales-space-page';
import { PRICE_AMOUNT_KEY, PRICE_PER_AREA_KEY, PRICE_STANDING_KEY } from '@/lib/listings/listing-price-keys';
import type { PriceLabelT } from '@/lib/listings/listing-price-label';
import { EMPTY_PRICE_RANGE } from '@/lib/properties/price-range';
import type { SalesSpaceFilterState } from '@/types/sales-shared';

const t: PriceLabelT = (key, options) => `${key}|${String(options?.price ?? '')}`;
const keyOf = (text: string | null) => (text === null ? null : text.split('|')[0]);

describe('Α. Η ΚΑΡΤΑ ΓΡΑΦΕΙ ΤΗ ΜΟΝΑΔΑ', () => {
  it('🔴 Α1 — θέση προς ενοίκιο: «/μήνα» στην τιμή ΚΑΙ «/m²/μήνα» στην τιμή/m²', () => {
    const view = salesCardPricing({ commercialStatus: 'for-rent', commercial: { rentPrice: 60 }, area: 12 }, t);
    expect(keyOf(view.price)).toBe(PRICE_AMOUNT_KEY.rent);
    expect(keyOf(view.pricePerSqm)).toBe(PRICE_PER_AREA_KEY.rent);
  });

  it('Α2 — πώληση: κλειδιά πώλησης· χωρίς εμβαδόν ⇒ καμία τιμή/m² (ποτέ διαίρεση με το μηδέν)', () => {
    const withArea = salesCardPricing({ commercialStatus: 'for-sale', commercial: { askingPrice: 12_000 }, area: 12 }, t);
    expect(keyOf(withArea.price)).toBe(PRICE_AMOUNT_KEY.sale);
    expect(keyOf(withArea.pricePerSqm)).toBe(PRICE_PER_AREA_KEY.sale);
    expect(withArea.pricePerSqm?.split('|')[1]).toMatch(/1[.,\s ]?000/); // 12.000 / 12 m²

    const noArea = salesCardPricing({ commercialStatus: 'for-sale', commercial: { askingPrice: 12_000 } }, t);
    expect(noArea.pricePerSqm).toBeNull();
  });

  it('Α3 — χωρίς τιμή ⇒ `null` (η κάρτα γράφει παύλα, ποτέ «0 €»)', () => {
    expect(salesCardPricing({ commercialStatus: 'for-sale', area: 10 }, t))
      .toEqual({ price: null, pricePerSqm: null, standingLabel: null });
  });
});

/**
 * 🔴 ADR-329 §3.9 (Ν3 → κάρτες πωλήσεων, 2026-10-08): οι σελίδες πωλήσεων χώρων δείχνουν **όλους**
 * τους χώρους (το φίλτρο διάθεσης είναι επιλογή, όχι πύλη) — άρα και θέση «Μη διαθέσιμη», με το ποσό
 * της στο πράσινο της προσφοράς. Η στάθμη ταξιδεύει πλέον **μαζί** με το κείμενο.
 */
describe('Α′. ΠΟΣΟ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΠΡΟΣΦΟΡΑ ΤΟ ΛΕΕΙ', () => {
  const priced = { commercial: { askingPrice: 12_000 }, area: 12 };

  it('προσφορά ⇒ καμία σημείωση στάθμης (η κάρτα κρατά λέξη και χρώμα)', () => {
    expect(salesCardPricing({ ...priced, commercialStatus: 'for-sale' }, t).standingLabel).toBeNull();
    expect(salesCardPricing({ ...priced, commercialStatus: 'reserved' }, t).standingLabel).toBeNull();
  });

  it('🔴 εκτός αγοράς ⇒ «Τιμή ζήτησης»· το ποσό και η τιμή/m² μένουν ίδια', () => {
    const offered = salesCardPricing({ ...priced, commercialStatus: 'for-sale' }, t);
    const offMarket = salesCardPricing({ ...priced, commercialStatus: 'unavailable' }, t);
    expect(keyOf(offMarket.standingLabel)).toBe(PRICE_STANDING_KEY['off-market']);
    expect(offMarket.price).toBe(offered.price);
    expect(offMarket.pricePerSqm).toBe(offered.pricePerSqm);
  });

  it('🔴 αποσυρμένος χώρος ⇒ «Τελευταία τιμή», ακόμη κι αν η κατάσταση λέει «προς πώληση»', () => {
    const trashed = salesCardPricing({ ...priced, commercialStatus: 'for-sale', status: 'deleted' }, t);
    expect(keyOf(trashed.standingLabel)).toBe(PRICE_STANDING_KEY.retired);
  });
});

describe('Β. ΤΟ ΕΥΡΟΣ ΦΤΑΝΕΙ ΣΤΗ ΜΗΧΑΝΗ — ΜΕ ΤΗ ΜΟΝΑΔΑ ΤΟΥ', () => {
  it('🔴 Β1 — τα εύρη του panel ΔΕΝ πετιούνται πια (τιμή με ρόλο + εμβαδόν)', () => {
    const mapped = mapCommonSpaceFilters({
      ranges: { priceRange: { role: 'rent', max: 90 }, areaRange: { min: 10 } },
    });
    expect(mapped.priceRange).toEqual({ role: 'rent', max: 90 });
    expect(mapped.areaRange).toEqual({ min: 10, max: null });
  });

  it('Β2 — χωρίς εύρος ⇒ το ΚΕΝΟ εύρος (ορατός ρόλος, καμία ερώτηση)', () => {
    expect(mapCommonSpaceFilters({}).priceRange).toBe(EMPTY_PRICE_RANGE);
  });

  it('Β3 — πήγαινε-έλα: σελίδα → panel → σελίδα κρατά αριθμούς ΚΑΙ μονάδα (τα πεδία δεν αδειάζουν)', () => {
    const page: SalesSpaceFilterState = {
      searchTerm: '', status: 'all', type: 'all', building: 'all', floor: 'all',
      priceRange: { role: 'rent', min: 50, max: 90 },
      areaRange: { min: 10, max: null },
    };
    const panel = spacePanelFilters(page);
    expect(panel.ranges.priceRange).toEqual({ role: 'rent', min: 50, max: 90 });
    const back = mapCommonSpaceFilters({ ranges: panel.ranges });
    expect(back.priceRange).toEqual(page.priceRange);
    expect(back.areaRange).toEqual(page.areaRange);
  });

  it("🔴 Β4 — το panel δίνει ΚΕΙΜΕΝΟ ('all'), όχι πίνακα: 'all'[0] = 'a' άδειαζε ΚΑΘΕ λίστα (ζωντανό)", () => {
    const page: SalesSpaceFilterState = {
      searchTerm: '', status: 'all', type: 'all', building: 'all', floor: 'all',
      priceRange: { role: 'rent', max: 100 },
      areaRange: { min: null, max: null },
    };
    const back = mapCommonSpaceFilters(spacePanelFilters(page));
    expect(back).toMatchObject({ status: 'all', type: 'all', building: 'all', floor: 'all' });
    expect(mapCommonSpaceFilters({ building: ['bldg_1'], floor: [] })).toMatchObject({ building: 'bldg_1', floor: 'all' });
  });
});
