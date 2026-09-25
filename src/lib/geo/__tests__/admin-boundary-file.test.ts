/**
 * @fileoverview Άγκυρα του συμβολαίου γεννήτορα ⇄ οθόνης για τα όρια (ADR-883) — **και** των
 * παραγόμενων αρχείων: ό,τι προτείνει το ευρετήριο, υπάρχει ως όριο και διαβάζεται.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { adminBoundaryFileName, adminBoundaryPath, placeWithinBoundary, readAdminBoundary } from '../admin-boundary-file';
import { ADMIN_AREA_INDEX_FILE, SETTLEMENT_LEVEL, boundaryOwnerId, readAdminAreaIndex } from '../admin-area-index-file';
import { geoJsonRings } from '../geo-geojson';
import { isPointInGeoRings } from '../geo-ring';

const PUBLIC = join(process.cwd(), 'public');

function readPublic(relative: string): unknown {
  return JSON.parse(readFileSync(join(PUBLIC, relative), 'utf8'));
}

describe('η διαδρομή του ορίου', () => {
  it('δεν περιέχει `:` — απαγορεύεται σε όνομα αρχείου στα Windows', () => {
    expect(adminBoundaryFileName('municipality:0708')).toBe('municipality-0708.json');
    expect(adminBoundaryPath('municipality:0708')).toBe('/data/admin-boundaries/municipality-0708.json');
  });
});

describe('readAdminBoundary', () => {
  const valid = {
    id: 'municipality:0708',
    level: 5,
    bbox: [22.86, 40.65, 22.93, 40.7],
    toleranceM: 25,
    geometry: { type: 'MultiPolygon', coordinates: [[[[22.86, 40.65], [22.93, 40.65], [22.9, 40.7], [22.86, 40.65]]]] },
  };

  it('διαβάζει έγκυρο όριο', () => {
    expect(readAdminBoundary(valid, 'municipality:0708')?.bbox).toEqual({ west: 22.86, south: 40.65, east: 22.93, north: 40.7 });
  });

  it.each([
    ['άλλο id από το ζητούμενο', { ...valid, id: 'municipality:0101' }],
    ['χωρίς ανοχή — δεν μαντεύουμε πόσο θολό είναι', { ...valid, toleranceM: undefined }],
    ['ανεστραμμένο bbox', { ...valid, bbox: [22.93, 40.65, 22.86, 40.7] }],
    ['κενή γεωμετρία', { ...valid, geometry: { type: 'MultiPolygon', coordinates: [] } }],
    ['σελίδα HTML αντί για JSON', '<!doctype html>'],
  ])('🔒 %s ⇒ null («δεν ξέρω», ποτέ «κενό όριο»)', (_, payload) => {
    expect(readAdminBoundary(payload, 'municipality:0708')).toBeNull();
  });
});

describe('τα παραγόμενα αρχεία (npm run build:admin-boundaries)', () => {
  const index = readAdminAreaIndex(readPublic(ADMIN_AREA_INDEX_FILE));

  it('το ευρετήριο καλύπτει όλες τις βαθμίδες 3–7 και τους οικισμούς (8, §5.10)', () => {
    const levels = new Set([...index.values()].map((area) => area.level));
    expect([...levels].sort()).toEqual([3, 4, 5, 6, 7, SETTLEMENT_LEVEL]);
    expect(index.size).toBeGreaterThan(14000);
  });

  it('🔒 ΚΑΘΕ περιοχή του ευρετηρίου καταλήγει σε αρχείο ορίου — καμία πρόταση δεν οδηγεί σε «μη διαθέσιμο»', () => {
    const missing = [...index.values()]
      .map(boundaryOwnerId)
      .filter((id) => !existsSync(join(PUBLIC, adminBoundaryPath(id))));
    expect(missing).toEqual([]);
  });

  it('🔒 ο οικισμός δείχνει όριο ΑΛΛΗΣ περιοχής του ευρετηρίου (ποτέ δικό του, ποτέ άλλου οικισμού)', () => {
    const settlements = [...index.values()].filter((area) => area.level === SETTLEMENT_LEVEL);
    const orphans = settlements.filter((area) => {
      const owner = index.get(boundaryOwnerId(area));
      return owner === undefined || owner.level === SETTLEMENT_LEVEL || owner.id === area.id;
    });
    expect(orphans.map((area) => area.id)).toEqual([]);
  });

  it('η Δορκάδα (σύμπτωμα Giorgio): υπάρχει, στο όριο της Τ.Κ. Καρτερών, με πινέζα μέσα', () => {
    const dorkada = index.get('settlement:0709060202');
    expect(dorkada).toEqual({ id: 'settlement:0709060202', name: 'Δορκάδα', level: 8, parentId: 'community:07090602' });
    const owner = readAdminBoundary(readPublic(adminBoundaryPath('community:07090602')), 'community:07090602');
    const point = owner?.places.get('settlement:0709060202');
    expect(point).toBeDefined();
    expect(isPointInGeoRings(point!, geoJsonRings(owner!.geometry))).toBe(true);
  });

  it('🔒 ΚΑΘΕ πινέζα οικισμού: ανήκει σε οικισμό αυτού του ορίου και πέφτει μέσα του (± ανοχή απλοποίησης)', () => {
    const bad: string[] = [];
    for (const file of readdirSync(join(PUBLIC, 'data', 'admin-boundaries'))) {
      const payload = readPublic(join('data', 'admin-boundaries', file)) as { id: string };
      const boundary = readAdminBoundary(payload, payload.id);
      if (boundary === null || boundary.places.size === 0) continue;
      const rings = geoJsonRings(boundary.geometry);
      for (const [id, point] of boundary.places) {
        const area = index.get(id);
        const belongs = area !== undefined && area.level === SETTLEMENT_LEVEL && boundaryOwnerId(area) === boundary.id;
        const inside = placeWithinBoundary(point, rings, boundary.toleranceM);
        if (!belongs || !inside) bad.push(`${boundary.id} → ${id}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('ο Δήμος Κορδελιού-Ευόσμου: διαβάζεται, και το κέντρο του Ευόσμου είναι μέσα', () => {
    const id = 'municipality:0708';
    const boundary = readAdminBoundary(readPublic(adminBoundaryPath(id)), id);
    expect(boundary).not.toBeNull();
    const rings = geoJsonRings(boundary!.geometry);
    expect(isPointInGeoRings({ lat: 40.6689, lng: 22.9086 }, rings)).toBe(true); // Εύοσμος
    expect(isPointInGeoRings({ lat: 40.6325, lng: 22.9411 }, rings)).toBe(false); // Λευκός Πύργος
  });

  it('οι δήμοι του Κλεισθένη υπάρχουν ως ΕΝΙΑΙΟ περίγραμμα (σύνθεση + διάλυση)', () => {
    for (const name of ['ΔΗΜΟΣ ΒΟΡΕΙΑΣ ΚΕΡΚΥΡΑΣ', 'ΔΗΜΟΣ ΔΥΤΙΚΗΣ ΛΕΣΒΟΥ']) {
      const area = [...index.values()].find((entry) => entry.level === 5 && entry.name === name);
      expect(area).toBeDefined();
      const boundary = readAdminBoundary(readPublic(adminBoundaryPath(area!.id)), area!.id);
      expect(boundary).not.toBeNull();
    }
  });
});
