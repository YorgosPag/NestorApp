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
import { distanceMeters } from '@/lib/geo/geo-distance';
import {
  overpassQuerySeconds,
  runOverpassQuery,
  type OverpassElement,
} from '@/lib/geo/osm/overpass-client';

const logger = createModuleLogger('overpass-housenumber');

// ⚠️ **Οι ακτίνες μένουν ΕΔΩ, ο μεταφορέας έφυγε.** Είναι η στρατηγική **αυτής** της
// ερώτησης («πόσο μακριά δέχομαι να ψάξω για αριθμό»), όχι ιδιότητα του Overpass. Το
// endpoint, το χρονόμετρο και ο χειρισμός σφάλματος ζουν στο `lib/geo/osm/overpass-client`.
const OVERPASS_RADIUS_METERS = parseInt(process.env.OVERPASS_RADIUS_METERS || '60', 10);
const OVERPASS_FALLBACK_RADIUS_METERS = parseInt(process.env.OVERPASS_FALLBACK_RADIUS_METERS || '120', 10);

// ⚠️ Η **απόσταση** δεν ζει πια εδώ: `@/lib/geo/geo-distance` (SSoT). Ήταν μία από
// τέσσερις υλοποιήσεις με δύο ακτίνες Γης — και εδώ χρησιμοποιείται μόνο για να
// **διαλέξει τον πλησιέστερο**, δηλαδή ομοιόμορφος συντελεστής κλίμακας: η επιλογή
// είναι κατά λέξη η ίδια.

function buildOverpassQuery(lat: number, lon: number, street: string | undefined, radius: number): string {
  const streetFilter = street?.trim()
    ? `["addr:street"="${street.replace(/"/g, '\\"')}"]`
    : '';
  // Includes all three OSM shapes that can carry `addr:housenumber`:
  //   - node (a point tagged with the number, e.g. an entrance)
  //   - way (usually a building polygon — by far the densest source in Greek cities)
  //   - relation (multi-part buildings or addresses with multiple parts)
  // `out center tags` returns the geometric centroid for ways/relations so we can
  // measure distance uniformly.
  return `
    [out:json][timeout:${overpassQuerySeconds()}];
    (
      node["addr:housenumber"]${streetFilter}(around:${radius},${lat},${lon});
      way["addr:housenumber"]${streetFilter}(around:${radius},${lat},${lon});
      relation["addr:housenumber"]${streetFilter}(around:${radius},${lat},${lon});
    );
    out center tags;
  `.trim();
}

function pickNearest(
  elements: readonly OverpassElement[],
  lat: number,
  lon: number,
): string | null {
  const withCoords = elements
    .map(el => {
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      const housenumber = el.tags?.['addr:housenumber'];
      if (elLat === undefined || elLon === undefined || !housenumber) return null;
      return {
        housenumber,
        distance: distanceMeters({ lat, lng: lon }, { lat: elLat, lng: elLon }),
      };
    })
    .filter((e): e is { housenumber: string; distance: number } => e !== null)
    .sort((a, b) => a.distance - b.distance);
  return withCoords[0]?.housenumber ?? null;
}

/**
 * Look up the nearest OSM addr:housenumber to (lat, lon).
 *
 * Three-pass strategy (widens the net progressively):
 *   1. Tight radius + `addr:street` filter — safest match.
 *   2. Same radius, no street filter — OSM housenumber tags on buildings
 *      frequently lack `addr:street` (the street is implied by position).
 *   3. Wider radius, no street filter — urban blocks where the dropped pin
 *      is a few meters off the nearest tagged building.
 *
 * Returns `null` only when all three passes are empty — callers must treat
 * that as "OSM genuinely has no number here, let the user type it".
 */
export async function findNearestHouseNumber(
  lat: number,
  lon: number,
  street: string | undefined,
): Promise<string | null> {
  // Pass 1 — tight radius + street filter
  if (street?.trim()) {
    const pass1 = await runOverpassQuery(
      buildOverpassQuery(lat, lon, street, OVERPASS_RADIUS_METERS),
    );
    const hit1 = pickNearest(pass1, lat, lon);
    if (hit1) {
      logger.info('Overpass housenumber pass 1 hit', { data: { pass: 1, housenumber: hit1 } });
      return hit1;
    }
  }

  // Pass 2 — tight radius, no street filter (buildings often lack addr:street)
  const pass2 = await runOverpassQuery(
    buildOverpassQuery(lat, lon, undefined, OVERPASS_RADIUS_METERS),
  );
  const hit2 = pickNearest(pass2, lat, lon);
  if (hit2) {
    logger.info('Overpass housenumber pass 2 hit', { data: { pass: 2, housenumber: hit2 } });
    return hit2;
  }

  // Pass 3 — wider radius, last resort
  const pass3 = await runOverpassQuery(
    buildOverpassQuery(lat, lon, undefined, OVERPASS_FALLBACK_RADIUS_METERS),
  );
  const hit3 = pickNearest(pass3, lat, lon);
  if (hit3) {
    logger.info('Overpass housenumber pass 3 hit', { data: { pass: 3, housenumber: hit3 } });
    return hit3;
  }

  logger.info('Overpass housenumber: no match across 3 passes', {
    data: { lat, lon, street, radius: OVERPASS_FALLBACK_RADIUS_METERS },
  });
  return null;
}
