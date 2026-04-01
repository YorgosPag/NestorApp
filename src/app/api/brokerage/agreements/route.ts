/**
 * =============================================================================
 * POST /api/brokerage/agreements — Create Brokerage Agreement
 * =============================================================================
 *
 * Server-side endpoint for creating brokerage agreements.
 * Enforces exclusivity validation and tenant isolation.
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

const CreateAgreementSchema = z.object({
  agentContactId: z.string().min(1).max(128),
  agentName: z.string().min(1).max(200),
  scope: z.enum(['project', 'property']),
  projectId: z.string().min(1).max(128),
  propertyId: z.string().max(128).nullable().optional(),
  exclusivity: z.enum(['exclusive', 'non_exclusive', 'semi_exclusive']),
  commissionType: z.enum(['percentage', 'fixed', 'tiered']),
  commissionPercentage: z.number().min(0).max(100).nullable().optional(),
  commissionFixedAmount: z.number().min(0).max(999_999_999).nullable().optional(),
  startDate: z.string().min(10).max(30),
  endDate: z.string().max(30).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(CreateAgreementSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const result = await BrokerageServerService.createAgreement(
          body,
          ctx.companyId,
          ctx.uid
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error, validation: result.validation ?? null },
            { status: 400 }
          );
        }

        return NextResponse.json(
          { success: true, data: { id: result.id } },
          { status: 201 }
        );
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create brokerage agreement');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );
  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
