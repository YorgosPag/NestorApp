/**
 * @jest-environment node
 *
 * @fileoverview 🗺️ **ΑΓΚΥΡΑ — το κάδρο ακολουθεί την αβεβαιότητα, και ΠΟΤΕ δεν ξεπερνά το όριο ακρίβειας.**
 * @related lib/maps/map-snapshot-camera.ts · ADR-777 §8.70 Φ2
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | σταθερό ζουμ για κάθε σχήμα | η πόλη δεν χωρά ⇒ 🔴 |
 * | αφαίρεση του ψαλιδιού `max` | περίγραμμα λίγων μέτρων σε ζουμ κτιρίου ⇒ 🔴 |
 */

import type { ListingMapMark } from '@/lib/listings/listing-map-mark';
import { LISTING_UNCERTAINTY_KM } from '@/lib/listings/listing-map-shape';

import { listingSnapshotCamera, SNAPSHOT_AREA_SHARE, SNAPSHOT_ZOOM } from '../map-snapshot-camera';
import { metersToPixels } from '../metric-size';

const VIEWPORT = { widthPx: 176, heightPx: 132 };
const POINT = { lat: 40.63, lng: 22.95 };

describe('listingSnapshotCamera', () => {
  it('πινέζα ⇒ κλίμακα γειτονιάς, κέντρο στο σημείο', () => {
    expect(listingSnapshotCamera({ shape: 'pin', point: POINT }, VIEWPORT)).toEqual({
      center: POINT,
      zoom: SNAPSHOT_ZOOM.point,
    });
  });

  it.each(['shaded-circle', 'shaded-city'] as const)('%s ⇒ η διάμετρος πιάνει το SNAPSHOT_AREA_SHARE του κουτιού', (shape) => {
    const { zoom } = listingSnapshotCamera({ shape, point: POINT }, VIEWPORT);
    const diameterPx = metersToPixels((LISTING_UNCERTAINTY_KM[shape] ?? 0) * 2000, zoom, POINT.lat);
    expect(diameterPx).toBeCloseTo(VIEWPORT.heightPx * SNAPSHOT_AREA_SHARE, 3);
  });

  it('η πόλη βλέπεται ΑΠΟ ΜΑΚΡΥΤΕΡΑ από τη συνοικία', () => {
    const city = listingSnapshotCamera({ shape: 'shaded-city', point: POINT }, VIEWPORT).zoom;
    const hood = listingSnapshotCamera({ shape: 'shaded-circle', point: POINT }, VIEWPORT).zoom;
    expect(city).toBeLessThan(hood);
  });

  it('🔴 μικροσκοπικό περίγραμμα ⇒ ψαλίδι στο όριο ακρίβειας, ποτέ ζουμ κτιρίου', () => {
    const tiny: ListingMapMark = {
      shape: 'outline',
      point: POINT,
      outline: [POINT, { lat: 40.63001, lng: 22.95 }, { lat: 40.63001, lng: 22.95001 }],
    };
    expect(listingSnapshotCamera(tiny, VIEWPORT).zoom).toBe(SNAPSHOT_ZOOM.max);
  });

  it('περίγραμμα ⇒ κέντρο στο κέντρο του πλαισίου του', () => {
    const mark: ListingMapMark = {
      shape: 'outline',
      point: POINT,
      outline: [{ lat: 40, lng: 22 }, { lat: 41, lng: 22 }, { lat: 41, lng: 23 }],
    };
    expect(listingSnapshotCamera(mark, VIEWPORT).center).toEqual({ lat: 40.5, lng: 22.5 });
  });

  it('κάθε ζουμ μένει μέσα στα όρια', () => {
    for (const shape of ['pin', 'pin-with-ring', 'shaded-circle', 'shaded-city'] as const) {
      const { zoom } = listingSnapshotCamera({ shape, point: POINT }, VIEWPORT);
      expect(zoom).toBeGreaterThanOrEqual(SNAPSHOT_ZOOM.min);
      expect(zoom).toBeLessThanOrEqual(SNAPSHOT_ZOOM.max);
    }
  });
});
