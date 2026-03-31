/**
 * =============================================================================
 * POST /api/brokerage/commissions — Record Commission
 * =============================================================================
 *
 * Server-side endpoint for recording brokerage commissions.
 * Commission calculation happens ONLY on the server.
 *
 * @enterprise ADR-252 - Security Audit (server-side write enforcement)
 */
import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';
import { BrokerageServerService } from '@/services/brokerage-server.service';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const RecordCommissionSchema = z.object({
  brokerageAgreementId: z.string().min(1).max(128),
  agentContactId: z.string().min(1).max(128),
  agentName: z.string().min(1).max(200),
  unitId: z.string().min(1).max(128),
  projectId: z.string().min(1).max(128),
  primaryBuyerContactId: z.string().min(1).max(128),
  salePrice: z.number().positive().max(999_999_999),
  commissionType: z.enum(['percentage', 'fixed', 'tiered']),
  commissionPercentage: z.number().min(0).max(100).nullable(),
  commissionFixedAmount: z.number().min(0).max(999_999_999).nullable(),
});

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(RecordCommissionSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const result = await BrokerageServerService.recordCommission(
          body,
          ctx.companyId,
          ctx.uid
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json(
          { success: true, data: { id: result.id } },
          { status: 201 }
        );
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to record commission');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );
  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
