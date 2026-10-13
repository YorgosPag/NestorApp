/**
 * ADR-890 Φ0 — ο γραφέας λύνει και ΔΕΝΕΙ τα γεγονότα της δημοσίευσης (περιοχή, έτος κατασκευής).
 *
 * 🔑 Τα όρια είναι τα **πραγματικά** αρχεία του ADR-883· μοκάρεται μόνο το Firestore (δημόσιο κτίριο).
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { buildPublicListing } from '../public-listing-projection';
import { resolvePublicationFacts, withPublicationFacts } from '../listing-publication-facts';
import type { PlaceKnowledge, ProjectableProperty } from '../public-listing-projection-types';
import type { ListingPositionCandidate } from '../public-listing-projection-types';

/**
 * ADR-777 §8.88 — ο κριτής της περιήγησης έχει δικές του άγκυρες (`tour-settings.test.ts`)· εδώ κρίνεται μόνο ότι ο
 * γραφέας τον **ρωτά** και **δένει** την απάντησή του. Προεπιλογή «καμία», ώστε οι παλιές ομάδες να μένουν αμετάβλητες.
 */
const readTourPresence = jest.fn(async (..._args: unknown[]): Promise<unknown> => null);
jest.mock('@/server/spatial-tour/tour-presence', () => ({
  readTourPresence: (...args: unknown[]) => readTourPresence(...args),
}));

jest.setTimeout(30_000);

const AT = '2026-09-26T10:00:00.000Z';
const EVOSMOS = { lat: 40.6643, lng: 22.8976 };

const PROPERTY: ProjectableProperty = { id: 'prop_a0000001', type: 'apartment', commercialStatus: 'for-sale' };

/** Firestore με ένα δημόσιο κτίριο — ή κανένα. */
function db(building: Record<string, unknown> | null): AdminFirestore {
  const doc = { get: async () => ({ exists: building !== null, data: () => building ?? undefined }) };
  return { collection: () => ({ doc: () => doc }) } as unknown as AdminFirestore;
}

function candidate(over: Partial<ListingPositionCandidate> = {}): ListingPositionCandidate {
  return { kind: 'known', provenance: 'manual', point: EVOSMOS, locatedAt: AT, ...over } as ListingPositionCandidate;
}

function listingFor(place: PlaceKnowledge) {
  const listing = buildPublicListing(PROPERTY, place, AT);
  if (listing === null) throw new Error('η αγγελία δεν προβλήθηκε');
  return listing;
}

describe('περιοχή — από τη ΛΥΜΕΝΗ θέση, ποτέ πιο ακριβής από αυτήν', () => {
  it('πινέζα ανθρώπου ⇒ ως την κοινότητα', async () => {
    const place: PlaceKnowledge = { candidates: [candidate()], ref: null };
    const facts = await resolvePublicationFacts(db(null), listingFor(place), place);
    expect(facts.adminArea?.municipalityId).toBe('municipality:0708');
    expect(facts.adminArea?.communityId).toMatch(/^community:0708/);
  });

  it('geocoder «κέντρο» ⇒ σταματά στον δήμο (αλλιώς τυχαία κοινότητα)', async () => {
    const place: PlaceKnowledge = {
      candidates: [candidate({ provenance: 'geocoded', accuracy: 'center' } as Partial<ListingPositionCandidate>)],
      ref: null,
    };
    const facts = await resolvePublicationFacts(db(null), listingFor(place), place);
    expect(facts.adminArea?.municipalityId).toBe('municipality:0708');
    expect(facts.adminArea?.municipalUnitId).toBeNull();
    expect(facts.adminArea?.communityId).toBeNull();
  });

  it('άγνωστη θέση ⇒ καμία περιοχή', async () => {
    const place: PlaceKnowledge = { candidates: [], ref: null };
    const facts = await resolvePublicationFacts(db(null), listingFor(place), place);
    expect(facts.adminArea).toBeNull();
  });
});

