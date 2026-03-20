/**
 * POST /api/euribor/refresh — Force-refresh Euribor rates from ECB
 *
 * @enterprise ADR-234 Phase 4 - Interest Cost Calculator (SPEC-234E)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { EuriborService } from '@/services/euribor.service';
import type { EuriborRatesResponse } from '@/types/interest-calculator';
import { getErrorMessage } from '@/lib/error-utils';

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (
      _req: NextRequest,
      _ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const rates = await EuriborService.refreshRates();
        const response: EuriborRatesResponse = { success: true, rates };
        return NextResponse.json(response);
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to refresh rates');
        return NextResponse.json(
          { success: false, error: message } satisfies EuriborRatesResponse,
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
