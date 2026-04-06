/**
 * ADMINISTRATIVE BOUNDARY — UTILITY FUNCTIONS
 * Pure standalone utilities for search normalization, type detection,
 * geometry operations, and fuzzy matching.
 * Extracted from AdministrativeBoundaryService.ts (ADR-065).
 */

import {
  MajorGreekRegions,
  MajorGreekMunicipalities,
} from '../../types/administrative-types';

type Geometry = GeoJSON.Geometry;
type Position = GeoJSON.Position;

// ============================================================================
// SEARCH NORMALIZATION
// ============================================================================

export function normalizeSearchTerm(term: string): string {
  return term
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[άα]/g, 'α')
    .replace(/[έε]/g, 'ε')
    .replace(/[ήη]/g, 'η')
    .replace(/[ίι]/g, 'ι')
    .replace(/[όο]/g, 'ο')
    .replace(/[ύυ]/g, 'υ')
    .replace(/[ώω]/g, 'ω');
}

// ============================================================================
// TYPE DETECTION
// ============================================================================

export function detectAdministrativeType(
  query: string
): 'municipality' | 'region' | 'general' | null {
  const queryLower = query.toLowerCase();

  const municipalityKeywords = ['δήμος', 'δημος', 'municipality', 'δ.', 'δήμ.'];
  const regionKeywords = ['περιφέρεια', 'περιφερεια', 'region', 'περιφ.', 'π.'];

  for (const keyword of municipalityKeywords) {
    if (queryLower.includes(keyword)) return 'municipality';
  }
  for (const keyword of regionKeywords) {
    if (queryLower.includes(keyword)) return 'region';
  }

  if (isKnownMunicipality(query)) return 'municipality';
  if (isKnownRegion(query)) return 'region';

  return 'general';
}

export function extractMunicipalityName(query: string): string {
  let name = query
    .replace(/δήμος\s*/gi, '')
    .replace(/δημος\s*/gi, '')
    .replace(/municipality\s*/gi, '')
    .replace(/δ\.\s*/gi, '')
    .trim();

  if (!name.toLowerCase().startsWith('δήμος')) {
    name = `Δήμος ${name}`;
  }
  return name;
}

export function extractRegionName(query: string): string {
  return query
    .replace(/περιφέρεια\s*/gi, '')
    .replace(/περιφερεια\s*/gi, '')
    .replace(/region\s*/gi, '')
    .replace(/περιφ\.\s*/gi, '')
    .replace(/π\.\s*/gi, '')
    .trim();
}

export function isKnownMunicipality(query: string): boolean {
  const queryLower = query.toLowerCase();
  const knownMunicipalities = Object.values(MajorGreekMunicipalities).map((m) =>
    m.toLowerCase()
  );
  return knownMunicipalities.some(
    (m) => queryLower.includes(m) || m.includes(queryLower)
  );
}

export function isKnownRegion(query: string): boolean {
  const queryLower = query.toLowerCase();
  const knownRegions = Object.values(MajorGreekRegions).map((r) => r.toLowerCase());
  return knownRegions.some(
    (r) => queryLower.includes(r) || r.includes(queryLower)
  );
}

// ============================================================================
// GEOMETRY OPERATIONS
// ============================================================================

export function getPolygonRings(geometry: Geometry): Position[][] | null {
  if (geometry.type !== 'Polygon') return null;
  const coordinates = geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length === 0) return null;
  if (!Array.isArray(coordinates[0])) return null;
  return coordinates as Position[][];
}

export function calculateBoundaryCenter(geometry: Geometry): [number, number] | null {
  const rings = getPolygonRings(geometry);
  if (!rings || rings.length === 0) return null;

  const coordinates = rings[0];
  if (coordinates.length === 0) return null;

  const lngs = coordinates.map((coord) => coord[0]);
  const lats = coordinates.map((coord) => coord[1]);

  const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
  const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;

  return [centerLng, centerLat];
}

export function simplifyBoundary(geometry: Geometry, tolerance = 0.001): Geometry {
  if (geometry.type !== 'Polygon') return geometry;

  const rings = getPolygonRings(geometry);
  if (!rings) return geometry;

  const simplified = rings.map((ring) => simplifyRing(ring, tolerance));

  return { ...geometry, coordinates: simplified } as GeoJSON.Polygon;
}

export function simplifyRing(ring: Position[], tolerance: number): Position[] {
  if (ring.length <= 2) return ring;

  const simplified = [ring[0]];

  for (let i = 1; i < ring.length - 1; i++) {
    const distance = pointToLineDistance(ring[i], ring[i - 1], ring[i + 1]);
    if (distance > tolerance) {
      simplified.push(ring[i]);
    }
  }

  simplified.push(ring[ring.length - 1]);
  return simplified;
}

export function pointToLineDistance(
  point: Position,
  lineStart: Position,
  lineEnd: Position
): number {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  if (lenSq === 0) return Math.sqrt(A * A + B * B);

  const param = dot / lenSq;
  let xx: number, yy: number;

  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; yy = y1 + param * D; }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

// ============================================================================
// GEO CHECKS
// ============================================================================

export function isWithinGreece(lat: number, lng: number): boolean {
  return lat >= 34.5 && lat <= 42.0 && lng >= 19.0 && lng <= 29.5;
}

export function isInAthenMetropolitanArea(location: { lat: number; lng: number }): boolean {
  return location.lat >= 37.8 && location.lat <= 38.2 &&
         location.lng >= 23.5 && location.lng <= 24.1;
}

export function isInThessalonikiArea(location: { lat: number; lng: number }): boolean {
  return location.lat >= 40.5 && location.lat <= 40.7 &&
         location.lng >= 22.8 && location.lng <= 23.2;
}

// ============================================================================
// FUZZY MATCHING
// ============================================================================

export function calculateLevenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

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

export function fuzzyMatch(text: string, query: string, threshold = 0.8): boolean {
  const distance = calculateLevenshteinDistance(text, query);
  const similarity = 1 - distance / Math.max(text.length, query.length);
  return similarity >= threshold;
}
