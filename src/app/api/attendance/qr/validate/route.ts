/**
 * =============================================================================
 * GET /api/attendance/qr/validate — Validate QR Token (Public)
 * =============================================================================
 *
 * Public endpoint called when worker scans QR code.
 * Returns minimal info: valid/invalid + project name + date.
 * No Firebase auth required (worker uses phone browser).
 *
 * Auth: NONE (public — worker scans QR, opens browser)
 * Rate: withHeavyRateLimit (10 req/min — anti-brute-force)
 *
 * @module api/attendance/qr/validate
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { validateQrToken } from '@/services/attendance/qr-token-service';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('api/attendance/qr/validate');

// =============================================================================
// TYPES
// =============================================================================

interface ValidateQrSuccessResponse {
  valid: true;
  projectName: string;
  validDate: string;
}

interface ValidateQrErrorResponse {
  valid: false;
  reason: string;
}

type ValidateQrResponse = ValidateQrSuccessResponse | ValidateQrErrorResponse;

// =============================================================================
// HANDLER
// =============================================================================

const baseGET = async (request: NextRequest): Promise<NextResponse<ValidateQrResponse>> => {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { valid: false, reason: 'missing_token' },
        { status: 400 }
      );
    }

    // Validate the token cryptographically + Firestore lookup
    const result = await validateQrToken(token);

    if (!result.valid || !result.projectId) {
      logger.info('QR token validation failed', { reason: result.reason });
      return NextResponse.json(
        { valid: false, reason: result.reason ?? 'invalid' },
        { status: 200 }
      );
    }

    // Fetch project name for display on check-in page
    const db = getAdminFirestore();
    const projectDoc = await db.collection(COLLECTIONS.PROJECTS).doc(result.projectId).get();
    const projectName = projectDoc.exists
      ? (projectDoc.data()?.name as string) ?? 'Εργοτάξιο'
      : 'Εργοτάξιο';

    return NextResponse.json({
      valid: true,
      projectName,
      validDate: result.validDate ?? new Date().toISOString().slice(0, 10),
    });
  } catch (error) {
    logger.error('QR validation error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return NextResponse.json(
      { valid: false, reason: 'server_error' },
      { status: 500 }
    );
  }
};

export const GET = withHeavyRateLimit(baseGET);
