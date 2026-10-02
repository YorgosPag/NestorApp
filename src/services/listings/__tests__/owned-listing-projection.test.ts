/**
 * ADR-898 Φ3β-3 — **η αγγελία όπως θα τη δει ο αγοραστής, για τον θεματοφύλακα** (`readOwnedListingPreview`).
 *
 * Τι αποδεικνύει: (1) τα γεγονότα δημοσίευσης (έτος κατασκευής) δένονται από τον ΙΔΙΟ δέτη με τον γραφέα — η καθαρή
 * προβολή γράφει `null` · (2) γραφείο: μόνο ο ίδιος μισθωτής · χωρίς εταιρεία καμία εταιρική ανάγνωση · (3) ξένο =
 * ανύπαρκτο (`null`) · (4) ο ιδιώτης προηγείται.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const facts = jest.fn();
jest.mock('../listing-publication-facts', () => ({
  resolvePublicationFacts: (...args: unknown[]) => facts(...args),
  withPublicationFacts: jest.requireActual('../listing-publication-facts').withPublicationFacts,
}));
jest.mock('../publish-public-listing', () => ({
  collectPlaceKnowledge: async () => ({ candidates: [], ref: null, buildingConstructionYear: null }),
}));

import { readOwnedListingPreview } from '../owned-listing-projection';

const YEAR = { provenance: 'declared', value: 1988, at: '2026-10-02T00:00:00.000Z' } as const;

const ownerDoc = (authorUserId: string, authorCompanyId: string | null) => ({
  id: 'ownp_1',
  authorUserId,
  authorCompanyId,
  type: 'apartment',
  title: 'Δοκιμαστικό',
  areaSqm: 80,
  bedrooms: 2,
  floor: 1,
  layout: null,
  areas: null,
  offers: null,
  mandate: { kind: 'owner' },
  place: { kind: 'declined' },
});

const companyDoc = { companyId: 'co_1', type: 'apartment', name: 'Δ1', areas: { gross: 90 }, floor: 2 };

/** Δύο συλλογές· καθεμία απαντά με το δικό της έγγραφο. Μετρά τις αναγνώσεις της εταιρικής. */
function fakeDb(owner: Record<string, unknown> | undefined, company: Record<string, unknown> | undefined) {
  const reads: string[] = [];
  const db = {
    collection: (name: string) => ({
      doc: () => ({
        get: async () => {
          reads.push(name);
          return { data: () => (name === 'owner_properties' ? owner : company) };
        },
      }),
    }),
  } as unknown as AdminFirestore;
  return { db, reads };
}

beforeEach(() => {
  facts.mockReset();
  facts.mockResolvedValue({ adminArea: null, constructionYear: YEAR });
});

describe('readOwnedListingPreview', () => {
  it('ιδιώτης: η προβολή + τα γεγονότα δημοσίευσης (το έτος που η καθαρή προβολή αφήνει `null`)', async () => {
    const { db } = fakeDb(ownerDoc('u1', null), undefined);
    const listing = await readOwnedListingPreview(db, 'ownp_1', 'u1', null);
    expect(listing?.id).toBe('ownp_1');
    expect(listing?.constructionYear).toEqual(YEAR);
    expect(facts).toHaveBeenCalledTimes(1);
  });

  it('ξένος ιδιώτης ⇒ `null` (ίδιο με ανύπαρκτο) — και χωρίς εταιρεία, καμία εταιρική ανάγνωση', async () => {
    const { db, reads } = fakeDb(ownerDoc('u1', null), companyDoc);
    expect(await readOwnedListingPreview(db, 'ownp_1', 'stranger', null)).toBeNull();
    expect(reads).toEqual(['owner_properties']);
    expect(facts).not.toHaveBeenCalled();
  });

  it('γραφείο: ίδιος μισθωτής ⇒ προβολή με γεγονότα · άλλος μισθωτής ⇒ `null`', async () => {
    const { db } = fakeDb(undefined, companyDoc);
    const listing = await readOwnedListingPreview(db, 'prop_1', 'u2', 'co_1');
    expect(listing?.id).toBe('prop_1');
    expect(listing?.constructionYear).toEqual(YEAR);
    expect(await readOwnedListingPreview(db, 'prop_1', 'u2', 'co_rival')).toBeNull();
  });
});
