/**
 * @jest-environment node
 *
 * ADR-889 Φ5 — το σχήμα των αρχείων ζωνών, και **τα πραγματικά αρχεία του `public/`**: ό,τι έγραψε ο γεννήτορας
 * διαβάζεται από τον ίδιο αναγνώστη που χρησιμοποιούν server και browser.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readValueZoneArea, readValueZonesIndex, valueZonesPublicPath, VALUE_ZONES_INDEX_PUBLIC_PATH } from '../value-zone-file';

const PUBLIC = join(process.cwd(), 'public');

function readPublic(path: readonly string[]): unknown {
  return JSON.parse(readFileSync(join(PUBLIC, ...path), 'utf8'));
}

describe('value-zone-file', () => {
  it('απορρίπτει ό,τι δεν είναι αρχείο ζωνών — null, ποτέ «καμία ζώνη»', () => {
    expect(readValueZoneArea({ v: 1, id: 'municipal_unit:1', bbox: [0, 0, 1, 1], toleranceM: 2, zones: [{}], fronts: [] }, 'municipal_unit:1')).toBeNull();
    expect(readValueZoneArea({ v: 1, id: 'other', bbox: [0, 0, 1, 1], toleranceM: 2, zones: [], fronts: [] }, 'municipal_unit:1')).toBeNull();
    expect(readValueZoneArea('<html>', 'municipal_unit:1')).toBeNull();
    expect(readValueZonesIndex({ v: 2 })).toBeNull();
  });

  it('το ευρετήριο και κάθε αρχείο του public/ διαβάζονται, με ζώνες που έχουν τιμή και δακτυλίους', () => {
    const index = readValueZonesIndex(readPublic(VALUE_ZONES_INDEX_PUBLIC_PATH));
    if (index === null) throw new Error('άκυρο ευρετήριο — τρέξε npm run build:value-zones');
    expect(index.areas.size).toBeGreaterThan(900);

    let zones = 0;
    for (const areaId of index.areas.keys()) {
      const area = readValueZoneArea(readPublic(valueZonesPublicPath(areaId)), areaId);
      if (area === null) throw new Error(`άκυρο αρχείο ζωνών ${areaId}`);
      zones += area.zones.length;
    }
    // 12.505 εγγραφές της πηγής − 4 διπλές ταυτότητες που συγχωνεύονται (ADR-889 §10).
    expect(zones).toBe(12_501);
  });

  it('η ζώνη Θ της Αθήνας (Πανεπιστημίου–Ακαδημίας, 3.850 €/m²) κάθεται στο σωστό σημείο — όχι 325 m δίπλα', () => {
    const athens = readValueZoneArea(readPublic(valueZonesPublicPath('municipality:4501')), 'municipality:4501');
    const theta = athens?.zones.find((zone) => zone.id === 4953);
    expect(theta?.price).toBe(3850);
    // Η Ακαδημίας κοντά στη Σίνα: 37,9805 Β · 23,7355 Α.
    expect(theta?.bbox.south).toBeLessThan(37.9805);
    expect(theta?.bbox.north).toBeGreaterThan(37.9805);
    expect(theta?.bbox.west).toBeLessThan(23.7355);
    expect(theta?.bbox.east).toBeGreaterThan(23.7355);
  });
});
