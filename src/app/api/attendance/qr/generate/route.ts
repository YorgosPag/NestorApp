/**
 * =============================================================================
 * POST /api/attendance/qr/generate — Generate Daily QR Token
 * =============================================================================
 *
 * Generates a QR code for a project's daily attendance check-in.
 * If a valid token already exists for the date, reuses it.
 *
 * Auth: withAuth (admin/manager only)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/attendance/qr/generate
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { generateDailyQrToken } from '@/services/attendance/qr-token-service';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('api/attendance/qr/generate');

// =============================================================================
// TYPES
// =============================================================================

interface GenerateQrSuccessResponse {
  success: true;
  tokenId: string;
  token: string;
  qrDataUrl: string;
  validDate: string;
  expiresAt: string;
  checkInUrl: string;
}

interface GenerateQrErrorResponse {
  success: false;
  error: string;
}

type GenerateQrResponse = GenerateQrSuccessResponse | GenerateQrErrorResponse;

// =============================================================================
// HANDLER
// =============================================================================

const basePOST = async (request: NextRequest) => {
  const handler = withAuth<GenerateQrResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<GenerateQrResponse>> => {
      try {
        const body = await req.json() as { projectId?: string; date?: string };

        // Validate input
        if (!body.projectId) {
          return NextResponse.json(
            { success: false, error: 'projectId is required' },
            { status: 400 }
          );
        }

        // Default to today in YYYY-MM-DD format
        const date = body.date ?? new Date().toISOString().slice(0, 10);

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return NextResponse.json(
            { success: false, error: 'date must be in YYYY-MM-DD format' },
            { status: 400 }
          );
        }

        logger.info('Generating QR token', {
          projectId: body.projectId,
          date,
          userId: ctx.uid,
        });

        // Generate or reuse existing token
        const tokenDoc = await generateDailyQrToken(body.projectId, date, ctx.uid);

        // Build the check-in URL
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nestor-app.vercel.app';
        const checkInUrl = `${baseUrl}/attendance/check-in/${encodeURIComponent(tokenDoc.token)}`;

        // Generate QR code as data URL (PNG)
        const qrDataUrl = await QRCode.toDataURL(checkInUrl, {
          width: 400,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });

        return NextResponse.json({
          success: true,
          tokenId: tokenDoc.id,
          token: tokenDoc.token,
          qrDataUrl,
          validDate: tokenDoc.validDate,
          expiresAt: tokenDoc.expiresAt,
          checkInUrl,
        });
      } catch (error) {
        logger.error('QR generation failed', {
          error: error instanceof Error ? error.message : 'Unknown',
          userId: ctx.uid,
        });

        return NextResponse.json(
          { success: false, error: 'Failed to generate QR token' },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
};

export const POST = withStandardRateLimit(basePOST);
