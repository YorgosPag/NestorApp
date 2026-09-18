/**
 * Άγκυρες — ADR-777 §8.60.14.14 (Φάση 4): **το «Τιμή από/έως» των εσωτερικών οθονών φέρει ΜΟΝΑΔΑ.**
 *
 * Το περιστατικό: τέσσερις μηχανές φίλτρων έκριναν το εύρος πάνω στην κύρια τιμή **όποιου**
 * ρόλου — «έως 1.000» δεχόταν ενοίκιο 900 €/μήνα και διανυκτέρευση 50 €/νύχτα σαν τιμές πώλησης.
 */

import { EMPTY_PRICE_RANGE, isPriceRangeActive, matchesPriceRange } from '../price-range';
import { PRICE_ROLES, type PricedPropertyLike } from '../price-resolver';

const sale = (askingPrice: number): PricedPropertyLike =>
  ({ commercialStatus: 'for-sale', commercial: { askingPrice } });
const rent = (rentPrice: number): PricedPropertyLike =>
  ({ commercialStatus: 'for-rent', commercial: { rentPrice } });
const nightly = (nightlyRate: number): PricedPropertyLike =>
  ({ commercialStatus: 'unavailable', offerKinds: ['leaseShort'], commercial: { nightlyRate } });
const dual = (askingPrice: number, rentPrice: number): PricedPropertyLike =>
  ({ commercialStatus: 'for-sale-and-rent', commercial: { askingPrice, rentPrice } });
const unpriced = (): PricedPropertyLike => ({ commercialStatus: 'for-sale' });

describe('Α. ΤΟ ΕΥΡΟΣ ΚΡΙΝΕΙ ΜΟΝΟ ΠΟΣΑ ΤΗΣ ΜΟΝΑΔΑΣ ΤΟΥ', () => {
  it('🔴 Α1 — το περιστατικό: «πώληση έως 1.000 €» ΔΕΝ δέχεται ενοίκιο 900 €/μήνα ούτε 50 €/νύχτα', () => {
    const range = { role: 'sale', max: 1_000 } as const;
    expect(matchesPriceRange(rent(900), range)).toBe(false);
    expect(matchesPriceRange(nightly(50), range)).toBe(false);
    expect(matchesPriceRange(sale(800), range)).toBe(true);
    expect(matchesPriceRange(sale(170_000), range)).toBe(false);
  });

  it('Α2 — «ενοίκιο έως 900 €/μήνα» κρίνει ΜΟΝΟ ενοίκια — η πώληση 800 € δεν είναι 800 €/μήνα', () => {
    const range = { role: 'rent', max: 900 } as const;
    expect(matchesPriceRange(rent(900), range)).toBe(true);
    expect(matchesPriceRange(rent(950), range)).toBe(false);
    expect(matchesPriceRange(sale(800), range)).toBe(false);
  });

  it('Α3 — «πώληση ΚΑΙ ενοικίαση» απαντά σε εύρος ενοικίου με το ΕΝΟΙΚΙΟ της (resolvePriceForRole)', () => {
    expect(matchesPriceRange(dual(200_000, 800), { role: 'rent', max: 900 })).toBe(true);
    expect(matchesPriceRange(dual(200_000, 800), { role: 'rent', min: 850 })).toBe(false);
    expect(matchesPriceRange(dual(200_000, 800), { role: 'sale', max: 250_000 })).toBe(true);
  });

  it('Α4 — η νύχτα κρίνεται μόνο στη νύχτα', () => {
    expect(matchesPriceRange(nightly(50), { role: 'nightly', min: 40, max: 60 })).toBe(true);
    expect(matchesPriceRange(nightly(50), { role: 'rent', max: 60 })).toBe(false);
  });
});

describe('Β. Η ΑΠΟΥΣΙΑ — Η ΣΥΜΒΑΣΗ `WHERE` ΤΩΝ ΕΣΩΤΕΡΙΚΩΝ ΠΙΝΑΚΩΝ', () => {
  it('Β1 — ενεργό εύρος απέναντι σε ακίνητο χωρίς τιμή ⇒ βγαίνει (ποτέ «κοστίζει 0 €»)', () => {
    expect(matchesPriceRange(unpriced(), { role: 'sale', min: 0 })).toBe(false);
  });

  it('Β2 — ανενεργό εύρος ⇒ όλα περνούν, όποια μονάδα κι αν έχει επιλεγεί', () => {
    for (const role of PRICE_ROLES) {
      for (const item of [sale(1), rent(1), nightly(1), unpriced()]) {
        expect(matchesPriceRange(item, { role })).toBe(true);
      }
    }
    expect(matchesPriceRange(rent(1), null)).toBe(true);
    expect(matchesPriceRange(rent(1), undefined)).toBe(true);
  });

  it('Β3 — τα όρια είναι ΚΛΕΙΣΤΑ και ένα `null` είναι ανοιχτό άκρο', () => {
    expect(matchesPriceRange(sale(100), { role: 'sale', min: 100, max: 100 })).toBe(true);
    expect(matchesPriceRange(sale(100), { role: 'sale', min: null, max: 99 })).toBe(false);
    expect(isPriceRangeActive({ role: 'sale', min: null, max: null })).toBe(false);
    expect(isPriceRangeActive({ role: 'sale', min: 0 })).toBe(true);
  });
});

describe('Γ. ΤΟ ΚΕΝΟ ΕΥΡΟΣ', () => {
  it('Γ1 — ο ρόλος του είναι ο ΠΡΩΤΟΣ της δηλωμένης σειράς, και δεν ρωτά τίποτα', () => {
    expect(EMPTY_PRICE_RANGE.role).toBe(PRICE_ROLES[0]);
    expect(isPriceRangeActive(EMPTY_PRICE_RANGE)).toBe(false);
  });
});
