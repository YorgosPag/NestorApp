/**
 * ⚓ «Εκτός αγοράς» — τι γράφεται όταν ένα ακίνητο παύει να διατίθεται (ADR-281 · ADR-777 Α20)
 *
 * Δύο σχήματα εγγράφου, μία απάντηση. Η άγκυρα καρφώνει ότι:
 *   - μόνο οι ΕΝΕΡΓΕΣ διαθέσεις αποσύρονται — κράτηση και κλείσιμο έχουν αντισυμβαλλόμενο·
 *   - τα παραγόμενα πεδία βγαίνουν από τον ΕΝΑ παραγωγό, δεν γράφονται με το χέρι·
 *   - ό,τι είναι ήδη εκτός αγοράς δεν παράγει γραφή.
 *
 * @module lib/offers/__tests__/take-off-market
 */

import { takeOffMarket } from '../take-off-market';
import { deriveCommercialStatus, deriveOfferKinds } from '../derive-commercial-status';
import type { PropertyOffer } from '@/types/property-offers';

const AT = 'NOW_TS';

const sell = (lifecycle: PropertyOffer['lifecycle'], id = 'offr_sell'): PropertyOffer => ({
  id,
  kind: 'sell',
  lifecycle,
  askingPrice: 200000,
});

const lease = (lifecycle: PropertyOffer['lifecycle']): PropertyOffer => ({
  id: 'offr_lease',
  kind: 'leaseOut',
  lifecycle,
  rentPrice: 900,
});

describe('έγγραφο με διαθέσεις (Α20)', () => {
  it('🔴 οι ενεργές γίνονται `withdrawn`, με τη στιγμή της απόσυρσης', () => {
    const patch = takeOffMarket({ offers: [sell('active'), lease('active')], commercialStatus: 'for-sale-and-rent' }, null, AT);

    expect(patch?.fields.offers).toEqual([
      { ...sell('withdrawn'), closedDate: AT },
      { ...lease('withdrawn'), closedDate: AT },
    ]);
  });

  it('🔴 τα παραγόμενα πεδία βγαίνουν από τον ΕΝΑ παραγωγό', () => {
    const offers = [sell('active'), lease('active')];
    const patch = takeOffMarket({ offers, commercialStatus: 'for-sale-and-rent' }, null, AT);
    const withdrawn = offers.map((offer): PropertyOffer => ({ ...offer, lifecycle: 'withdrawn' }));

    expect(patch?.fields.commercialStatus).toBe(deriveCommercialStatus(withdrawn));
    expect(patch?.fields.offerKinds).toEqual(deriveOfferKinds(withdrawn));
    expect(patch?.fields.offerKinds).toEqual([]);
    expect([patch?.commercialStatusBefore, patch?.commercialStatusAfter]).toEqual([
      'for-sale-and-rent',
      deriveCommercialStatus(withdrawn),
    ]);
  });

  it('🔴 η κράτηση ΔΕΝ αγγίζεται — υπάρχει αντισυμβαλλόμενος', () => {
    const reserved = sell('reserved');
    const patch = takeOffMarket({ offers: [reserved, lease('active')] }, null, AT);

    expect(patch?.fields.offers).toEqual([reserved, { ...lease('withdrawn'), closedDate: AT }]);
  });

  it('το ιστορικό δεν ξαναγράφεται: ήδη αποσυρμένη διάθεση κρατά τη δική της στιγμή', () => {
    const old = { ...sell('withdrawn', 'offr_old'), closedDate: null };
    const patch = takeOffMarket({ offers: [old, lease('active')] }, null, AT);

    expect((patch?.fields.offers as PropertyOffer[])[0]).toBe(old);
  });

  it('καμία ενεργή διάθεση ⇒ καμία γραφή', () => {
    expect(takeOffMarket({ offers: [sell('closed')], commercialStatus: 'sold' }, null, AT)).toBeNull();
    expect(takeOffMarket({ offers: [] }, null, AT)).toBeNull();
  });

  it('δεν μεταλλάσσει την είσοδο', () => {
    const offers = [sell('active')];
    takeOffMarket({ offers }, null, AT);

    expect(offers[0].lifecycle).toBe('active');
  });
});

describe('παλιό έγγραφο (χωρίς διαθέσεις)', () => {
  it.each(['for-sale', 'for-rent', 'for-sale-and-rent'])('%s ⇒ `unavailable`', (commercialStatus) => {
    expect(takeOffMarket({ commercialStatus }, null, AT)).toEqual({
      fields: { commercialStatus: 'unavailable' },
      commercialStatusBefore: commercialStatus,
      commercialStatusAfter: 'unavailable',
    });
  });

  it('🔴 χωρίς `commercialStatus`, κρίνεται το παλιό `status` — ίδια εφεδρεία με τον κριτή', () => {
    expect(takeOffMarket({}, 'for-sale', AT)).toMatchObject({
      fields: { commercialStatus: 'unavailable' },
      commercialStatusBefore: 'for-sale',
    });
  });

  it('το `commercialStatus` κερδίζει την εφεδρεία', () => {
    expect(takeOffMarket({ commercialStatus: 'unavailable' }, 'for-sale', AT)).toBeNull();
  });

  it.each(['unavailable', 'reserved', 'sold', 'rented'])('%s ⇒ καμία γραφή', (commercialStatus) => {
    expect(takeOffMarket({ commercialStatus }, null, AT)).toBeNull();
  });

  it('δηλωμένο `offerKinds` χωρίς διαθέσεις ⇒ αδειάζει κι αυτό (το δεύτερο σκέλος του κριτή)', () => {
    expect(takeOffMarket({ commercialStatus: 'unavailable', offerKinds: ['exchange'] }, null, AT)?.fields).toEqual({
      commercialStatus: 'unavailable',
      offerKinds: [],
    });
  });
});
