/**
 * POST /api/calculator/cost — Calculate NPV-based cost of money
 *
 * Receives CostCalculationInput, resolves discount rate (Euribor + spread),
 * returns CostCalculationResult. Optionally includes scenario comparison.
 *
 * @enterprise ADR-234 Phase 4 - Interest Cost Calculator (SPEC-234E)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { EuriborService } from '@/services/euribor.service';
import { calculateFullResult, buildComparisonScenarios } from '@/lib/npv-engine';
import type {
  CostCalculationRequest,
  CostCalculationResponse,
} from '@/types/interest-calculator';
import { getErrorMessage } from '@/lib/error-utils';

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (
      req: NextRequest,
      _ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const body = await req.json() as CostCalculationRequest;

        // --- Validation ---
        if (!body.salePrice || body.salePrice <= 0) {
          return NextResponse.json(
            { success: false, error: 'salePrice must be > 0' } satisfies CostCalculationResponse,
            { status: 400 }
          );
        }
        if (!body.referenceDate) {
          return NextResponse.json(
            { success: false, error: 'referenceDate is required' } satisfies CostCalculationResponse,
            { status: 400 }
          );
        }
        if (!body.cashFlows || body.cashFlows.length === 0) {
          return NextResponse.json(
            { success: false, error: 'cashFlows must have at least 1 entry' } satisfies CostCalculationResponse,
            { status: 400 }
          );
        }

        // --- Resolve discount rate ---
        let effectiveRate: number;

        if (body.discountRateSource === 'manual' && body.manualDiscountRate !== undefined) {
          effectiveRate = body.manualDiscountRate;
        } else {
          const rates = await EuriborService.getRates();
          effectiveRate = EuriborService.resolveDiscountRate(
            rates,
            body.discountRateSource,
            body.bankSpread,
            body.manualDiscountRate
          );
        }

        // --- Calculate ---
        const result = calculateFullResult(body, effectiveRate);

        // --- Scenarios (optional) ---
        let comparison;
        if (body.scenarios) {
          comparison = buildComparisonScenarios(
            body.salePrice,
            body.referenceDate,
            effectiveRate
          );
        }

        const response: CostCalculationResponse = {
          success: true,
          result,
          comparison,
        };
        return NextResponse.json(response);
      } catch (error) {
        const message = getErrorMessage(error, 'Calculation failed');
        return NextResponse.json(
          { success: false, error: message } satisfies CostCalculationResponse,
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
