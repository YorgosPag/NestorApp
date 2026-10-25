/**
 * ΑΓΚΥΡΕΣ — **ΕΝΑΣ ΚΡΙΤΗΣ «ΑΝΗΚΕΙ ΣΤΗΝ ΠΕΡΙΟΧΗ»** για τη σελίδα `/area/[id]` και την αναζήτηση `?area=` (ADR-890 §9.1).
 *
 * 🔴 **Η ΚΕΝΤΡΙΚΗ ΑΓΚΥΡΑ ΕΙΝΑΙ ΤΟ Π2 («ίδιο σύνολο»)**: για κάθε περιοχή σελίδας, όσα δείχνει η αναζήτηση είναι **ακριβώς**
 * όσα μετρά η σελίδα (`groupListingsByArea`, η ίδια ερώτηση με το `where('adminArea.<πεδίο>', '==', id)` του server).
 * Η **μόνη** διαφορά είναι ονομασμένη: αγγελίες **χωρίς καμία** απόδοση (`unassigned`), που τις κρίνει η γεωμετρία ως δίχτυ
 * ασφαλείας. Απόδοση που σταματά πριν από τη βαθμίδα = «εκτός», όπως η ετικέτα περιοχής των ImmoScout24 / Zillow / idealista.
 */

import { listingAreaVerdict, computeAreaLedger, areaLedgerBalances, areaLedgerMatchesVisible } from '@/lib/listings/listing-search-area';
import { applyListingFilters, EMPTY_LISTING_FILTERS } from '@/lib/listings/listing-filters';
import { groupListingsByArea } from '@/lib/market/area-market-summary';
import type { AdminAreaAssignment } from '@/lib/geo/admin-area-of-point';
import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import type { GeoBoundingBox, GeoPoint, GeoRegion } from '@/types/geo/coordinates';
import type { ListingPosition, PublicListing } from '@/types/public-listing';

const AT = '2026-10-24T00:00:00.000Z';
const INSIDE: GeoPoint = { lat: 37.9838, lng: 23.7275 };
const FAR: GeoPoint = { lat: 40.64, lng: 22.94 };
const BOX: GeoBoundingBox = { south: 37.974, west: 23.7155, north: 37.994, east: 23.7395 };

/** Ένα τετράγωνο για κάθε βαθμίδα — η γεωμετρία μετρά μόνο στην εφεδρεία, άρα αρκεί ένα σχήμα. */
function region(adminId: string, level: number): GeoRegion {
  const { south, west, north, east } = BOX;
  return {
    adminId,
    level,
    rings: [[{ lat: south, lng: west }, { lat: south, lng: east }, { lat: north, lng: east }, { lat: north, lng: west }]],
    bbox: BOX,
    toleranceM: 25,
  };
}

const REGION = region('region:112', 3);
const REGIONAL_UNIT = region('regional_unit:07', 4);
const MUNICIPALITY = region('municipality:0701', 5);
const MUNICIPAL_UNIT = region('municipal_unit:070101', 6);
const PAGE_REGIONS = [REGION, REGIONAL_UNIT, MUNICIPALITY, MUNICIPAL_UNIT];

function exact(point = INSIDE): ListingPosition {
  return { kind: 'known', provenance: 'manual', point, locatedAt: AT };
}

function cityOnly(point = INSIDE): ListingPosition {
  return { kind: 'known', provenance: 'geocoded', point, locatedAt: AT, accuracy: 'center' };
}

const NO_POSITION: ListingPosition = { kind: 'unknown', reason: 'never-asked' };

function assigned(overrides: Partial<AdminAreaAssignment>): AdminAreaAssignment {
  return {
    regionId: 'region:112',
    regionalUnitId: 'regional_unit:07',
    municipalityId: 'municipality:0701',
    municipalUnitId: 'municipal_unit:070101',
    communityId: null,
    nearBoundary: false,
    measuredDepth: 6,
    ...overrides,
  };
}

