/**
 * =============================================================================
 * PATCH /api/brokerage/commissions/[id] — Update Payment Status
 * =============================================================================
 *
 * Server-side endpoint for updating commission payment status.
 * Enforces tenant isolation via companyId from AuthContext.
 *
 * @enterprise ADR-252 - Security Audit (server-side write enforcement)
 */
import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';
import { BrokerageServerService } from '@/services/brokerage-server.service';
import type { CommissionPaymentStatus } from '@/types/brokerage';

type RouteContext = { params: Promise<{ id: string }> };

interface UpdatePaymentBody {
  paymentStatus: CommissionPaymentStatus;
}

async function handlePatch(request: NextRequest, segmentData?: RouteContext): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { id } = await segmentData!.params;

        if (!id || typeof id !== 'string') {
          return NextResponse.json(
            { success: false, error: 'Commission ID is required' },
            { status: 400 }
          );
        }

        const body = await req.json() as UpdatePaymentBody;

        if (!body.paymentStatus) {
          return NextResponse.json(
            { success: false, error: 'paymentStatus is required' },
            { status: 400 }
          );
        }

        const result = await BrokerageServerService.updateCommissionPayment(
          id,
          body.paymentStatus,
          ctx.companyId
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({ success: true }, { status: 200 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update commission payment');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );
  return handler(request);
}

export const PATCH = withSensitiveRateLimit(handlePatch);
