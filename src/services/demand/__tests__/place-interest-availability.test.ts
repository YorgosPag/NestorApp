/**
 * ADR-919 βήμα 4 — το πάνελ «ποιοι ζητούν» του κατόχου κρίνει με τη διαθεσιμότητα **της προβολής**, όχι με
 * σταθερό `unknown`· ο κάτοχος βλέπει την ίδια τιμή που θα έβλεπε ο αγοραστής αν δημοσίευε.
 */

import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { ownerPropertyProjectionOf } from '@/services/listings/owned-listing-projection';
import { factsOfProjection } from '../place-interest.service';
import { LISTING_AVAILABILITY_READY } from '@/types/listing-availability';

const NOW = '2026-10-23T10:00:00.000Z';

describe('ADR-919 βήμα 4 — factsOfProjection', () => {
  it('ιδιώτης (υπάρχον απόθεμα) ⇒ ready, ίδιο με το πεδίο της προβολής', () => {
    const facts = factsOfProjection(ownerPropertyProjectionOf(validOwnerProperty({ id: 'ownp_1' }), NOW));
    expect(facts.availability).toEqual(LISTING_AVAILABILITY_READY);
    expect(facts.availability).toBe(facts.listing.availability);
  });
});
