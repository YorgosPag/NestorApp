/**
 * GET /api/ecb/forward-rates — Derive forward rates from ECB spot rates
 *
 * @enterprise ADR-242 SPEC-242E - Forward Curves
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { EuriborService } from '@/services/euribor.service';
import { buildForwardCurveResult } from '@/lib/forward-curve-engine';
import type { ForwardCurveResult } from '@/types/interest-calculator';

interface ForwardRatesResponse {
  success: boolean;
  result?: ForwardCurveResult;
  error?: string;
}

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (
      _req: NextRequest,
      _ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const rates = await EuriborService.getRates();
        const result = buildForwardCurveResult(rates);
        const response: ForwardRatesResponse = { success: true, result };
        return NextResponse.json(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to derive forward rates';
        return NextResponse.json(
          { success: false, error: message } satisfies ForwardRatesResponse,
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
