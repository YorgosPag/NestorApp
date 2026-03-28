/**
 * =============================================================================
 * Geo Math Utilities — Haversine & GeoJSON Circle Generation
 * =============================================================================
 *
 * SSOT for geographic calculations used across IKA map components
 * and the geofence-service backend.
 *
 * @module components/projects/ika/map-shared/geo-math
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** WGS-84 mean Earth radius in meters (same as geofence-service.ts) */
export const EARTH_RADIUS_METERS = 6_371_008.8;

// =============================================================================
// HAVERSINE DISTANCE
// =============================================================================

/**
 * Calculate the great-circle distance between two lat/lng points.
 * Uses the Haversine formula — accurate for the ranges we need (< 10 km).
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
