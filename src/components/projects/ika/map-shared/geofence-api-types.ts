/**
 * =============================================================================
 * Geofence API Types — Shared request/response types
 * =============================================================================
 *
 * SSOT for the /api/attendance/geofence endpoint response shape.
 * Used by GeofenceConfigMap (write) and LiveWorkerMap (read).
 *
 * @module components/projects/ika/map-shared/geofence-api-types
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import type { GeofenceConfig } from '../contracts';

/** Response shape from GET/POST /api/attendance/geofence */
export interface GeofenceApiResponse {
  success: boolean;
  geofence: GeofenceConfig | null;
  error?: string;
}
