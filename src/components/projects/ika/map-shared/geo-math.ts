/**
 * =============================================================================
 * Geo Math Utilities — GeoJSON Circle Generation
 * =============================================================================
 *
 * Map-specific geometry for the IKA map components.
 *
 * ⚠️ Η **απόσταση** δεν ζει πια εδώ. Ήταν μία από **τέσσερις** υλοποιήσεις με **δύο**
 * ακτίνες Γης, και το σχόλιο αυτού του αρχείου έγραφε *«same as geofence-service.ts»*
 * — υπόσχεση χωρίς μηχανισμό. Ενοποιήθηκε στο `@/lib/geo/geo-distance`, όπου
 * τεκμηριώνεται και η μέτρηση.
 *
 * @module components/projects/ika/map-shared/geo-math
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import { EARTH_RADIUS_METERS } from '@/lib/geo/geo-distance';

// =============================================================================
// GEOJSON CIRCLE
// =============================================================================

/**
 * Generate a GeoJSON polygon approximating a circle on the Earth's surface.
 * Uses Haversine-based bearing calculation for accurate meter-based radius.
 *
 * @param centerLat  - Center latitude in degrees
 * @param centerLng  - Center longitude in degrees
 * @param radiusMeters - Circle radius in meters
 * @param points     - Number of polygon vertices (default 64)
 */
export function generateCircleGeoJSON(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  points: number = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const latRad = (centerLat * Math.PI) / 180;
    const lngRad = (centerLng * Math.PI) / 180;
    const d = radiusMeters / EARTH_RADIUS_METERS;

    const newLat = Math.asin(
      Math.sin(latRad) * Math.cos(d) +
      Math.cos(latRad) * Math.sin(d) * Math.cos(angle)
    );
    const newLng = lngRad + Math.atan2(
      Math.sin(angle) * Math.sin(d) * Math.cos(latRad),
      Math.cos(d) - Math.sin(latRad) * Math.sin(newLat)
    );

    coords.push([
      (newLng * 180) / Math.PI,
      (newLat * 180) / Math.PI,
    ]);
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
}