describe('έτος κατασκευής — δήλωση κτιρίου, αλλιώς δημόσια εγγραφή', () => {
  const OSM_BUILDING = { constructionYear: { value: 1965, source: 'osm', attestedAt: AT } };
  const ref = { landId: 'land_0000001', buildingId: 'pbld_24b3a8d7-2e56-40e6-8053-9c1628b425bf' };

  it('δήλωση στο κτίριο του επαγγελματία ⇒ `declared`', async () => {
    const place: PlaceKnowledge = { candidates: [], ref, buildingConstructionYear: 1978 };
    const facts = await resolvePublicationFacts(db(OSM_BUILDING), listingFor(place), place);
    expect(facts.constructionYear).toMatchObject({ provenance: 'declared', value: 1978 });
  });

  it('χωρίς δήλωση (π.χ. ιδιώτης) ⇒ η δημόσια εγγραφή του δεσμού, με το μητρώο της', async () => {
    const place: PlaceKnowledge = { candidates: [], ref };
    const facts = await resolvePublicationFacts(db(OSM_BUILDING), listingFor(place), place);
    expect(facts.constructionYear).toMatchObject({ provenance: 'public-record', value: 1965, registry: 'osm' });
  });

  it('δεσμός σε ΓΗ, όχι κτίριο ⇒ καμία ανάγνωση, καμία τιμή', async () => {
    const place: PlaceKnowledge = { candidates: [], ref: { landId: 'land_0000001', buildingId: null } };
    const facts = await resolvePublicationFacts(db(OSM_BUILDING), listingFor(place), place);
    expect(facts.constructionYear).toBeNull();
  });

  it('⚠️ το δημόσιο κτίριο δεν απαντά ⇒ η δημοσίευση ΣΥΝΕΧΙΖΕΙ με ό,τι ξέρουμε', async () => {
    const broken = { collection: () => ({ doc: () => ({ get: async () => { throw new Error('unavailable'); } }) }) };
    const place: PlaceKnowledge = { candidates: [], ref, buildingConstructionYear: 1978 };
    const facts = await resolvePublicationFacts(broken as unknown as AdminFirestore, listingFor(place), place);
    expect(facts.constructionYear).toMatchObject({ provenance: 'declared', value: 1978 });
  });
});

describe('περιήγηση 360° — η απάντηση του ΕΝΟΣ κριτή, κομμένη στο δημόσιο μισό της (ADR-777 §8.88)', () => {
  const place: PlaceKnowledge = { candidates: [candidate()], ref: null };

  afterEach(() => readTourPresence.mockResolvedValue(null));

  it('ο κριτής ρωτιέται με την ταυτότητα ΤΗΣ ΑΓΓΕΛΙΑΣ', async () => {
    const database = db(null);
    await resolvePublicationFacts(database, listingFor(place), place);
    expect(readTourPresence).toHaveBeenCalledWith(database, PROPERTY.id);
  });

  it('καμία περιήγηση που φαίνεται ⇒ `null`', async () => {
    const facts = await resolvePublicationFacts(db(null), listingFor(place), place);
    expect(facts.tour).toBeNull();
  });

  it.each(['public', 'on-request'] as const)('`%s` ⇒ φεύγει ΜΟΝΟ η ορατότητα — ποτέ η ρίζα', async (visibility) => {
    readTourPresence.mockResolvedValue({ subject: { kind: 'company-property', id: PROPERTY.id }, visibility });
    const facts = await resolvePublicationFacts(db(null), listingFor(place), place);
    expect(facts.tour).toEqual({ visibility });
  });

  it('🔴 ο κριτής πέταξε ⇒ `null` και η δημοσίευση ΔΕΝ ακυρώνεται', async () => {
    readTourPresence.mockRejectedValue(new Error('firestore unavailable'));
    const facts = await resolvePublicationFacts(db(null), listingFor(place), place);
    expect(facts.tour).toBeNull();
    expect(facts.adminArea?.municipalityId).toBe('municipality:0708');
  });

  it('το δέσιμο γράφει την περιήγηση στην αγγελία', async () => {
    readTourPresence.mockResolvedValue({ subject: { kind: 'company-property', id: PROPERTY.id }, visibility: 'public' });
    const listing = listingFor(place);
    expect(listing.tour).toBeNull(); // η καθαρή προβολή γράφει κενό — το δένει ΜΟΝΟ ο γραφέας
    const bound = withPublicationFacts(listing, await resolvePublicationFacts(db(null), listing, place));
    expect(bound.tour).toEqual({ visibility: 'public' });
  });
});

describe('δέσιμο — καθαρό και ιδιοδύναμο', () => {
  it('γράφει ΜΟΝΟ τα δύο πεδία, και δύο φορές δίνει το ίδιο', async () => {
    const place: PlaceKnowledge = { candidates: [candidate()], ref: null, buildingConstructionYear: 1978 };
    const listing = listingFor(place);
    const facts = await resolvePublicationFacts(db(null), listing, place);
    const once = withPublicationFacts(listing, facts);
    expect(withPublicationFacts(once, facts)).toEqual(once);
    expect({ ...once, adminArea: null, constructionYear: null }).toEqual(listing);
  });
});
