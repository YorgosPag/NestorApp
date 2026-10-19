/**
 * ADR-244 — αγοραστές αποθηκευμένου ακινήτου: τι διαβάζουν οι καρτέλες «Πελάτες» έργου/κτιρίου.
 * Περιστατικό 2026-10-19: πώληση γραμμένη ΜΟΝΟ σε `commercial.owners` (χωρίς `soldTo`) ⇒ κενή καρτέλα.
 */

import {
  countSoldPropertiesPerBuyer,
  isStoredPropertySold,
  readStoredBuyerContactIds,
} from '@/lib/ownership/owner-utils';

const soldWithOwners = (owners: unknown[]) => ({
  commercialStatus: 'sold',
  status: 'sold',
  commercial: { owners },
});

describe('isStoredPropertySold', () => {
  it('κανονικό commercialStatus ή παλιό status', () => {
    expect(isStoredPropertySold({ commercialStatus: 'sold' })).toBe(true);
    expect(isStoredPropertySold({ status: 'sold' })).toBe(true);
    expect(isStoredPropertySold({ commercialStatus: 'reserved', status: 'reserved' })).toBe(false);
  });
});

describe('readStoredBuyerContactIds', () => {
  it('διαβάζει commercial.owners χωρίς soldTo (το περιστατικό)', () => {
    expect(readStoredBuyerContactIds(soldWithOwners([
      { role: 'buyer', contactId: 'cont_a', ownershipPct: 100 },
    ]))).toEqual(['cont_a']);
  });

  it('συναγοραστές μετρούν, οικοπεδούχοι όχι, διπλότυπα ενώνονται', () => {
    expect(readStoredBuyerContactIds(soldWithOwners([
      { role: 'buyer', contactId: 'cont_a', ownershipPct: 50 },
      { role: 'co_buyer', contactId: 'cont_b', ownershipPct: 50 },
      { role: 'landowner', contactId: 'cont_l', ownershipPct: 0 },
      { role: 'co_buyer', contactId: 'cont_a', ownershipPct: 0 },
    ]))).toEqual(['cont_a', 'cont_b']);
  });

  it('soldTo μόνο όταν ΔΕΝ υπάρχουν αποθηκευμένοι ιδιοκτήτες', () => {
    expect(readStoredBuyerContactIds({ status: 'sold', soldTo: 'cont_legacy' })).toEqual(['cont_legacy']);
    expect(readStoredBuyerContactIds({
      ...soldWithOwners([{ role: 'buyer', contactId: 'cont_new' }]),
      soldTo: 'cont_stale',
    })).toEqual(['cont_new']);
  });

  it('μόνο οικοπεδούχοι ⇒ κανένας αγοραστής (όχι πτώση στο soldTo)', () => {
    expect(readStoredBuyerContactIds({
      ...soldWithOwners([{ role: 'landowner', contactId: 'cont_l' }]),
      soldTo: 'cont_stale',
    })).toEqual([]);
  });
});

describe('countSoldPropertiesPerBuyer', () => {
  it('μετρά πουλημένα με αγοραστή και ακίνητα ανά αγοραστή', () => {
    expect(countSoldPropertiesPerBuyer([
      soldWithOwners([{ role: 'buyer', contactId: 'cont_a' }]),
      soldWithOwners([{ role: 'buyer', contactId: 'cont_a' }, { role: 'co_buyer', contactId: 'cont_b' }]),
      { status: 'sold', soldTo: 'cont_c' },
      { commercialStatus: 'reserved', commercial: { owners: [{ role: 'buyer', contactId: 'cont_r' }] } },
      { commercialStatus: 'sold' },
    ])).toEqual({
      soldPropertiesCount: 3,
      propertiesPerBuyer: { cont_a: 2, cont_b: 1, cont_c: 1 },
    });
  });
});
