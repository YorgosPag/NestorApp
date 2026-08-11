/**
 * =============================================================================
 * IKA Map Shared Utilities — Barrel Export
 * =============================================================================
 */

export { MAP_ZOOM, OSM_MAP_STYLE, createGeofenceLayerStyles } from './map-styles';
// ⚠️ Η **απόσταση** δεν εξάγεται από εδώ: ζει στο `@/lib/geo/geo-distance` (SSoT).
// Μια δεύτερη πόρτα προς την ίδια συνάρτηση θα ήταν ακριβώς η κατάσταση που η
// ενοποίηση έκλεισε — τέσσερα ονόματα για ένα ερώτημα.
export { generateCircleGeoJSON } from './geo-math';
export type { GeofenceApiResponse } from './geofence-api-types';
