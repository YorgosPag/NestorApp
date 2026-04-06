/**
 * OVERPASS DATA CONVERTERS
 * Extracted from OverpassApiService.ts (ADR-065 SRP split)
 *
 * Functions for converting Overpass API responses to GeoJSON Features,
 * FeatureCollections, and search results with confidence scoring.
 */

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('OverpassDataConverters');

import { GreekAdminLevel } from '../../types/administrative-types';
import type {
  OverpassAdminResponse,
  BoundingBox,
  AdminSearchResult,
} from '../../types/administrative-types';

// GeoJSON type aliases (ISO 19107 compliant)
type GeoJSONPosition = GeoJSON.Position;
type Feature = GeoJSON.Feature;
type FeatureCollection = GeoJSON.FeatureCollection;

// ============================================================================
// GEOJSON CONVERSION
// ============================================================================

/**
 * Convert Overpass response to a single GeoJSON Feature.
 */
export function convertToGeoJSON(response: OverpassAdminResponse, name: string): Feature | null {
  if (!response.elements || response.elements.length === 0) {
    logger.warn('No boundary data found for: ' + name);
    return null;
  }

  const relation = response.elements[0];

  if (!relation.geometry || relation.geometry.length === 0) {
    logger.warn('No geometry found for: ' + name);
    return null;
  }

  const coordinates: GeoJSONPosition[] = relation.geometry.map(
    (point) => [point.lon, point.lat] as GeoJSONPosition
  );

  closePolygon(coordinates);

  return {
    type: 'Feature',
    properties: {
      id: relation.id.toString(),
      name: relation.tags?.name || relation.tags?.['name:el'] || name,
      nameEn: relation.tags?.['name:en'] ?? null,
      adminLevel: parseInt(relation.tags?.admin_level || '0'),
      tags: relation.tags || {},
      source: 'OpenStreetMap',
      timestamp: Date.now(),
    },
    geometry: { type: 'Polygon', coordinates: [coordinates] },
  };
}

/**
 * Convert Overpass response to a GeoJSON FeatureCollection.
 */
export function convertToFeatureCollection(response: OverpassAdminResponse): FeatureCollection | null {
  if (!response.elements || response.elements.length === 0) {
    return null;
  }

  const features: Feature[] = [];

  for (const element of response.elements) {
    if (element.geometry && element.geometry.length > 0) {
      const coordinates: GeoJSONPosition[] = element.geometry.map(
        (point) => [point.lon, point.lat] as GeoJSONPosition
      );

      closePolygon(coordinates);

      features.push({
        type: 'Feature',
        properties: {
          id: element.id.toString(),
          name: element.tags?.name || element.tags?.['name:el'] || 'Unknown',
          nameEn: element.tags?.['name:en'] ?? null,
          adminLevel: parseInt(element.tags?.admin_level || '0'),
          tags: element.tags || {},
          source: 'OpenStreetMap',
          timestamp: Date.now(),
        },
        geometry: { type: 'Polygon', coordinates: [coordinates] },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

// ============================================================================
// SEARCH RESULT CONVERSION
// ============================================================================

/**
 * Convert Overpass response to administrative search results.
 */
export function convertToSearchResults(
  response: OverpassAdminResponse,
  searchTerm: string
): AdminSearchResult[] {
  if (!response.elements || response.elements.length === 0) {
    return [];
  }

  return response.elements
    .filter(element => element.tags && element.geometry)
    .map(element => {
      const tags = element.tags!;
      const name = tags.name || tags['name:el'] || 'Unknown';
      const adminLevel = parseInt(tags.admin_level || '0') as GreekAdminLevel;

      const confidence = calculateSearchConfidence(name, searchTerm);

      const hierarchy = {
        country: 'Ελλάδα',
        region: extractRegionFromTags(tags),
        municipality: adminLevel === GreekAdminLevel.MUNICIPALITY ? name : undefined,
      };

      const bounds = extractBoundsFromGeometry(element);

      return { id: element.id.toString(), name, nameEn: tags['name:en'], adminLevel, hierarchy, confidence, bounds };
    })
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Convert Overpass response to postal code search results.
 */
export function convertToPostalCodeSearchResults(
  response: OverpassAdminResponse,
  searchTerm: string
): AdminSearchResult[] {
  if (!response.elements || response.elements.length === 0) {
    return [];
  }

  return response.elements
    .filter(element => element.tags)
    .map(element => {
      const tags = element.tags!;
      const postalCode = tags.postal_code || tags['addr:postcode'] || 'Unknown';
      const name = `Τ.Κ. ${postalCode}`;
      const adminLevel = GreekAdminLevel.POSTAL_CODE;

      const confidence = calculatePostalCodeConfidence(postalCode, searchTerm);

      const hierarchy = {
        country: 'Ελλάδα',
        region: extractRegionFromTags(tags),
        municipality: tags.municipality || tags['is_in:municipality'] || tags.city,
        community: tags.suburb || tags.neighbourhood,
      };

      let bounds: BoundingBox | undefined;
      if (element.geometry && element.geometry.length > 0) {
        bounds = extractBoundsFromGeometry(element);
      } else if (element.type === 'node' && typeof element.lat === 'number' && typeof element.lon === 'number') {
        bounds = {
          north: element.lat + 0.001,
          south: element.lat - 0.001,
          east: element.lon + 0.001,
          west: element.lon - 0.001,
        };
      }

      return {
        id: `postal-${element.id}`,
        name,
        nameEn: `Postal Code ${postalCode}`,
        adminLevel,
        hierarchy,
        confidence,
        bounds,
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
}

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

export function calculateSearchConfidence(name: string, searchTerm: string): number {
  const nameLower = name.toLowerCase();
  const termLower = searchTerm.toLowerCase();

  if (nameLower === termLower) return 1.0;
  if (nameLower.startsWith(termLower)) return 0.9;
  if (nameLower.includes(termLower)) return 0.8;

  const distance = levenshteinDistance(nameLower, termLower);
  const maxLen = Math.max(nameLower.length, termLower.length);
  return Math.max(0, 1 - distance / maxLen);
}

export function calculatePostalCodeConfidence(postalCode: string, searchTerm: string): number {
  const codeStr = postalCode.toString();
  const termStr = searchTerm.toString();

  if (codeStr === termStr) return 1.0;
  if (codeStr.startsWith(termStr)) return 0.9 - (codeStr.length - termStr.length) * 0.1;
  if (codeStr.includes(termStr)) return 0.7;

  const distance = levenshteinDistance(codeStr, termStr);
  const maxLen = Math.max(codeStr.length, termStr.length);
  return Math.max(0, 0.6 - distance / maxLen);
}

// ============================================================================
// HELPERS
// ============================================================================

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }

  return matrix[str2.length][str1.length];
}

function extractRegionFromTags(tags: Record<string, string>): string {
  return tags['is_in:state'] || tags['is_in:region'] || tags.state || 'Unknown';
}

function closePolygon(coordinates: GeoJSONPosition[]): void {
  if (coordinates.length > 0) {
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coordinates.push([first[0], first[1]] as GeoJSONPosition);
    }
  }
}

// Type-safe geometry element interface for extractBoundsFromGeometry
interface GeometryElement {
  geometry?: { lat: number; lon: number }[];
}

function extractBoundsFromGeometry(element: GeometryElement): BoundingBox | undefined {
  if (!element.geometry || element.geometry.length === 0) return undefined;

  const lats = element.geometry.map(p => p.lat);
  const lngs = element.geometry.map(p => p.lon);

  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  };
}
