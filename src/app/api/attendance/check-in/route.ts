/**
 * =============================================================================
 * POST /api/attendance/check-in — Worker QR Check-In (Public)
 * =============================================================================
 *
 * Public endpoint for worker attendance check-in via QR code.
 * Worker identified by token + AMKA (no Firebase auth).
 *
 * Auth: NONE (public — worker uses phone browser)
 * Rate: withHeavyRateLimit (10 req/min — anti-brute-force)
 *
 * Security:
 * - QR token HMAC verification
 * - AMKA resolution within project scope
 * - GPS coordinates captured for geofence
 * - Server-side timestamps (not client)
 * - Immutable event records
 *
 * @module api/attendance/check-in
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { processQrCheckIn } from '@/services/attendance/attendance-server-service';
import { createModuleLogger } from '@/lib/telemetry';
import type { QrCheckInPayload, QrCheckInResponse } from '@/components/projects/ika/contracts';

const logger = createModuleLogger('api/attendance/check-in');

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/**
 * Validate the check-in payload structure.
 * Returns null if valid, error message if invalid.
 */
function validatePayload(body: Record<string, unknown>): string | null {
  if (!body.token || typeof body.token !== 'string') {
    return 'token is required';
  }

  if (!body.workerIdentifier || typeof body.workerIdentifier !== 'string') {
    return 'workerIdentifier (AMKA) is required';
  }

  // Validate AMKA format: 11 digits
  const amka = body.workerIdentifier as string;
  if (!/^\d{11}$/.test(amka)) {
    return 'workerIdentifier must be an 11-digit AMKA number';
  }

  if (!body.eventType || !['check_in', 'check_out'].includes(body.eventType as string)) {
    return 'eventType must be "check_in" or "check_out"';
  }

  // Coordinates are optional but must be valid if provided
  if (body.coordinates) {
    const coords = body.coordinates as Record<string, unknown>;
    if (typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
      return 'coordinates.lat and coordinates.lng must be numbers';
    }
    if (coords.lat < -90 || coords.lat > 90) {
      return 'coordinates.lat must be between -90 and 90';
    }
    if (coords.lng < -180 || coords.lng > 180) {
      return 'coordinates.lng must be between -180 and 180';
    }
  }

  // Photo is optional, but if provided must be a data URL
  if (body.photoBase64 && typeof body.photoBase64 === 'string') {
    if (!body.photoBase64.startsWith('data:image/')) {
      return 'photoBase64 must be a data:image/* URL';
    }
    // Limit photo size to 2MB base64 (~1.5MB actual)
    if (body.photoBase64.length > 2_000_000) {
      return 'photoBase64 exceeds maximum size (2MB)';
    }
  }

  return null;
}

// =============================================================================
// HANDLER
// =============================================================================

const basePOST = async (request: NextRequest): Promise<NextResponse<QrCheckInResponse>> => {
  try {
    const body = await request.json() as Record<string, unknown>;

    // Validate input
    const validationError = validatePayload(body);
    if (validationError) {
      return NextResponse.json(
        {
          success: false,
          error: validationError,
          eventId: null,
          workerName: null,
          geofence: null,
          timestamp: null,
          photoUploaded: false,
        },
        { status: 400 }
      );
    }

    // Build typed payload
    const payload: QrCheckInPayload = {
      token: body.token as string,
      workerIdentifier: body.workerIdentifier as string,
      eventType: body.eventType as 'check_in' | 'check_out',
      coordinates: body.coordinates
        ? {
            lat: (body.coordinates as Record<string, number>).lat,
            lng: (body.coordinates as Record<string, number>).lng,
            accuracy: (body.coordinates as Record<string, number>).accuracy ?? 0,
          }
        : null,
      photoBase64: (body.photoBase64 as string) ?? null,
      deviceInfo: {
        userAgent: (body.deviceInfo as Record<string, string>)?.userAgent ?? request.headers.get('user-agent') ?? 'unknown',
        platform: (body.deviceInfo as Record<string, string>)?.platform ?? 'unknown',
        language: (body.deviceInfo as Record<string, string>)?.language ?? 'el',
      },
    };

    logger.info('Processing QR check-in', {
      eventType: payload.eventType,
      hasCoordinates: !!payload.coordinates,
      hasPhoto: !!payload.photoBase64,
    });

    // Process the check-in
    const result = await processQrCheckIn(payload);

    const status = result.success ? 200 : 422;
    return NextResponse.json(result, { status });
  } catch (error) {
    logger.error('Check-in endpoint error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'server_error',
        eventId: null,
        workerName: null,
        geofence: null,
        timestamp: null,
        photoUploaded: false,
      },
      { status: 500 }
    );
  }
};

export const POST = withHeavyRateLimit(basePOST);
