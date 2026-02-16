/**
 * =============================================================================
 * 🗺️ REVERSE GEOCODING API — Server-side Nominatim Reverse Proxy
 * =============================================================================
 *
 * Server-side reverse geocoding proxy that:
 * - Accepts lat/lon query parameters
 * - Calls Nominatim reverse API with proper User-Agent (TOS)
 * - Validates coordinates within Greek bounding box
 * - Returns structured address data for form population
 * - Rate limited: withHeavyRateLimit (10 req/min)
 *
 * @module app/api/geocoding/reverse/route
 * @see geographic-config.ts, geocoding-service.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { createModuleLogger } from '@/lib/telemetry';

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
const { GEOCODING, COUNTRY_BOUNDING_BOX } = GEOGRAPHIC_CONFIG;

// =============================================================================
// VALIDATION
// =============================================================================

function isValidLatLon(lat: number, lon: number): boolean {
  if (Number.isNaN(lat) || Number.isNaN(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  return true;
}

function isWithinGreekBounds(lat: number, lon: number): boolean {
  return (
    lat >= COUNTRY_BOUNDING_BOX.minLat &&
    lat <= COUNTRY_BOUNDING_BOX.maxLat &&
    lon >= COUNTRY_BOUNDING_BOX.minLng &&
    lon <= COUNTRY_BOUNDING_BOX.maxLng
  );
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

async function fetchNominatimReverse(url: string): Promise<NominatimReverseResult | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn('Nominatim reverse non-OK response', { data: { status: response.status } });
      return null;
    }

    const data: NominatimReverseResult = await response.json();

    // Nominatim returns { error: "..." } for invalid queries
    if (!data.address) {
      logger.warn('Nominatim reverse returned no address');
      return null;
    }

    return data;
  } catch (error) {
    logger.warn('Nominatim reverse fetch error', { error: String(error) });
    return null;
  }
}

function formatReverseResult(result: NominatimReverseResult): ReverseGeocodingApiResponse {
  const addr = result.address;

  return {
    street: addr.road ?? '',
    number: addr.house_number ?? '',
    city: addr.city ?? addr.town ?? addr.village ?? '',
    neighborhood: addr.suburb ?? addr.neighbourhood ?? '',
    postalCode: addr.postcode ?? '',
    region: addr.state ?? '',
    country: addr.country ?? '',
    displayName: result.display_name,
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
  };
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

async function handleGet(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const latStr = searchParams.get('lat');
    const lonStr = searchParams.get('lon');

    if (!latStr || !lonStr) {
      return NextResponse.json(
        { error: 'Missing required parameters: lat, lon' },
        { status: 400 }
      );
    }

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (!isValidLatLon(lat, lon)) {
      return NextResponse.json(
        { error: 'Invalid lat/lon values' },
        { status: 400 }
      );
    }

    if (!isWithinGreekBounds(lat, lon)) {
      return NextResponse.json(
        { error: 'Coordinates outside supported region (Greece)' },
        { status: 400 }
      );
    }

    const url = buildReverseUrl(lat, lon);
    logger.info('Reverse geocoding request', { data: { lat, lon } });

    const result = await fetchNominatimReverse(url);

    if (!result) {
      return NextResponse.json(
        { error: 'No address found at this location' },
        { status: 404 }
      );
    }

    return NextResponse.json(formatReverseResult(result));
  } catch (error) {
    logger.error('Reverse geocoding API error', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withHeavyRateLimit(handleGet);
