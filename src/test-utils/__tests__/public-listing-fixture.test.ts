/**
 * Άγκυρα του **ενός** fixture δημόσιας αγγελίας (`test-utils/public-listing-fixture.ts`).
 *
 * 🔴 Ρωτά τον **γραφέα** (όχι λίστα πεδίων): ό,τι γράφει σήμερα το `projectListingShape`, το έχει και το fixture.
 * Αν αύριο μπει υποχρεωτικό πεδίο **με** κρίκο, το fixture το παίρνει μόνο του· **χωρίς** κρίκο, κοκκινίζει εδώ
 * **και** στην Κ7 του `public-listing-schema.test.ts` — ποτέ σιωπηλά σε δεκάδες σουίτες οθονών.
 */

import { publicListingFixture } from '../public-listing-fixture';
import {
  projectListingShape,
  type PlaceKnowledge,
  type ProjectableProperty,
} from '@/services/listings/public-listing-projection';
import { scheduledAvailability } from '@/lib/listings/availability-window';

const WRITER_SAMPLE: ProjectableProperty = {
  id: 'ownp_fixture',
  name: 'Δείγμα γραφέα',
  type: 'apartment',
  commercialStatus: 'for-sale',
  offerKinds: ['sell'],
  areas: { gross: 90 },
  commercial: { askingPrice: 200000 },
};
const NO_PLACE: PlaceKnowledge = { candidates: [], ref: null };

describe('publicListingFixture — το σχήμα του γραφέα, από το σύνορο ανάγνωσης', () => {
  it('🔴 έχει ΚΑΘΕ πεδίο πρώτου επιπέδου που γράφει σήμερα ο γραφέας (κανένα `undefined`)', () => {
    const written = projectListingShape(WRITER_SAMPLE, NO_PLACE, '2026-09-01T10:00:00.000Z');
    const fixture: Readonly<Record<string, unknown>> = publicListingFixture('prop_a');

    const missing = Object.keys(written).filter((key) => fixture[key] === undefined);
    expect(missing).toEqual([]);
  });

  it('🔑 το περιστατικό της 2026-10-26: το `availability` υπάρχει χωρίς να το ζητήσει κανείς', () => {
    expect(publicListingFixture('prop_a').availability).toEqual({ kind: 'unknown' });
  });

  it('🔑 οι ΕΓΚΥΡΕΣ τιμές του καλούντος μένουν αυτούσιες, και η ταυτότητα έρχεται από το όρισμα', () => {
    const availability = scheduledAvailability('quarter', '2027-08-15');
    const listing = publicListingFixture('prop_b', { availability, offerKinds: ['leaseOut'], areaSqm: 70 });

    expect(listing.id).toBe('prop_b');
    expect(listing.availability).toEqual(availability);
    expect(listing.offerKinds).toEqual(['leaseOut']);
    expect(listing.areaSqm).toBe(70);
  });
});
