/**
 * POST /api/geocoding/telemetry — Address-correction telemetry write endpoint.
 *
 * Server-only write surface for the AddressEditor coordinator (ADR-332 §3.7
 * Phase 9). The Firestore rules block any client write to
 * `address_corrections_log/`; this route is the sanctioned path that injects
 * `companyId` and `userId` from the verified auth context, never from the
 * client payload.
 *
 * Auth: `withAuth` (any authenticated tenant user).
 * Rate: `withStandardRateLimit` (100 req/min) — telemetry is one event per
 *   meaningful correction, well under the threshold for normal use.
 *
 * @module api/geocoding/telemetry
 * @enterprise ADR-332 §3.7 Phase 9
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import {
  recordCorrection,
  validateRecordCorrectionInput,
} from '@/services/geocoding/address-corrections-telemetry.service';

const logger = createModuleLogger('geocoding-telemetry-api');

export const maxDuration = 10;

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const raw = await req.json();
        const input = validateRecordCorrectionInput(raw);
        const result = await recordCorrection(input, { uid: ctx.uid, companyId: ctx.companyId });
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
        return NextResponse.json({ success: true, id: result.id }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to record correction');
        logger.warn('telemetry payload rejected', { error: message });
        return NextResponse.json({ success: false, error: message }, { status: 400 });
      }
    },
  );
  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
