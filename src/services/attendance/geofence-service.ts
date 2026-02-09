/**
 * =============================================================================
 * Geofence Service — Pure Haversine Distance + Geofence Verification
 * =============================================================================
 *
 * Server-side geofence calculations for construction site attendance.
 * All functions are pure — zero side effects, zero Firestore access.
 *
 * @module services/attendance/geofence-service
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import 'server-only';

import type { GeofenceConfig, GeofenceVerificationResult } from '@/components/projects/ika/contracts';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Earth's mean radius in meters (WGS-84) */
const EARTH_RADIUS_METERS = 6_371_008.8;

/** Minimum valid geofence radius (meters) */
export const MIN_GEOFENCE_RADIUS = 50;

/** Maximum valid geofence radius (meters) */
export const MAX_GEOFENCE_RADIUS = 500;

/** Default geofence radius if none configured (meters) */
export const DEFAULT_GEOFENCE_RADIUS = 200;

// =============================================================================
// HAVERSINE DISTANCE
// =============================================================================

/**
 * Convert degrees to radians.
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate the great-circle distance between two GPS coordinates
 * using the Haversine formula.
 *
 * @param lat1 - Latitude of point 1 (decimal degrees)
 * @param lng1 - Longitude of point 1 (decimal degrees)
 * @param lat2 - Latitude of point 2 (decimal degrees)
 * @param lng2 - Longitude of point 2 (decimal degrees)
 * @returns Distance in meters
 *
 * @see https://en.wikipedia.org/wiki/Haversine_formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

// =============================================================================
// GEOFENCE VERIFICATION
// =============================================================================

/**
 * Check if worker coordinates are within a geofence.
 *
 * @param workerLat - Worker GPS latitude
 * @param workerLng - Worker GPS longitude
 * @param geofence - Geofence configuration (center + radius)
 * @param gpsAccuracy - GPS accuracy reported by device (meters), null if unknown
 * @returns Verification result with distance and inside/outside flag
 */
export function isWithinGeofence(
  workerLat: number,
  workerLng: number,
  geofence: GeofenceConfig,
  gpsAccuracy: number | null
): GeofenceVerificationResult {
  const distanceMeters = calculateHaversineDistance(
    workerLat,
    workerLng,
    geofence.latitude,
    geofence.longitude
  );

  return {
    inside: distanceMeters <= geofence.radiusMeters,
    distanceMeters: Math.round(distanceMeters),
    radiusMeters: geofence.radiusMeters,
    gpsAccuracyMeters: gpsAccuracy ? Math.round(gpsAccuracy) : null,
  };
}

/**
 * Validate geofence configuration values.
 *
 * @param latitude - Center latitude
 * @param longitude - Center longitude
 * @param radiusMeters - Radius in meters
 * @returns null if valid, error message if invalid
 */
export function validateGeofenceConfig(
  latitude: number,
  longitude: number,
  radiusMeters: number
): string | null {
  if (latitude < -90 || latitude > 90) {
    return 'Latitude must be between -90 and 90';
  }
  if (longitude < -180 || longitude > 180) {
    return 'Longitude must be between -180 and 180';
  }
  if (radiusMeters < MIN_GEOFENCE_RADIUS || radiusMeters > MAX_GEOFENCE_RADIUS) {
    return `Radius must be between ${MIN_GEOFENCE_RADIUS}m and ${MAX_GEOFENCE_RADIUS}m`;
  }
  return null;
}