/** Το μη τετριμμένο σύνολο: κάθε γραμμή του κανόνα, και οι δύο μορφές «σιωπής». */
const SAMPLE: readonly PublicListing[] = [
  listing({ id: 'here', position: exact(), adminArea: assigned({}) }),
  listing({ id: 'sibling-unit', position: exact(), adminArea: assigned({ municipalUnitId: 'municipal_unit:070102' }) }),
  // Το απλοποιημένο πολύγωνο τη λέει «μέσα»· η απόδοση τη βάζει σε άλλο δήμο ⇒ η απόδοση νικά.
  listing({
    id: 'other-municipality',
    position: exact(),
    adminArea: assigned({ municipalityId: 'municipality:0708', municipalUnitId: 'municipal_unit:070801' }),
  }),
  listing({ id: 'near-boundary', position: exact(), adminArea: assigned({ nearBoundary: true }) }),
  // Θέση σε επίπεδο πόλης ⇒ απόδοση ως τον δήμο, σιωπή στη Δ.Ε.
  listing({ id: 'city-only', position: cityOnly(), adminArea: assigned({ municipalUnitId: null, measuredDepth: 5 }) }),
  listing({
    id: 'elsewhere',
    position: exact(FAR),
    adminArea: assigned({
      regionId: 'region:99',
      regionalUnitId: 'regional_unit:45',
      municipalityId: 'municipality:4501',
      municipalUnitId: null,
      measuredDepth: 5,
    }),
  }),
  listing({ id: 'unattributed', position: exact(), adminArea: null }),
  listing({ id: 'nowhere', position: NO_POSITION, adminArea: null }),
];

const ids = (items: readonly PublicListing[]) => items.map((item) => item.id).sort();
const visibleIn = (area: GeoRegion) => applyListingFilters(SAMPLE, { ...EMPTY_LISTING_FILTERS, near: area });

/** Καμία απόδοση — το μόνο που κρίνει η γεωμετρία σε διοικητική περιοχή σελίδας. */
const unassignedListing = (item: PublicListing) => item.adminArea === null;

describe('Π1 — ο κανόνας: η απόδοση κρίνει· η γεωμετρία μόνο χωρίς καμία απόδοση', () => {
  const verdict = (id: string, area: GeoRegion) => listingAreaVerdict(SAMPLE.find((item) => item.id === id)!, area);

  it('ταίριασμα ⇒ inside', () => {
    expect(verdict('here', MUNICIPAL_UNIT)).toBe('inside');
    expect(verdict('here', REGION)).toBe('inside');
  });

  it('ταίριασμα κοντά στο σύνορο ⇒ maybe (ορατή, όπως στη σελίδα, με την αβεβαιότητα ονομασμένη)', () => {
    expect(verdict('near-boundary', MUNICIPALITY)).toBe('maybe');
  });

  it('🔴 άλλη ταυτότητα ⇒ outside, ΑΚΟΜΗ κι αν το πολύγωνο λέει «μέσα»', () => {
    expect(verdict('other-municipality', MUNICIPALITY)).toBe('outside');
    expect(verdict('sibling-unit', MUNICIPAL_UNIT)).toBe('outside');
  });

  it('η ίδια αγγελία ΑΝΗΚΕΙ στον πρόγονο: ο δήμος του αδελφού είναι ο δικός της', () => {
    expect(verdict('sibling-unit', MUNICIPALITY)).toBe('inside');
    expect(verdict('other-municipality', REGIONAL_UNIT)).toBe('inside');
  });

  it('🔴 απόδοση που σταματά πριν από τη βαθμίδα ⇒ outside (ετικέτα, όχι κύκλος 10 χλμ.), αλλά inside στον δήμο της', () => {
    expect(verdict('city-only', MUNICIPAL_UNIT)).toBe('outside');
    expect(verdict('city-only', MUNICIPALITY)).toBe('inside');
  });

  it('καμία απόδοση ⇒ γεωμετρία· χωρίς θέση ⇒ «ίσως», ποτέ «έξω» (Α5 §4.1)', () => {
    expect(verdict('unattributed', MUNICIPALITY)).toBe('inside');
    expect(verdict('nowhere', MUNICIPALITY)).toBe('maybe');
  });

  it('οικισμός (βαθμίδα 8, χωρίς πεδίο απόδοσης) ⇒ γεωμετρία, ποτέ σύγκριση με τον γονέα', () => {
    const settlement = region('settlement:0701010101', 8);
    expect(verdict('here', settlement)).toBe('inside');
    expect(verdict('other-municipality', settlement)).toBe('inside');
  });

  it('κουτί/κύκλος αγνοούν την απόδοση — μόνο το `?area=` αλλάζει', () => {
    const circle = { center: INSIDE, radiusKm: 1 };
    const item = SAMPLE.find((entry) => entry.id === 'other-municipality')!;
    expect(listingAreaVerdict(item, circle)).toBe('inside');
    expect(listingAreaVerdict(item, BOX)).toBe('inside');
  });
});

