/**
 * Fixtures της δηλωμένης απόδοσης περιοχής (ADR-890 §21) — ΚΟΙΝΑ για τον κριτή (`lib/geo`) και την υπηρεσία
 * (`services/places`), ώστε η ίδια γεωμετρία να μη γραφτεί δύο φορές (N.18).
 *
 * Γεωμετρία (τετράγωνα): δήμος 1303 = lat 40.00–40.10 × lng 23.30–23.50 · Δ.Ε. Α (130301) = δυτικό μισό · Δ.Ε. Β (130302)
 * = ανατολικό · κοινότητες της Α: νότια (13030101, με τον οικισμό «Σίβηρη») και βόρεια (13030102) · κοινότητα της Β (13030201).
 */

import type { AdminAreaDeclarationSources } from '@/lib/geo/admin-area-declaration';
import type { AdminArea } from '@/lib/geo/admin-area-index-file';
import type { AdminAreaAssignment } from '@/lib/geo/admin-area-of-point';
import type { GeoBoundingBox, GeoCircle, GeoPoint, GeoRegion } from '@/types/geo/coordinates';

export const SIVIRI: GeoPoint = { lat: 40.03, lng: 23.35 };

const AREAS: readonly AdminArea[] = [
  { id: 'region:112', name: 'Κεντρική Μακεδονία', level: 3, parentId: null },
  { id: 'regional_unit:13', name: 'Χαλκιδική', level: 4, parentId: 'region:112' },
  { id: 'municipality:1303', name: 'Κασσάνδρα', level: 5, parentId: 'regional_unit:13' },
  { id: 'municipality:1301', name: 'Άλλος δήμος', level: 5, parentId: 'regional_unit:13' },
  { id: 'municipal_unit:130101', name: 'Δ.Ε. άλλου δήμου', level: 6, parentId: 'municipality:1301' },
  { id: 'municipal_unit:130301', name: 'Κασσάνδρας', level: 6, parentId: 'municipality:1303' },
  { id: 'municipal_unit:130302', name: 'Παλλήνης', level: 6, parentId: 'municipality:1303' },
  { id: 'community:13030101', name: 'Σίβηρης', level: 7, parentId: 'municipal_unit:130301' },
  { id: 'community:13030102', name: 'Βόρεια', level: 7, parentId: 'municipal_unit:130301' },
  { id: 'community:13030201', name: 'Παλλήνης', level: 7, parentId: 'municipal_unit:130302' },
  { id: 'settlement:1303010101', name: 'Σίβηρη', level: 8, parentId: 'community:13030101' },
  { id: 'settlement:1303020101', name: 'Πευκοχώρι', level: 8, parentId: 'community:13030201' },
];

const BOXES: Readonly<Record<string, GeoBoundingBox>> = {
  'municipality:1303': { south: 40.0, west: 23.3, north: 40.1, east: 23.5 },
  'municipal_unit:130301': { south: 40.0, west: 23.3, north: 40.1, east: 23.4 },
  'municipal_unit:130302': { south: 40.0, west: 23.4, north: 40.1, east: 23.5 },
  'community:13030101': { south: 40.0, west: 23.3, north: 40.05, east: 23.4 },
  'community:13030102': { south: 40.05, west: 23.3, north: 40.1, east: 23.4 },
  'community:13030201': { south: 40.0, west: 23.4, north: 40.1, east: 23.5 },
  'municipal_unit:130101': { south: 41.0, west: 24.0, north: 41.1, east: 24.1 },
};

function regionOfBox(adminId: string, level: number, box: GeoBoundingBox): GeoRegion {
  const { south, west, north, east } = box;
  return {
    adminId,
    level,
    rings: [[{ lat: south, lng: west }, { lat: south, lng: east }, { lat: north, lng: east }, { lat: north, lng: west }]],
    bbox: box,
    toleranceM: 25,
  };
}

const BY_ID = new Map(AREAS.map((area) => [area.id, area]));

export function sources(overrides: Partial<AdminAreaDeclarationSources> = {}): AdminAreaDeclarationSources {
  return {
    areas: BY_ID,
    childrenOf: (parentId) => AREAS.filter((area) => area.parentId === parentId),
    regionOf: async (adminId) => {
      const box = BOXES[adminId];
      const area = BY_ID.get(adminId);
      return box === undefined || area === undefined ? null : regionOfBox(adminId, area.level, box);
    },
    ...overrides,
  };
}

/** Θέση `center` ⇒ μέτρηση ως τον δήμο (`DEPTH_BY_ACCURACY`). */
export const MEASURED_TO_MUNICIPALITY: AdminAreaAssignment = {
  regionId: 'region:112',
  regionalUnitId: 'regional_unit:13',
  municipalityId: 'municipality:1303',
  municipalUnitId: null,
  communityId: null,
  nearBoundary: true,
  measuredDepth: 5,
};

export const CITY_CIRCLE: GeoCircle = { center: SIVIRI, radiusKm: 10 };
export const TIGHT_CIRCLE: GeoCircle = { center: SIVIRI, radiusKm: 0.25 };
