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
import { distanceMeters as greatCircleMeters } from '@/lib/geo/geo-distance';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum valid geofence radius (meters) */
export const MIN_GEOFENCE_RADIUS = 50;

/** Maximum valid geofence radius (meters) */
export const MAX_GEOFENCE_RADIUS = 500;

// =============================================================================
// HAVERSINE DISTANCE — ⚠️ ΔΕΝ ΖΕΙ ΠΙΑ ΕΔΩ
// =============================================================================
//
// Ήταν μία από **τέσσερις** υλοποιήσεις του ίδιου τύπου στο δέντρο, με **δύο**
// διαφορετικές ακτίνες Γης. Ενοποιήθηκε στο `@/lib/geo/geo-distance`, όπου
// τεκμηριώνεται η μέτρηση. **Καμία αλλαγή συμπεριφοράς**: ίδιος τύπος (μορφή
// `atan2`), ίδια ακτίνα (6 371 008,8).
//
// Το `calculateHaversineDistance` ήταν εξαγόμενο με **έναν** καταναλωτή, μέσα στο
// ίδιο αρχείο — δηλαδή εξαγωγή που κανείς δεν ζήτησε ποτέ.

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
  const distanceMeters = greatCircleMeters(
    { lat: workerLat, lng: workerLng },
    { lat: geofence.latitude, lng: geofence.longitude }
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
