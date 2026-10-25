/**
 * ΑΓΚΥΡΕΣ — **Η ΜΙΑ ΠΟΡΤΑ ΤΗΣ ΑΠΟΔΟΣΗΣ** (ADR-890 §21): μέτρηση → δήλωση → επιλογές → πρόταση, με τον ίδιο κριτή.
 * Γεωμετρία: `lib/geo/__tests__/admin-area-declaration-fixtures.ts` (δήμος Κασσάνδρας, Σίβηρη).
 */

import type { AdminAreaLookup } from '@/lib/geo/admin-area-of-point';
import type { GeoRegion } from '@/types/geo/coordinates';
import type { ListingPosition } from '@/types/public-listing';
import { SIVIRI, sources } from '@/lib/geo/__tests__/admin-area-declaration-fixtures';

const WIDE: Pick<GeoRegion, 'rings' | 'bbox' | 'toleranceM'> = {
  rings: [[{ lat: 39, lng: 22 }, { lat: 39, lng: 25 }, { lat: 42, lng: 25 }, { lat: 42, lng: 22 }]],
  bbox: { south: 39, west: 22, north: 42, east: 25 },
  toleranceM: 25,
};

const mockDeclarationSources = jest.fn();

/** Ο κριτής της μέτρησης ανοίγει και Περιφέρεια/Π.Ε. — εδώ ένα ευρύ τετράγωνο, οι υπόλοιπες από τα fixtures. */
function mockFixtureLookup(): AdminAreaLookup {
  const fixture = sources();
  return {
    childrenOf: (parentId) =>
      parentId === null ? [{ id: 'region:112', level: 3 }] : fixture.childrenOf(parentId).map(({ id, level }) => ({ id, level })),
    regionOf: async (adminId) =>
      adminId === 'region:112' || adminId === 'regional_unit:13'
        ? { adminId, level: adminId === 'region:112' ? 3 : 4, ...WIDE }
        : fixture.regionOf(adminId),
  };
}

jest.mock('@/services/places/admin-boundaries.reader', () => ({
  readAdminAreaLookup: async () => mockFixtureLookup(),
  readAdminAreaDeclarationSources: () => mockDeclarationSources(),
}));

jest.mock('@/services/places/administrative-hierarchy.reader', () => ({
  readAdminIdentitySources: async () => ({}),
}));

jest.mock('@/lib/places/admin-identity', () => ({
  ADMIN_ID_TRUSTED_VIA: ['exact', 'chain'],
  identifyWithin: (label: string, level: number, scopeId: string) =>
    label === 'Σίβηρη' && level === 8 && scopeId === 'municipality:1303'
      ? { kind: 'identified', entity: { id: 'settlement:1303010101', name: 'Σίβηρη', level: 8 }, level: 8, via: 'chain' }
      : { kind: 'absent' },
}));

// Μετά τα mocks: η υπηρεσία εισάγει τους αναγνώστες στο φόρτωμα.
import { attributeAdminArea, declarableAdminAreasAt } from '../admin-area-attribution.server';

const AT = '2026-10-25T00:00:00.000Z';
const CENTER: ListingPosition = { kind: 'known', provenance: 'geocoded', point: SIVIRI, locatedAt: AT, accuracy: 'center' };
const PIN: ListingPosition = { kind: 'known', provenance: 'manual', point: SIVIRI, locatedAt: AT };

beforeEach(() => {
  mockDeclarationSources.mockResolvedValue(sources());
});

describe('attributeAdminArea — μέτρηση πρώτα, δήλωση μόνο ως συμπλήρωμα', () => {
  it('καμία δήλωση ⇒ η μετρημένη απόδοση ως τον δήμο (center ⇒ βάθος 5)', async () => {
    const { assignment, declaration } = await attributeAdminArea(CENTER, null);
    expect(declaration).toEqual({ kind: 'none' });
    expect(assignment).toMatchObject({ municipalityId: 'municipality:1303', municipalUnitId: null, measuredDepth: 5 });
  });

  it('δηλωμένος οικισμός ⇒ Δ.Ε. + κοινότητα· το βάθος μέτρησης μένει 5', async () => {
    const { assignment, declaration } = await attributeAdminArea(CENTER, 'settlement:1303010101');
    expect(declaration).toEqual({ kind: 'applied' });
    expect(assignment).toMatchObject({
      municipalityId: 'municipality:1303',
      municipalUnitId: 'municipal_unit:130301',
      communityId: 'community:13030101',
      measuredDepth: 5,
    });
  });

  it('Δ.Ε. άλλου δήμου ⇒ απορρίπτεται, μένει η μέτρηση', async () => {
    const { assignment, declaration } = await attributeAdminArea(CENTER, 'municipal_unit:130101');
    expect(declaration).toEqual({ kind: 'rejected', reason: 'contradicts-measured' });
    expect(assignment).toMatchObject({ municipalUnitId: null, measuredDepth: 5 });
  });

  it('πηγές επικύρωσης μη διαθέσιμες ⇒ unverified, ποτέ «δεκτή»', async () => {
    mockDeclarationSources.mockResolvedValue(null);
    const { assignment, declaration } = await attributeAdminArea(CENTER, 'settlement:1303010101');
    expect(declaration).toEqual({ kind: 'unverified' });
    expect(assignment).toMatchObject({ municipalUnitId: null });
  });

  it('πινέζα ανθρώπου ⇒ μέτρηση ως την κοινότητα· η δήλωση είναι περιττή (not-deeper)', async () => {
    const { assignment, declaration } = await attributeAdminArea(PIN, 'municipal_unit:130301');
    expect(declaration).toEqual({ kind: 'rejected', reason: 'not-deeper' });
    expect(assignment).toMatchObject({ communityId: 'community:13030101', measuredDepth: 7 });
  });
});

describe('declarableAdminAreasAt — οι επιλογές της φόρμας και η πρόταση της μηχανής', () => {
  it('center ⇒ οι απόγονοι του δήμου· η «Σίβηρη» του geocoder γίνεται πρόταση', async () => {
    const result = await declarableAdminAreasAt(CENTER, 'Σίβηρη');
    expect(result?.candidates.map(({ id }) => id)).toContain('settlement:1303010101');
    expect(result?.suggestedId).toBe('settlement:1303010101');
  });

  it('τοποθεσία που δεν ταυτοποιείται ⇒ καμία πρόταση (ποτέ μαντεψιά)', async () => {
    expect((await declarableAdminAreasAt(CENTER, 'Αθήνα'))?.suggestedId).toBeNull();
  });

  it('πινέζα ⇒ καμία επιλογή (η θέση φτάνει ήδη ως την κοινότητα)', async () => {
    expect((await declarableAdminAreasAt(PIN, null))?.candidates).toEqual([]);
  });

  it('πηγές μη διαθέσιμες ⇒ `null` (503 στον καλούντα), ποτέ «καμία επιλογή»', async () => {
    mockDeclarationSources.mockResolvedValue(null);
    expect(await declarableAdminAreasAt(CENTER, null)).toBeNull();
  });
});
