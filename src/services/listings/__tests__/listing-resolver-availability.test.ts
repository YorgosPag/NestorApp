/**
 * ADR-919 βήμα 4 — ο επιλυτής αγγελίας δίνει στη μηχανή ζήτησης τη διαθεσιμότητα **της αγγελίας**,
 * όχι τη σταθερά `unknown`. Από έγγραφο Firestore ως `ListingMatchFacts.availability`, για τις δύο οικογένειες.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { resolveListing } from '../listing-resolver';
import { LISTING_AVAILABILITY_READY, LISTING_AVAILABILITY_UNKNOWN } from '@/types/listing-availability';

const NOW = '2026-10-23T10:00:00.000Z';

/** Απαντά μόνο στο «δώσε μου αυτό το έγγραφο»· ό,τι δεν σπάρθηκε δεν υπάρχει. */
function fakeDb(documents: Readonly<Record<string, Record<string, unknown>>>): AdminFirestore {
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = documents[`${name}/${id}`];
          return { exists: data !== undefined, data: () => data };
        },
      }),
    }),
  };
  return db as unknown as AdminFirestore;
}

const AGENCY_LISTING: Record<string, unknown> = {
  name: 'Διαμέρισμα 80 τ.μ.',
  type: 'apartment',
  companyId: 'comp_alfa',
  createdBy: 'user-employee',
  commercialStatus: 'for-sale',
  areas: { gross: 80 },
  layout: { bedrooms: 2 },
  floor: 2,
  buildingId: 'bld_1',
};

async function availabilityOf(documents: Record<string, Record<string, unknown>>, listingId: string) {
  const outcome = await resolveListing(fakeDb(documents), listingId, NOW);
  if (outcome === null || outcome === 'absent' || outcome.facts === null) throw new Error('not live');
  return outcome.facts.availability;
}

const agency = (building: Record<string, unknown> | null) => ({
  [`${COLLECTIONS.PROPERTIES}/prop_1`]: AGENCY_LISTING,
  ...(building === null ? {} : { [`${COLLECTIONS.BUILDINGS}/bld_1`]: building }),
});

describe('ADR-919 βήμα 4 — ο επιλυτής αγγελίας διαβάζει τη διαθεσιμότητα της αγγελίας', () => {
  it('κτίριο αποπερατωμένο ⇒ ready', async () => {
    expect(await availabilityOf(agency({ status: 'completed' }), 'prop_1')).toEqual(LISTING_AVAILABILITY_READY);
  });

  it('δηλωμένη παράδοση κτιρίου ⇒ scheduled με το διάστημα της ακρίβειας', async () => {
    const building = {
      status: 'construction',
      completionDeclaration: { provenance: 'declared', value: { precision: 'quarter', anchor: '2027-08-15' }, at: NOW },
    };
    expect(await availabilityOf(agency(building), 'prop_1')).toEqual({
      kind: 'scheduled',
      precision: 'quarter',
      window: { start: '2027-07-01', end: '2027-09-30' },
    });
  });

  it('κτίριο υπό κατασκευή χωρίς δήλωση ⇒ unknown (η τίμια σιωπή)', async () => {
    expect(await availabilityOf(agency({ status: 'construction' }), 'prop_1')).toEqual(LISTING_AVAILABILITY_UNKNOWN);
  });

  it('ιδιώτης (υπάρχον απόθεμα) ⇒ ready', async () => {
    const documents = {
      [`${COLLECTIONS.OWNER_PROPERTIES}/ownp_1`]: validOwnerProperty({ id: 'ownp_1' }) as unknown as Record<string, unknown>,
    };
    expect(await availabilityOf(documents, 'ownp_1')).toEqual(LISTING_AVAILABILITY_READY);
  });
});
