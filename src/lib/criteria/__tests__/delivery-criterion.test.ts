/**
 * ADR-919 §12 — ο άξονας «παράδοση» της αναζήτησης: «χτίζονται» (`after`) και «διαθέσιμο ως» (`by`).
 *
 * Η άγκυρα που μετρά: το «χτίζονται N» της σελίδας περιοχής και το φίλτρο αναζήτησης διαλέγουν το ΙΔΙΟ σύνολο, γιατί
 * ρωτούν το ΙΔΙΟ `futureDeliveryPromiseOf` με την ΙΔΙΑ ημέρα (`uc` = ημέρα του στιγμιότυπου).
 */

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import { scheduledAvailability } from '@/lib/listings/availability-window';
import { applyListingFilters, EMPTY_LISTING_FILTERS } from '@/lib/listings/listing-filters';
import { summarizeUnderConstruction } from '@/lib/market/area-market-summary';
import { LISTING_AVAILABILITY_READY, LISTING_AVAILABILITY_UNKNOWN } from '@/types/listing-availability';
import type { ListingAvailability } from '@/types/listing-availability';

import { EMPTY_LISTING_CRITERIA, withDateBound, type ListingCriteria } from '../listing-criteria';
import { judgeCriterion } from '../listing-criteria-judge';
import { dateBoundParams, parseListingCriteria, writeListingCriteria } from '../listing-criteria-url';

const DAY = '2026-10-24';
const Q4_2027 = scheduledAvailability('quarter', '2027-10-01');
const DEC_2026 = scheduledAvailability('month', '2026-12-01');
const EXPIRED = scheduledAvailability('month', '2025-03-01');

const withAvailability = (id: string, availability: ListingAvailability) => listing({ id, availability });

const POOL = [
  withAvailability('q4-2027', Q4_2027),
  withAvailability('dec-2026', DEC_2026),
  withAvailability('expired', EXPIRED),
  withAvailability('ready', LISTING_AVAILABILITY_READY),
  withAvailability('unknown', LISTING_AVAILABILITY_UNKNOWN),
];

const deliveryCriteria = (after: string | null, by: string | null): ListingCriteria =>
  withDateBound(EMPTY_LISTING_CRITERIA, 'delivery', { after, by });

const outcomeOf = (id: string, criteria: ListingCriteria) =>
  judgeCriterion(POOL.find((item) => item.id === id) ?? POOL[0], criteria, 'delivery');

describe('Α — ο σύνδεσμος της περιοχής δείχνει ΑΚΡΙΒΩΣ όσα μέτρησε η σύνοψη', () => {
  it('Α1 — ίδιο σύνολο από `summarizeUnderConstruction` και `applyListingFilters` με `after` = ημέρα στιγμιότυπου', () => {
    const counted = summarizeUnderConstruction(POOL, DAY);
    const shown = applyListingFilters(POOL, { ...EMPTY_LISTING_FILTERS, criteria: deliveryCriteria(DAY, null) });
    // Το `unknown` μένει ορατό στον κάδο «δεν το δήλωσαν»: μετριέται χωριστά, δεν υπόσχεται «χτίζεται».
    const building = shown.filter((item) => outcomeOf(item.id, deliveryCriteria(DAY, null)) === 'satisfied');
    expect(building.map((item) => item.id).sort()).toEqual(['dec-2026', 'q4-2027']);
    expect(building).toHaveLength(counted?.count ?? 0);
  });
});

describe('Β — οι κάδοι του άξονα', () => {
  it('Β1 — «χτίζονται»: μελλοντική υπόσχεση ⇒ ναι · ληγμένη / έτοιμο ⇒ όχι · άγνωστο ⇒ δεν το δήλωσαν', () => {
    const building = deliveryCriteria(DAY, null);
    expect(outcomeOf('q4-2027', building)).toBe('satisfied');
    expect(outcomeOf('expired', building)).toBe('excluded');
    expect(outcomeOf('ready', building)).toBe('excluded');
    expect(outcomeOf('unknown', building)).toBe('undeclared');
  });

  it('Β2 — «διαθέσιμο ως 31/3/2027»: έτοιμο και Δεκ. 2026 ναι · Δ΄ τρίμ. 2027 όχι', () => {
    const by = deliveryCriteria(null, '2027-03-31');
    expect(outcomeOf('ready', by)).toBe('satisfied');
    expect(outcomeOf('dec-2026', by)).toBe('satisfied');
    expect(outcomeOf('q4-2027', by)).toBe('excluded');
    expect(outcomeOf('unknown', by)).toBe('undeclared');
  });

  it('Β3 — και τα δύο μαζί: «χτίζονται ΚΑΙ παραδίδονται ως 31/3/2027»', () => {
    const both = deliveryCriteria(DAY, '2027-03-31');
    expect(outcomeOf('dec-2026', both)).toBe('satisfied');
    expect(outcomeOf('ready', both)).toBe('excluded');
    expect(outcomeOf('q4-2027', both)).toBe('excluded');
  });
});

describe('Γ — η διεύθυνση', () => {
  it('Γ1 — γράφεται και διαβάζεται αυτούσιο, ένα άκρο ή και τα δύο', () => {
    for (const criteria of [deliveryCriteria(DAY, null), deliveryCriteria(null, '2027-03-31'), deliveryCriteria(DAY, '2027-03-31')]) {
      const params = new URLSearchParams();
      writeListingCriteria(criteria, params);
      expect(parseListingCriteria(params)).toEqual(criteria);
    }
  });

  it('Γ2 — χωρίς ημέρες ο άξονας φεύγει· ημέρα με λάθος μορφή αγνοείται, δεν γίνεται εικασία', () => {
    expect(deliveryCriteria(null, null)).toEqual(EMPTY_LISTING_CRITERIA);
    const { after, by } = dateBoundParams('delivery');
    const params = new URLSearchParams({ [after]: '24/10/2026', [by]: '2027-03-31T00:00:00Z' });
    expect(parseListingCriteria(params)).toEqual(EMPTY_LISTING_CRITERIA);
  });
});
