/**
 * =============================================================================
 * 🗺️ REVERSE GEOCODING API — Server-side Nominatim Reverse Proxy
 * =============================================================================
 *
 * Server-side reverse geocoding proxy that:
 * - Accepts lat/lon query parameters
 * - Calls Nominatim reverse API with proper User-Agent (TOS)
 * - Validates coordinates are finite and on the globe
 * - Returns structured address data for form population
 * - Rate limited: withHeavyRateLimit (10 req/min)
 *
 * ⚠️ ADR-332 D27 Β13 — εδώ έγραφε «Validates coordinates within Greek bounding box», και ο
 * κώδικας **δεν το έκανε ποτέ**. Η υπόσχεση αφαιρέθηκε αντί να υλοποιηθεί: ο ίδιος χάρτης
 * σέρνεται και για επαφές σε Κύπρο / Βουλγαρία (ADR-332 D12), που ένα ελληνικό πλαίσιο θα απέρριπτε.
 *
 * 🔑 **ΜΙΑ ΠΡΟΘΕΣΜΙΑ ΓΙΑ ΟΛΟ ΤΟ ΑΙΤΗΜΑ** (Β13 · Google SRE «deadline propagation»). Ως τις
 * 2026-09-10 το Nominatim είχε 8″ και μετά έτρεχαν έως **τρία διαδοχικά** Overpass των έως τριών
 * προσπαθειών × 6″ — μετρημένα 24–38″ στον διάλογο. Τώρα το αίτημα έχει **ένα** απόλυτο όριο
 * (`GEOCODING.REVERSE_BUDGET_MS`) και κάθε στάδιο παίρνει **ό,τι απομένει**. Αν τελειώσει ο χρόνος
 * πριν βρεθεί αριθμός, η απάντηση φεύγει **χωρίς** αριθμό — ίδιο με «το OSM δεν έχει αριθμό εδώ».
 *
 * 🔴 **Τρεις εκβάσεις, όχι δύο**: «ο πάροχος δεν απάντησε» έφευγε ως **404** («εδώ δεν γράφει
 * τίποτα») και ο διάλογος έλεγε ψέματα στον άνθρωπο. Πλέον φεύγει ως **503**.
 *
 * @module app/api/geocoding/reverse/route
 * @see geographic-config.ts, geocoding-service.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { createDeadline, type Deadline } from '@/lib/async-utils';
import { findNearestHouseNumber } from '@/lib/geocoding/overpass-housenumber';
import { toCanonicalGreekPostalCode } from '@/utils/address/postal-code';
import { cleanPlaceName } from '@/utils/address/place-name';

const logger = createModuleLogger('reverse-geocoding-api');

// Vercel serverless timeout
export const maxDuration = 15;

// =============================================================================
// TYPES
// =============================================================================

/** Nominatim reverse response address details */
interface NominatimReverseAddress {
  road?: string;
  house_number?: string;
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  neighbourhood?: string;
  postcode?: string;
  state?: string;
  country?: string;
}

interface NominatimReverseResult {
  lat: string;
  lon: string;
  display_name: string;
  address: NominatimReverseAddress;
}

/** Τι είπε το Nominatim — **τρεις** εκβάσεις (ίδιο συμβόλαιο με το `geocodeWithVerdict`). */
type NominatimLookup =
  | { readonly kind: 'found'; readonly result: NominatimReverseResult }
  /** Απάντησε: σε αυτό το σημείο δεν γράφει τίποτα. */
  | { readonly kind: 'absent' }
  /** Δεν απάντησε (λήξη · όριο ρυθμού · σφάλμα). */
  | { readonly kind: 'unavailable' };

interface ReverseGeocodingApiResponse {
  street: string;
  number: string;
  city: string;
  neighborhood: string;
  postalCode: string;
  region: string;
  country: string;
  displayName: string;
  lat: number;
  lng: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const USER_AGENT = process.env.GEOCODING_USER_AGENT || 'NestorPagonisApp/1.0 (geocoding)';
const NOMINATIM_TIMEOUT_MS = parseInt(process.env.GEOCODING_TIMEOUT_MS || '8000', 10);
const { GEOCODING } = GEOGRAPHIC_CONFIG;

// =============================================================================
// VALIDATION
// =============================================================================

function isValidLatLon(lat: number, lon: number): boolean {
  if (Number.isNaN(lat) || Number.isNaN(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  return true;
}

// =============================================================================
// NOMINATIM REVERSE LOOKUP
// =============================================================================

function buildReverseUrl(lat: number, lon: number): string {
  const searchParams = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    format: 'json',
    addressdetails: '1',
    'accept-language': GEOCODING.ACCEPT_LANGUAGE,
  });

  return `${NOMINATIM_BASE_URL}/reverse?${searchParams.toString()}`;
}

async function fetchNominatimReverse(url: string, deadline: Deadline): Promise<NominatimLookup> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      // Β13: το δικό του όριο, ή λιγότερο αν τελειώνει η προθεσμία του αιτήματος.
      signal: AbortSignal.timeout(Math.min(NOMINATIM_TIMEOUT_MS, deadline.remainingMs())),
    });

    if (!response.ok) {
      logger.warn('Nominatim reverse non-OK response', { data: { status: response.status } });
      return { kind: 'unavailable' };
    }

    const data: NominatimReverseResult = await response.json();

    // Nominatim returns { error: "Unable to geocode" } — μια ΑΠΑΝΤΗΣΗ, όχι βλάβη.
    if (!data.address) {
      logger.warn('Nominatim reverse returned no address');
      return { kind: 'absent' };
    }

    return { kind: 'found', result: data };
  } catch (error) {
    logger.warn('Nominatim reverse fetch error', { error: getErrorMessage(error) });
    return { kind: 'unavailable' };
  }
}

