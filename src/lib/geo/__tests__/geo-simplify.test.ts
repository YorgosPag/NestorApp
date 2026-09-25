/**
 * @fileoverview Άγκυρα του Douglas–Peucker σε μέτρα — **η εγγύηση απόκλισης** είναι το συμβόλαιο (ADR-883).
 */

import { simplifyGeoRing } from '../geo-simplify';
import { geoRingsNearestEdgeMetres } from '../geo-ring';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';

/** Κύκλος ~1 km γύρω από τη Θεσσαλονίκη, με θόρυβο — σύνορο με πολλές περιττές κορυφές. */
function noisyCircle(vertices: number, noiseM: number): GeoOutline {
  const center = { lat: 40.64, lng: 22.94 };
  const metresPerDegreeLat = 111_195;
  const metresPerDegreeLng = metresPerDegreeLat * Math.cos((center.lat * Math.PI) / 180);
  const ring: GeoPoint[] = [];
  for (let i = 0; i < vertices; i++) {
    const angle = (2 * Math.PI * i) / vertices;
    // Ντετερμινιστικός «θόρυβος» — ίδια είσοδος σε κάθε εκτέλεση.
    const radius = 1000 + noiseM * Math.sin(i * 7.3);
    ring.push({
      lat: center.lat + (radius * Math.sin(angle)) / metresPerDegreeLat,
      lng: center.lng + (radius * Math.cos(angle)) / metresPerDegreeLng,
    });
  }
  return ring;
}

describe('simplifyGeoRing', () => {
  it('🔒 ΚΑΜΙΑ αφαιρεμένη κορυφή δεν απέχει πάνω από την ανοχή από το απλοποιημένο σύνορο', () => {
    const ring = noisyCircle(2000, 8);
    for (const toleranceM of [5, 15, 40]) {
      const simplified = simplifyGeoRing(ring, toleranceM);
      expect(simplified).not.toBeNull();
      const worst = Math.max(...ring.map((point) => geoRingsNearestEdgeMetres(point, [simplified!])));
      expect(worst).toBeLessThanOrEqual(toleranceM);
    }
  });

  it('μειώνει δραστικά τις κορυφές — αλλιώς η απλοποίηση δεν αξίζει τα bytes της', () => {
    const simplified = simplifyGeoRing(noisyCircle(2000, 3), 25);
    expect(simplified!.length).toBeLessThan(200);
  });

  it('κρατά μόνο κορυφές του αρχικού — δεν επινοεί σημεία', () => {
    const ring = noisyCircle(500, 5);
    const originals = new Set(ring.map((p) => `${p.lat},${p.lng}`));
    for (const point of simplifyGeoRing(ring, 20)!) expect(originals.has(`${point.lat},${point.lng}`)).toBe(true);
  });

  it('σχήμα μικρότερο από την ανοχή ΚΑΤΑΡΡΕΕΙ σε null — δεν γίνεται εκφυλισμένος δακτύλιος', () => {
    // Τρίγωνο ~3 m σε ανοχή 50 m.
    const tiny: GeoOutline = [
      { lat: 40.64, lng: 22.94 },
      { lat: 40.64002, lng: 22.94 },
      { lat: 40.64, lng: 22.94003 },
      { lat: 40.640001, lng: 22.940001 },
    ];
    expect(simplifyGeoRing(tiny, 50)).toBeNull();
  });

  it('μηδενική ανοχή = ο ίδιος ο δακτύλιος· < 3 κορυφές = null', () => {
    const ring = noisyCircle(50, 1);
    expect(simplifyGeoRing(ring, 0)).toBe(ring);
    expect(simplifyGeoRing(ring.slice(0, 2), 10)).toBeNull();
  });
});
