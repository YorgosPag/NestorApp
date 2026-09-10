/**
 * Pure helpers extracted from `useAddressMapGeocoding.ts` to keep the hook
 * file under the 500-line Google SRP threshold (CLAUDE.md N.7.1).
 *
 *  - `reverseResultToAddress` — Nominatim reverse → form-friendly partial.
 *  - `findReferencePosition` — first available pin position for fallback fits.
 *  - `displayedPosition` / `parentPointKey` / `dropSupersededOverrides` — ο χάρτης είναι
 *    **ελεγχόμενος**: τη θέση την αποφασίζει ο γονιός (ADR-332 D27 Β12).
 */

import type { ProjectAddress, PartialProjectAddress } from '@/types/project/addresses';
import type {
  GeocodingServiceResult,
  ReverseGeocodingResult,
} from '@/lib/geocoding/geocoding-service';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import type { DragPosition } from '@/components/shared/addresses/address-map-config';

/**
 * ADR-277: keep `street` and `number` separate so downstream consumers
 * (`handleDragUpdate`) don't have to re-split a pre-concatenated string.
 *
 * 🔴 ADR-332 D27 — the position is the **drop point**, never `result.lat/lng`.
 * The reverse proxy returns the point of the OSM object Nominatim matched: for
 * «Σαμοθράκης 16» that is the street way, **19.5 m** from the door where the
 * human let go (measured 2026-09-10). Taking it stored the machine's point as
 * `source: 'dragged'`. The reverse geocode answers «what is written here», not
 * «where is it» — that answer belongs to the hand.
 */
export function reverseResultToAddress(
  result: ReverseGeocodingResult,
  dropPoint: DragPosition,
): Partial<PartialProjectAddress> {
  return {
    street: result.street,
    number: result.number || undefined,
    city: result.city,
    neighborhood: result.neighborhood || undefined,
    postalCode: result.postalCode,
    region: result.region || undefined,
    country: result.country || GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY,
    coordinates: { lat: dropPoint.lat, lng: dropPoint.lng },
  };
}

/** Find the first available reference position from addresses (drag > geocoded) */
export function findReferencePosition(
  addresses: ProjectAddress[],
  dragPositions: Map<string, DragPosition>,
  geocodedAddresses: Map<string, GeocodingServiceResult>,
): DragPosition | null {
  for (const addr of addresses) {
    const dp = dragPositions.get(addr.id);
    if (dp) return dp;
    const gc = geocodedAddresses.get(addr.id);
    if (gc) return { lng: gc.lng, lat: gc.lat };
  }
  return null;
}

// =============================================================================
// ΕΛΕΓΧΟΜΕΝΟΣ ΧΑΡΤΗΣ — ADR-332 D27 Β12
// =============================================================================

/** Το σημείο που δίνει ο γονιός. `0` είναι υπαρκτή τιμή — μόνο η απουσία είναι απουσία. */
export function storedPoint(addr: ProjectAddress): DragPosition | null {
  const lat = addr.coordinates?.lat;
  const lng = addr.coordinates?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Το σημείο του γονιού ως κλειδί σύγκρισης — `''` όταν δεν δίνει σημείο. */
export function parentPointKey(addr: ProjectAddress): string {
  const point = storedPoint(addr);
  return point ? `${point.lat},${point.lng}` : '';
}

/**
 * Κρατά **μόνο** τις υπερισχύσεις χειρονομίας που ο γονιός **δεν** αντικατέστησε.
 *
 * id που χάθηκε, ή που ο γονιός του έδωσε **άλλο** σημείο (επιβεβαίωση · αποθήκευση · αναίρεση)
 * ⇒ η υπερίσχυση φεύγει και ο χάρτης δείχνει ό,τι λέει ο γονιός. Ίδια αναφορά όταν δεν αλλάζει
 * τίποτα, ώστε να μην προκαλεί άσκοπη απόδοση.
 */
export function dropSupersededOverrides(
  overrides: Map<string, DragPosition>,
  previous: ReadonlyMap<string, string>,
  next: ReadonlyMap<string, string>,
): Map<string, DragPosition> {
  let changed = false;
  const kept = new Map<string, DragPosition>();
  overrides.forEach((position, id) => {
    if (next.has(id) && next.get(id) === previous.get(id)) kept.set(id, position);
    else changed = true;
  });
  return changed ? kept : overrides;
}

/**
 * **Πού ζωγραφίζεται** μια πινέζα: η χειρονομία σε εξέλιξη → το σημείο του γονιού → η
 * γεωκωδικοποίηση **οθόνης** (μόνο διευθύνσεις χωρίς σημείο) → πουθενά.
 *
 * 🔑 Το σημείο του γονιού διαβάζεται **απευθείας** και όχι από το `geocodedAddresses`, που
 * ακολουθεί με καθυστέρηση 500 ms: αλλιώς, μόλις σβήσει η υπερίσχυση, η πινέζα θα πηδούσε για
 * μισό δευτερόλεπτο στο **παλιό** σημείο.
 */
export function displayedPosition(
  addr: ProjectAddress,
  dragPos: DragPosition | undefined,
  geocoded: Pick<GeocodingServiceResult, 'lat' | 'lng'> | undefined,
): DragPosition | null {
  return dragPos ?? storedPoint(addr) ?? (geocoded ? { lng: geocoded.lng, lat: geocoded.lat } : null);
}