function formatReverseResult(result: NominatimReverseResult): ReverseGeocodingApiResponse {
  const addr = result.address;

  // For Greek addresses, suburb = actual settlement (Ελευθέριο Κορδελιό)
  // city/town = municipality level (Δήμος Κορδελιού-Ευόσμου)
  // Prefer suburb > neighbourhood > village > town > city (most specific first)
  const rawCity = addr.suburb ?? addr.neighbourhood ?? addr.village ?? addr.town ?? addr.city ?? '';
  const rawNeighborhood = addr.suburb ?? addr.neighbourhood ?? '';

  return {
    street: addr.road ?? '',
    number: addr.house_number ?? '',
    // ADR-332 D27 Βήμα Β (Β7): ο ΕΝΑΣ κανόνας ονομάτων τόπου (`utils/address/place-name`).
    city: cleanPlaceName(rawCity),
    neighborhood: cleanPlaceName(rawNeighborhood),
    // Κανονική μορφή στο σύνορο του παρόχου — το OSM Ελλάδας γράφει «546 24»
    // και η τιμή κατέληγε αυτούσια στη φόρμα και στη βάση (ADR-332 D16).
    postalCode: toCanonicalGreekPostalCode(addr.postcode),
    region: addr.state ?? '',
    country: addr.country ?? '',
    displayName: result.display_name,
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
  };
}

/**
 * Συμπληρώνει τον αριθμό από το Overpass όταν λείπει — με **ό,τι απομένει** από την προθεσμία.
 * OSM Greek coverage frequently omits `addr:housenumber`.
 */
async function fillHouseNumber(
  formatted: ReverseGeocodingApiResponse,
  lat: number,
  lon: number,
  deadline: Deadline,
): Promise<{ nominatimNumber: string; overpassNumber: string | null }> {
  const nominatimNumber = formatted.number;
  const overpassNumber = nominatimNumber
    ? null
    : await findNearestHouseNumber(lat, lon, formatted.street, { deadline });
  if (overpassNumber) formatted.number = overpassNumber;

  logger.info('Reverse geocoding housenumber resolution', {
    data: {
      lat,
      lon,
      street: formatted.street,
      nominatimNumber,
      overpassNumber,
      finalNumber: formatted.number,
      remainingMs: deadline.remainingMs(),
    },
  });
  return { nominatimNumber, overpassNumber };
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/** Η αντίστροφη γεωκωδικοποίηση **μέσα** σε μία προθεσμία. */
async function reverseWithin(lat: number, lon: number, debug: boolean, deadline: Deadline): Promise<Response> {
  logger.info('Reverse geocoding request', { data: { lat, lon } });

  const lookup = await fetchNominatimReverse(buildReverseUrl(lat, lon), deadline);
  if (lookup.kind === 'absent') {
    return NextResponse.json({ error: 'No address found at this location' }, { status: 404 });
  }
  if (lookup.kind === 'unavailable') {
    return NextResponse.json({ error: 'Address provider unavailable' }, { status: 503 });
  }

  const formatted = formatReverseResult(lookup.result);
  const trace = await fillHouseNumber(formatted, lat, lon, deadline);

  return NextResponse.json(
    debug ? { ...formatted, _debug: { ...trace, street: formatted.street } } : formatted,
  );
}

async function handleGet(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get('lat');
  const lonStr = searchParams.get('lon');

  if (!latStr || !lonStr) {
    return NextResponse.json({ error: 'Missing required parameters: lat, lon' }, { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (!isValidLatLon(lat, lon)) {
    return NextResponse.json({ error: 'Invalid lat/lon values' }, { status: 400 });
  }

  const deadline = createDeadline(GEOCODING.REVERSE_BUDGET_MS);
  try {
    return await reverseWithin(lat, lon, searchParams.get('debug') === '1', deadline);
  } catch (error) {
    logger.error('Reverse geocoding API error', { error: getErrorMessage(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    deadline.dispose();
  }
}

export const GET = withHeavyRateLimit(handleGet);
