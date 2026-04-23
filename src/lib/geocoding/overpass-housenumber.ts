/**
 * Overpass housenumber fallback — ADR-277 (map-drag reverse geocoding).
 *
 * Nominatim reverse frequently omits `addr:housenumber` for Greek roads
 * (OSM data gap). This helper queries the public Overpass API for the
 * nearest building/node tagged with both `addr:street` matching our
 * resolved street name and `addr:housenumber`, within a small radius.
 *
 * Server-only. Nominatim contract already rate-limits the parent route,
 * so we only hit Overpass when `addr.house_number` is missing.
 */

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('overpass-housenumber');

const OVERPASS_BASE_URL = process.env.OVERPASS_BASE_URL || 'https://overpass-api.de/api/interpreter';
const OVERPASS_TIMEOUT_MS = parseInt(process.env.OVERPASS_TIMEOUT_MS || '6000', 10);
const OVERPASS_RADIUS_METERS = parseInt(process.env.OVERPASS_RADIUS_METERS || '40', 10);
const USER_AGENT = process.env.GEOCODING_USER_AGENT || 'NestorPagonisApp/1.0 (geocoding)';

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/**
 * Haversine distance in meters — small-enough radius that flat-earth would also
 * suffice, but the formula is cheap and keeps us honest at the poles.
 */
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function buildOverpassQuery(lat: number, lon: number, street: string | undefined, radius: number): string {
  const streetFilter = street?.trim()
    ? `["addr:street"="${street.replace(/"/g, '\\"')}"]`
    : '';
  return `
    [out:json][timeout:${Math.floor(OVERPASS_TIMEOUT_MS / 1000)}];
    (
      node["addr:housenumber"]${streetFilter}(around:${radius},${lat},${lon});
      way["addr:housenumber"]${streetFilter}(around:${radius},${lat},${lon});
    );
    out center tags;
  `.trim();
}

/**
 * Look up the nearest OSM addr:housenumber to (lat, lon). If `street` is
 * provided it narrows the match to that road. Returns `null` when no tagged
 * address is within radius (or Overpass errors out — callers should treat
 * a missing number as acceptable rather than hard-failing).
 */
export async function findNearestHouseNumber(
  lat: number,
  lon: number,
  street: string | undefined,
): Promise<string | null> {
  const query = buildOverpassQuery(lat, lon, street, OVERPASS_RADIUS_METERS);

  try {
    const response = await fetch(OVERPASS_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn('Overpass non-OK response', { data: { status: response.status } });
      return null;
    }

    const data = (await response.json()) as OverpassResponse;
    const elements = data.elements ?? [];
    if (elements.length === 0) {
      // Retry without street filter — Nominatim's road name may differ
      // slightly from OSM's `addr:street` (abbreviations, accents).
      if (street?.trim()) {
        return findNearestHouseNumber(lat, lon, undefined);
      }
      return null;
    }

    const withCoords = elements
      .map(el => {
        const elLat = el.lat ?? el.center?.lat;
        const elLon = el.lon ?? el.center?.lon;
        const housenumber = el.tags?.['addr:housenumber'];
        if (elLat === undefined || elLon === undefined || !housenumber) return null;
        return {
          housenumber,
          distance: distanceMeters(lat, lon, elLat, elLon),
        };
      })
      .filter((e): e is { housenumber: string; distance: number } => e !== null)
      .sort((a, b) => a.distance - b.distance);

    return withCoords[0]?.housenumber ?? null;
  } catch (error) {
    logger.warn('Overpass fetch error', { error: getErrorMessage(error) });
    return null;
  }
}
