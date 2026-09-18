/**
 * @jest-environment node
 *
 * 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ ΖΩΝΤΑΝΟΥ 500** — `GET /api/demand/interest` (ADR-777 §8.60.14).
 *
 * **Τι έσπασε, μετρημένο στην παραγωγή 2026-09-18**: το §8.60.14 έσπασε τον ενιαίο άξονα
 * `'price'` σε **τρεις** (πώληση · ενοίκιο · διανυκτέρευση). Η **ζήτηση** έμεινε να ζητά το παλιό
 * όνομα ⇒ `NUMERIC_READERS['price']` → `undefined` ⇒ `TypeError` ⇒ **500** (`AGGREGATE_FAILED`)
 * σε κάθε άνοιγμα καρτέλας ακινήτου. Η διαδρομή έπιανε την εξαίρεση και τη γύριζε ως γενικό
 * σφάλμα, οπότε **τίποτα** δεν έδειχνε την αιτία — ούτε η κονσόλα του browser.
 *
 * 🔑 **ΤΑ ΔΕΔΟΜΕΝΑ ΕΙΝΑΙ ΤΑ ΠΡΑΓΜΑΤΙΚΑ** (Firestore, 2026-09-18): το ακίνητο που έσκαγε, το
 * κτίριο και το έργο του, και οι **τρεις** ζωντανές ζητήσεις. Μια σύνθετη περίπτωση θα
 * αποδείκνυε μόνο ότι ο κώδικας τρέχει στα δικά μας δεδομένα — αυτή αποδεικνύει ότι τρέχει σε
 * **εκείνα** που τον έριξαν.
 *
 * ⚠️ Η άγκυρα ασκεί **ολόκληρη** την αλυσίδα της διαδρομής (γεγονότα ακινήτου → σύνορο ανάγνωσης
 * ζητήσεων → αποκάλυψη), γιατί το σφάλμα ζούσε **ανάμεσα** στα κομμάτια: κάθε ένα χωριστά ήταν
 * «σωστό».
 */

/* global describe, it, expect */

import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { companyPropertyFactsOf } from '../place-interest.service';
import { discloseInterest } from '@/lib/demand/demand-interest';
import { propertyDemandFromDocument } from '@/lib/demand/property-demand-from-document';

const PROPERTY = {
  id: 'prop_ef2eaebd-de24-4058-a76e-6f2ec389aff9',
  companyId: 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757',
  name: 'Διαμέρισμα 80 τ.μ.',
  type: 'apartment',
  status: 'for-sale',
  commercialStatus: 'for-sale',
  operationalStatus: 'draft',
  floor: 0,
  area: 80,
  areas: { gross: 80, net: 70, balcony: 10 },
  layout: { bedrooms: 2, bathrooms: 1, wc: 1 },
  orientations: ['southeast'],
  projectId: 'proj_2eb4b755-d5b3-464f-bdee-781ff17f5dfd',
  buildingId: 'bldg_aa80451a-ad27-40fd-b869-fbe5671f6810',
  floorId: 'flr_f29529ba-50fa-4cd0-8496-900490ddcac2',
  commercial: { askingPrice: 165000, finalPrice: null, listedDate: '2026-09-15T10:03:16.789Z' },
  listedAt: { kind: 'known', at: '2026-09-09T09:50:17.552Z' },
} as unknown as Parameters<typeof companyPropertyFactsOf>[1];

