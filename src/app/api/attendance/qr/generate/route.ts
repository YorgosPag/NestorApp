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
import { withAuth } from '@/lib/auth';
import { publicUrl } from '@/lib/http/public-origin';
import { qrPngDataUrl } from '@/lib/qr/qr-code';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { generateDailyQrToken } from '@/services/attendance/qr-token-service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { calendarDayOf } from '@/constants/platform-operator';
import { isCalendarDay } from '@/lib/date/calendar-day';

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

        // «Σήμερα» = η ημέρα του ΕΡΓΟΤΑΞΙΟΥ (Αθήνα), όχι του διακομιστή: το `nowISO().slice(0, 10)` είναι ημέρα UTC
        // ⇒ 00:00–02:00/03:00 ώρα Ελλάδας έβγαζε QR της ΧΘΕΣΙΝΗΣ, που έληγε σε λίγες ώρες. Την ημέρα την ορίζει ο διακομιστής·
        // ο πελάτης στέλνει `date` μόνο για ρητά άλλη ημέρα.
        const date = body.date ?? calendarDayOf(new Date());

        // An existing calendar day — `2027-02-30` gets a 400, not a token for a day that never comes (ADR-919)
        if (!isCalendarDay(date)) {
          return NextResponse.json(
            { success: false, error: 'date must be an existing calendar day in YYYY-MM-DD format' },
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

        // 🔴 ADR-841 §7 Α21.17 — ΠΟΤΕ μαντεμένη διεύθυνση. Η παλιά εφεδρεία ήταν το **νεκρό** Vercel URL,
        //    δηλαδή QR τυπωμένο στο εργοτάξιο που δεν άνοιγε πουθενά. Χωρίς ρύθμιση ⇒ ρητό σφάλμα.
        const checkInUrl = publicUrl(`/attendance/check-in/${encodeURIComponent(tokenDoc.token)}`);
        if (checkInUrl === null) {
          logger.error('NEXT_PUBLIC_APP_URL is not configured — refusing to issue an unreachable QR');
          return NextResponse.json(
            { success: false, error: 'Public URL is not configured' },
            { status: 503 }
          );
        }

        // Τυπώνεται και κολλιέται στο εργοτάξιο ⇒ χρήση `print` (διόρθωση Q, ήσυχη ζώνη 4).
        const qrDataUrl = await qrPngDataUrl(checkInUrl, 'print', 400);

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
          error: getErrorMessage(error, 'Unknown'),
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
