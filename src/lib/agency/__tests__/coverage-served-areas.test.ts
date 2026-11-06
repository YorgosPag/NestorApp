/**
 * Άγκυρες των περιοχών που εξυπηρετεί μια ακτίνα ή ένα περίγραμμα (ADR-923 Ν11 ε): η λεπτότερη βαθμίδα που χωρά, ποτέ
 * αποκοπή, και όριο που δεν διαβάστηκε αφήνει τη χονδρότερη απάντηση.
 */

import { coverageOutline } from '../coverage-geometry';
import { SERVED_AREA_LIMIT, servedAdminAreas, type ServedAreaSources } from '../coverage-served-areas';
import { ADMIN_AREA_ROOT_KEY, type AdminArea } from '@/lib/geo/admin-area-index-file';
import type { GeoOutline, GeoRegion } from '@/types/geo/coordinates';

const rectangle = (south: number, west: number, north: number, east: number): GeoOutline => [
  { lat: south, lng: west },
  { lat: south, lng: east },
  { lat: north, lng: east },
  { lat: north, lng: west },
];

type Box = readonly [south: number, west: number, north: number, east: number];

/** Μια Περιφέρεια (40.0–40.2, 23.0–23.2) σε δύο Π.Ε. (δυτική · ανατολική), η καθεμία σε δύο δήμους (νότιος · βόρειος). */
const TREE: readonly (readonly [id: string, level: number, parentId: string | null, box: Box])[] = [
  ['region:1', 3, null, [40.0, 23.0, 40.2, 23.2]],
  ['region:2', 3, null, [41.0, 24.0, 41.2, 24.2]],
  ['regional_unit:1', 4, 'region:1', [40.0, 23.0, 40.2, 23.1]],
  ['regional_unit:2', 4, 'region:1', [40.0, 23.1, 40.2, 23.2]],
  ['municipality:11', 5, 'regional_unit:1', [40.0, 23.0, 40.1, 23.1]],
  ['municipality:12', 5, 'regional_unit:1', [40.1, 23.0, 40.2, 23.1]],
  ['municipality:21', 5, 'regional_unit:2', [40.0, 23.1, 40.1, 23.2]],
  ['municipality:22', 5, 'regional_unit:2', [40.1, 23.1, 40.2, 23.2]],
];

const AREAS: readonly AdminArea[] = TREE.map(([id, level, parentId]) => ({ id, name: `Όνομα ${id}`, level, parentId }));

function sourcesWith(unreadable: readonly string[] = []): ServedAreaSources {
  return {
    childrenOf: (parentId) => AREAS.filter((area) => (area.parentId ?? ADMIN_AREA_ROOT_KEY) === parentId),
    regionOf: async (adminId) => {
      const row = TREE.find(([id]) => id === adminId);
      if (row === undefined || unreadable.includes(adminId)) return null;
      const [, level, , [south, west, north, east]] = row;
      const region: GeoRegion = { adminId, level, rings: [rectangle(south, west, north, east)], bbox: { south, west, north, east }, toleranceM: 30 };
      return region;
    },
  };
}

const idsOf = (areas: readonly AdminArea[]) => areas.map((area) => area.id);

describe('servedAdminAreas', () => {
  it('σχήμα μέσα σε έναν δήμο ⇒ ο δήμος', async () => {
    expect(idsOf(await servedAdminAreas(rectangle(40.03, 23.03, 40.06, 23.06), sourcesWith()))).toEqual(['municipality:11']);
  });

  it('σχήμα πάνω σε τέσσερις δήμους ⇒ και οι τέσσερις, με τη σειρά του ευρετηρίου', async () => {
    const served = await servedAdminAreas(rectangle(40.05, 23.05, 40.15, 23.15), sourcesWith());
    expect(idsOf(served)).toEqual(['municipality:11', 'municipality:12', 'municipality:21', 'municipality:22']);
  });

  it('🔑 πάνω από το όριο ⇒ η χονδρότερη βαθμίδα, ποτέ αποκοπή', async () => {
    const outline = rectangle(40.05, 23.02, 40.15, 23.08);
    expect(idsOf(await servedAdminAreas(outline, sourcesWith(), 2))).toEqual(['municipality:11', 'municipality:12']);
    expect(idsOf(await servedAdminAreas(outline, sourcesWith(), 1))).toEqual(['regional_unit:1']);
  });

  it('⚠️ όριο που δεν διαβάστηκε ⇒ μένει η χονδρότερη απάντηση, ποτέ λίστα με κενό', async () => {
    const served = await servedAdminAreas(rectangle(40.05, 23.02, 40.15, 23.08), sourcesWith(['municipality:12']));
    expect(idsOf(served)).toEqual(['regional_unit:1']);
  });

  it('σχήμα εκτός κάθε ορίου ⇒ τίποτα', async () => {
    expect(await servedAdminAreas(rectangle(38.0, 20.0, 38.1, 20.1), sourcesWith())).toEqual([]);
  });

  it('η ακτίνα περνά από το ίδιο περίγραμμα με τον χάρτη: 10 χλμ. από το κέντρο της Περιφέρειας ⇒ οι τέσσερις δήμοι', async () => {
    const outline = coverageOutline({ circle: { center: { lat: 40.1, lng: 23.1 }, radiusKm: 10 } });
    expect(outline).not.toBeNull();
    expect(idsOf(await servedAdminAreas(outline ?? [], sourcesWith()))).toHaveLength(4);
  });

  it('το όριο είναι αυτό του Google Business Profile', () => {
    expect(SERVED_AREA_LIMIT).toBe(20);
  });
});