const DEMAND_DOCS: readonly Record<string, unknown>[] = [
  {
    id: 'dmnd_55bb71f9-0140-4ba2-b23c-da7d8e7318f6',
    authorUserId: 'WKBWEg3DSfcdSbLNJfzGEW3vkct1', authorCompanyId: null,
    mandate: { kind: 'self' }, seeks: ['sell'], place: { kind: 'anywhere' }, timing: { kind: 'now' },
    features: { types: ['apartment'], priceMax: 180000, priceMin: 160000, areaMin: 75, areaMax: 85, bedroomsMin: null, floorMin: null, floorMax: null },
    proximity: [], lifeContext: null, affirmedAt: '2026-09-15T10:05:35.580Z',
    createdAt: '2026-09-15T10:05:35.580Z', lifecycle: 'active', updatedAt: '2026-09-17T10:48:50.270Z',
  },
  {
    id: 'dmnd_a81c97cd-315a-4c70-9e5c-549e79155119',
    authorUserId: 'WKBWEg3DSfcdSbLNJfzGEW3vkct1', authorCompanyId: null,
    mandate: { kind: 'self' }, seeks: ['sell'], place: { kind: 'anywhere' }, timing: { kind: 'now' },
    features: { types: [], priceMax: null, priceMin: null, areaMin: null, areaMax: null, bedroomsMin: null, floorMin: null, floorMax: null },
    proximity: [], lifeContext: null, lifecycle: 'active',
    createdAt: '2026-08-20T19:16:26.673Z', updatedAt: '2026-08-20T19:16:26.673Z', affirmedAt: '2026-09-05T12:44:44.187Z',
  },
  {
    id: 'dmnd_ce5ff809-1704-4422-9293-7a3a18024794',
    authorUserId: 'D6BkWQNrPRM3DbqVh702nSm3HcL2', authorCompanyId: null,
    mandate: { kind: 'self' }, seeks: ['leaseOut'],
    timing: { kind: 'window', fromDate: '2027-03-12', toDate: '2029-01-01' },
    features: { priceMax: 1300, floorMax: 8, areaMin: 60, bedroomsMin: 3, priceMin: 400, floorMin: 2, areaMax: 120, types: ['apartment'] },
    proximity: [{ maxMetres: 301, kind: 'supermarket' }],
    place: {
      kind: 'frontage', depthMetres: 40, streetName: null, side: 'both',
      axis: [{ lng: 23.730446991431023, lat: 37.99369811201262 }, { lat: 37.99182573170451, lng: 23.729926521335983 }],
    },
    lifeContext: 'workRelocation', lifecycle: 'active',
    createdAt: '2026-09-11T19:07:06.934Z', updatedAt: '2026-09-11T19:07:06.934Z', affirmedAt: '2026-09-11T19:07:06.934Z',
  },
];

describe('Α — ο άξονας τιμής της ζήτησης, με τα ΖΩΝΤΑΝΑ δεδομένα του 500', () => {
  it('🔴 Α1 — η αλυσίδα ΔΕΝ ρίχνει, και κρίνει ΚΑΘΕ ζήτηση (πριν: TypeError ⇒ 500)', async () => {
    const fake = new FakeFirestore();
    fake.seed(COLLECTIONS.BUILDINGS, 'bldg_aa80451a-ad27-40fd-b869-fbe5671f6810', {
      id: 'bldg_aa80451a-ad27-40fd-b869-fbe5671f6810',
      companyId: 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757',
      projectId: 'proj_2eb4b755-d5b3-464f-bdee-781ff17f5dfd',
      name: 'KTIRIO A TEST', status: 'planning', category: 'residential',
    });
    fake.seed(COLLECTIONS.PROJECTS, 'proj_2eb4b755-d5b3-464f-bdee-781ff17f5dfd', {
      id: 'proj_2eb4b755-d5b3-464f-bdee-781ff17f5dfd',
      companyId: 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757',
      name: 'ERGO TEST',
      addresses: [{
        id: 'addr_99d2e2f6-506e-4f6a-96fd-ccfd5cb54ed0', street: 'Σαμοθράκης', number: '16',
        city: 'Ελευθέριο Κορδελιό', postalCode: '56334', country: 'Greece', type: 'site', isPrimary: true,
        coordinates: { lat: 40.66424742653837, lng: 22.897516207515167 },
        source: 'dragged', verifiedAt: 1789068742215,
      }],
    });

    const facts = await companyPropertyFactsOf(
      fake as unknown as AdminFirestore,
      PROPERTY,
      '2026-09-18T09:32:00.000Z',
    );

    const demands = DEMAND_DOCS.flatMap((raw) => {
      const demand = propertyDemandFromDocument(raw, String(raw.id));
      return demand === null ? [] : [demand];
    });
    // Πόσες πέρασαν το σύνορο ανάγνωσης — αν είναι λιγότερες, το λέμε δυνατά.
    expect(demands.length).toBe(DEMAND_DOCS.length);

    const result = discloseInterest(facts, demands, '2026-09-18T09:32:00.000Z', '2026-09-18');
    expect(result.census.considered).toBe(demands.length);
  });
});