describe('Π2 🔴 — ΙΔΙΟ ΣΥΝΟΛΟ: όσα δείχνει η αναζήτηση = όσα μετρά η σελίδα', () => {
  const { byArea, unassigned } = groupListingsByArea(SAMPLE);

  it.each(PAGE_REGIONS.map((area) => [area.adminId, area] as const))('%s', (_id, area) => {
    const page = ids(byArea.get(area.adminId) ?? []);
    const answered = visibleIn(area).filter((item) => !unassignedListing(item));
    expect(ids(answered)).toEqual(page);
    expect(page.length).toBeGreaterThan(0);
  });

  it('η διαφορά είναι ΟΝΟΜΑΣΜΕΝΗ: μόνο αγγελίες χωρίς καμία απόδοση (`unassigned`)', () => {
    for (const area of PAGE_REGIONS) {
      const page = new Set((byArea.get(area.adminId) ?? []).map((item) => item.id));
      const extra = visibleIn(area).filter((item) => !page.has(item.id));
      expect(extra.every(unassignedListing)).toBe(true);
    }
    expect(unassigned).toBe(2);
  });

  it('η λογιστική κλείνει και συμφωνεί με το ορατό, με τον ίδιο κριτή', () => {
    for (const area of PAGE_REGIONS) {
      const ledger = computeAreaLedger(SAMPLE, area);
      expect(areaLedgerBalances(ledger)).toBe(true);
      expect(areaLedgerMatchesVisible(ledger, visibleIn(area).length)).toBe(true);
    }
    expect(computeAreaLedger(SAMPLE, MUNICIPALITY)).toEqual({ total: 8, inside: 4, maybe: 2, outside: 2 });
  });
});

describe('Π3 🔴 — ΔΗΛΩΜΕΝΗ Δ.Ε. (ADR-890 §21): ορατή στη σελίδα ΚΑΙ στο `?area=`, με τον ίδιο κριτή', () => {
  // Θέση πόλης ⇒ μέτρηση ως τον δήμο (βάθος 5)· η Δ.Ε. είναι η επικυρωμένη δήλωση του εκδότη.
  const declared = listing({
    id: 'declared-unit',
    position: cityOnly(),
    adminArea: assigned({ municipalUnitId: 'municipal_unit:070101', measuredDepth: 5 }),
  });
  const shallow = listing({ id: 'shallow', position: cityOnly(), adminArea: assigned({ municipalUnitId: null, measuredDepth: 5 }) });

  it('δηλωμένη Δ.Ε. ⇒ inside· η ίδια θέση χωρίς δήλωση ⇒ outside', () => {
    expect(listingAreaVerdict(declared, MUNICIPAL_UNIT)).toBe('inside');
    expect(listingAreaVerdict(shallow, MUNICIPAL_UNIT)).toBe('outside');
  });

  it('η σελίδα τη μετρά όπου τη δείχνει η αναζήτηση — ίσο σύνολο κατά κατασκευή', () => {
    const { byArea } = groupListingsByArea([declared, shallow]);
    expect(ids(byArea.get(MUNICIPAL_UNIT.adminId) ?? [])).toEqual(['declared-unit']);
    const searched = applyListingFilters([declared, shallow], { ...EMPTY_LISTING_FILTERS, near: MUNICIPAL_UNIT });
    expect(ids(searched)).toEqual(['declared-unit']);
  });
});
