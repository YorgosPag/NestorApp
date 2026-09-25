/**
 * @fileoverview Άγκυρα του συμβολαίου γεννήτορα ⇄ οθόνης για τα όρια (ADR-883) — **και** των
 * παραγόμενων αρχείων: ό,τι προτείνει το ευρετήριο, υπάρχει ως όριο και διαβάζεται.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { adminBoundaryFileName, adminBoundaryPath, readAdminBoundary } from '../admin-boundary-file';
import { ADMIN_AREA_INDEX_FILE, readAdminAreaIndex } from '../admin-area-index-file';
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

  it('το ευρετήριο καλύπτει όλες τις βαθμίδες 3–7', () => {
    const levels = new Set([...index.values()].map((area) => area.level));
    expect([...levels].sort()).toEqual([3, 4, 5, 6, 7]);
    expect(index.size).toBeGreaterThan(7000);
  });

  it('🔒 ΚΑΘΕ περιοχή του ευρετηρίου έχει αρχείο ορίου — καμία πρόταση δεν οδηγεί σε «μη διαθέσιμο»', () => {
    const missing = [...index.keys()].filter((id) => !existsSync(join(PUBLIC, adminBoundaryPath(id))));
    expect(missing).toEqual([]);
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
