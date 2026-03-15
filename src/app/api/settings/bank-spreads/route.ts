/**
 * GET + PUT /api/settings/bank-spreads — Bank spread configuration
 *
 * @enterprise ADR-234 Phase 4 - Interest Cost Calculator (SPEC-234E)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { EuriborService } from '@/services/euribor.service';
import type { BankSpreadConfig, BankSpreadsResponse } from '@/types/interest-calculator';

// =============================================================================
// GET — Read current spreads
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (
      _req: NextRequest,
      _ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const config = await EuriborService.getBankSpreads();
        return NextResponse.json({ success: true, config } satisfies BankSpreadsResponse);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to read spreads';
        return NextResponse.json(
          { success: false, error: message } satisfies BankSpreadsResponse,
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

// =============================================================================
// PUT — Update spreads
// =============================================================================

async function handlePut(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const body = await req.json() as Partial<BankSpreadConfig>;

        if (!body.banks || !Array.isArray(body.banks) || typeof body.defaultSpread !== 'number') {
          return NextResponse.json(
            { success: false, error: 'Invalid body: banks[] and defaultSpread required' },
            { status: 400 }
          );
        }

        // Validate entries
        for (const entry of body.banks) {
          if (typeof entry.bankName !== 'string' || typeof entry.spread !== 'number') {
            return NextResponse.json(
              { success: false, error: 'Each bank entry needs bankName (string) and spread (number)' },
              { status: 400 }
            );
          }
        }

        const config: BankSpreadConfig = {
          banks: body.banks,
          defaultSpread: body.defaultSpread,
        };

        const result = await EuriborService.updateBankSpreads(config, ctx.uid);
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error } satisfies BankSpreadsResponse,
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, config } satisfies BankSpreadsResponse);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update spreads';
        return NextResponse.json(
          { success: false, error: message } satisfies BankSpreadsResponse,
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
export const PUT = withStandardRateLimit(handlePut);
