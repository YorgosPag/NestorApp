/**
 * Overpass housenumber fallback — ADR-277 (map-drag reverse geocoding).
 *
 * Nominatim reverse frequently omits `addr:housenumber` for Greek roads
 * (OSM data gap). This helper queries the public Overpass API for the
 * nearest building/node tagged with `addr:housenumber`, preferring our
 * resolved street name, within a small radius.
 *
 * Server-only. Nominatim contract already rate-limits the parent route,
 * so we only hit Overpass when `addr.house_number` is missing.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ADR-332 D27 Β13 — ΕΝΑ ΕΡΩΤΗΜΑ, ΟΧΙ ΤΡΙΑ ΔΙΑΔΟΧΙΚΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως τις 2026-09-10 οι τρεις βαθμίδες ήταν **τρία αιτήματα στη σειρά** (οδός+60 μ. → 60 μ. →
 * 120 μ.), το καθένα με έως τρεις προσπάθειες — ο διάλογος συρσίματος μετρήθηκε στα 24–38″. Όμως
 * το ερώτημα των 120 μ. χωρίς φίλτρο οδού **περιέχει** τα άλλα δύο. Τώρα ρωτάμε **μία** φορά και
 * διαλέγουμε τη βαθμίδα στη μνήμη, με την ίδια σειρά. Είναι και πιο φιλικό στον κοινό Overpass
 * (ODbL §13.4: μία ανθρώπινη χειρονομία = ένα αίτημα).
 *
 * ⚠️ **Δηλωμένη διαφορά**: στις δύο πρώτες βαθμίδες το «μέσα στα 60 μ.» κρίνεται πλέον με την
 * απόσταση του **κέντρου** του στοιχείου — το ίδιο μέτρο με το οποίο ήδη γινόταν η κατάταξη. Πριν,
 * το `around` του Overpass μετρούσε τη **γεωμετρία**: ένα μεγάλο κτίριο με άκρη στα 55 μ. και κέντρο
 * στα 70 μ. έμπαινε στη βαθμίδα 2. Η βαθμίδα 3 (ο πλησιέστερος απ' όλους) είναι ταυτόσημη.
 */

import { createModuleLogger } from '@/lib/telemetry';
import { distanceMeters } from '@/lib/geo/geo-distance';
import type { Deadline } from '@/lib/async-utils';
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

// ⚠️ Η **απόσταση** δεν ζει εδώ: `@/lib/geo/geo-distance` (SSoT).

function buildOverpassQuery(lat: number, lon: number, radius: number, seconds: number): string {
  // Includes all three OSM shapes that can carry `addr:housenumber`:
  //   - node (a point tagged with the number, e.g. an entrance)
  //   - way (usually a building polygon — by far the densest source in Greek cities)
  //   - relation (multi-part buildings or addresses with multiple parts)
  // `out center tags` returns the geometric centroid for ways/relations so we can
  // measure distance uniformly — and the `addr:street` tag the first tier needs.
  return `
    [out:json][timeout:${seconds}];
    (
      node["addr:housenumber"](around:${radius},${lat},${lon});
      way["addr:housenumber"](around:${radius},${lat},${lon});
      relation["addr:housenumber"](around:${radius},${lat},${lon});
    );
    out center tags;
  `.trim();
}

interface NumberedCandidate {
  readonly housenumber: string;
  readonly street: string | undefined;
  readonly distance: number;
}

/** Τα στοιχεία με αριθμό, με την απόστασή τους — **ταξινομημένα**, ο πλησιέστερος πρώτος. */
function toCandidates(elements: readonly OverpassElement[], lat: number, lon: number): NumberedCandidate[] {
  return elements
    .map((el) => {
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      const housenumber = el.tags?.['addr:housenumber'];
      if (elLat === undefined || elLon === undefined || !housenumber) return null;
      return {
        housenumber,
        street: el.tags?.['addr:street'],
        distance: distanceMeters({ lat, lng: lon }, { lat: elLat, lng: elLon }),
      };
    })
    .filter((e): e is NumberedCandidate => e !== null)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Οι τρεις βαθμίδες, **με τη σειρά τους**:
 *   1. ίδια οδός (ακριβής ισότητα, όπως έκανε το φίλτρο `["addr:street"=…]`) μέσα στα 60 μ.
 *   2. οποιοσδήποτε αριθμός μέσα στα 60 μ. (τα κτίρια του OSM συχνά δεν έχουν `addr:street`)
 *   3. ο πλησιέστερος απ' όλους (αστικά τετράγωνα, πινέζα λίγα μέτρα έξω από το κτίριο)
 */
function pickTier(candidates: readonly NumberedCandidate[], street: string | undefined) {
  const sameStreet = street?.trim()
    ? candidates.find((c) => c.distance <= OVERPASS_RADIUS_METERS && c.street === street)
    : undefined;
  if (sameStreet) return { tier: 1, candidate: sameStreet } as const;
  const near = candidates.find((c) => c.distance <= OVERPASS_RADIUS_METERS);
  if (near) return { tier: 2, candidate: near } as const;
  return candidates[0] ? ({ tier: 3, candidate: candidates[0] } as const) : null;
}

/**
 * Look up the nearest OSM addr:housenumber to (lat, lon) — **ένα** αίτημα.
 *
 * Returns `null` when nothing is tagged nearby **or** the provider did not answer within the
 * deadline — callers must treat both as "let the user type it" (ο άνθρωπος κρατά τον αριθμό του).
 */
export async function findNearestHouseNumber(
  lat: number,
  lon: number,
  street: string | undefined,
  options: { readonly deadline?: Deadline } = {},
): Promise<string | null> {
  const seconds = overpassQuerySeconds(options.deadline?.remainingMs());
  const elements = await runOverpassQuery(
    buildOverpassQuery(lat, lon, OVERPASS_FALLBACK_RADIUS_METERS, seconds),
    options,
  );
  const picked = pickTier(toCandidates(elements, lat, lon), street);
  if (!picked) {
    logger.info('Overpass housenumber: no match', {
      data: { lat, lon, street, radius: OVERPASS_FALLBACK_RADIUS_METERS },
    });
    return null;
  }
  logger.info('Overpass housenumber hit', {
    data: { tier: picked.tier, housenumber: picked.candidate.housenumber, distance: picked.candidate.distance },
  });
  return picked.candidate.housenumber;
}
