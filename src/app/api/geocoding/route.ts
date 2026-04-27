/**
 * POST /api/geocoding — Server-side Nominatim structured search proxy.
 * Multi-variant strategy: free-form → structured → dehyphenated → accent-stripped → greeklish → fallback.
 * Rate limited: withHeavyRateLimit (10 req/min).
 * @see geocoding-engine.ts — all geocoding logic
 * @see ADR-080 (AI Pipeline), geographic-config.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { geocode, sanitizeQuery } from './geocoding-engine';
import type { GeocodingRequestBody } from './geocoding-engine';

export type { GeocodingRequestBody, GeocodingApiResponse } from './geocoding-engine';

const logger = createModuleLogger('geocoding-api');

// Vercel serverless timeout — structured search + retries can take time
export const maxDuration = 30;

// =============================================================================
// VALIDATION
// =============================================================================

function validateRequestBody(body: unknown): body is GeocodingRequestBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;

  // At least one meaningful search field (after sanitization)
  const sanitized = sanitizeQuery(b as GeocodingRequestBody);
  const hasSearchField =
    (typeof sanitized.street === 'string' && sanitized.street.trim().length > 0) ||
    (typeof sanitized.city === 'string' && sanitized.city.trim().length > 0) ||
    (typeof sanitized.postalCode === 'string' && sanitized.postalCode.trim().length > 0);

  if (!hasSearchField) return false;

  for (const key of ['street', 'city', 'neighborhood', 'postalCode', 'county', 'municipality', 'region', 'country']) {
    if (b[key] !== undefined && typeof b[key] !== 'string') return false;
  }

  return true;
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

async function handlePost(request: NextRequest): Promise<Response> {
  try {
    const body: unknown = await request.json();

    if (!validateRequestBody(body)) {
      return NextResponse.json(
        { error: 'Invalid request. At least one of street, city, or postalCode is required.' },
        { status: 400 },
      );
    }

    const result = await geocode(body);

    if (!result) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Geocoding API error', { error: getErrorMessage(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withHeavyRateLimit(handlePost);
