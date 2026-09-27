/**
 * =============================================================================
 * Shared Map Styles — OSM Tile Configuration & Geofence Layer Specs
 * =============================================================================
 *
 * SSOT for MapLibre GL style objects used across IKA map components:
 * - GeofenceConfigMap (admin configuration)
 * - LiveWorkerMap (real-time monitoring)
 *
 * @module components/projects/ika/map-shared/map-styles
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import type { FillLayerSpecification, LineLayerSpecification, StyleSpecification } from 'maplibre-gl';
import { rasterStyleSpecification } from '@/lib/maps/basemap-catalog';

// =============================================================================
// MAP BASE STYLE
// =============================================================================

/** Default zoom level for geofence/worker maps */
export const MAP_ZOOM = 15;

/**
 * Το OSM raster του μητρώου υποβάθρων (ADR-891 Φ1) — πηγή, όροι και απόδοση ζουν στο
 * `@/lib/maps/basemap-catalog`, όχι εδώ.
 */
export const OSM_MAP_STYLE: StyleSpecification = rasterStyleSpecification('osm-raster');

// =============================================================================
// GEOFENCE CIRCLE LAYER STYLES
// =============================================================================

/**
 * Create geofence circle fill + line layer specs.
 * Parameterized by source ID so each map can use its own GeoJSON source.
 *
 * @param sourceId - GeoJSON source ID (e.g. "geofence-circle", "live-geofence")
 * @param idPrefix - Layer ID prefix to avoid collisions (e.g. "geofence", "live-geofence")
 * @param options  - Optional paint overrides (opacity, dash pattern)
 */
interface GeofenceLayerOptions {
  fillOpacity?: number;
  lineDashArray?: number[];
}

/* eslint-disable design-system/no-hardcoded-colors -- MapLibre GL API requires literal color strings */
export function createGeofenceLayerStyles(
  sourceId: string,
  idPrefix: string,
  options?: GeofenceLayerOptions
): { fill: FillLayerSpecification; line: LineLayerSpecification } {
  return {
    fill: {
      id: `${idPrefix}-fill`,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': options?.fillOpacity ?? 0.15,
      },
    },
    line: {
      id: `${idPrefix}-line`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': '#2563eb',
        'line-width': 2,
        'line-dasharray': options?.lineDashArray ?? [3, 2],
      },
    },
  };
}
/* eslint-enable design-system/no-hardcoded-colors */
