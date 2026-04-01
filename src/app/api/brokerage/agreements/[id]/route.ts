/**
 * =============================================================================
 * PATCH/DELETE /api/brokerage/agreements/[id]
 * =============================================================================
 *
 * PATCH — Update brokerage agreement (with exclusivity re-validation)
 * DELETE — Terminate brokerage agreement
 *
 * @enterprise ADR-252 - Security Audit (server-side write enforcement)
 */
import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, logAuditEvent, logEntityDeletion } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';
import { BrokerageServerService } from '@/services/brokerage-server.service';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const UpdateAgreementSchema = z.object({
  exclusivity: z.enum(['exclusive', 'non_exclusive', 'semi_exclusive']).optional(),
  commissionType: z.enum(['percentage', 'fixed', 'tiered']).optional(),
  commissionPercentage: z.number().min(0).max(100).nullable().optional(),
  commissionFixedAmount: z.number().min(0).max(999_999_999).nullable().optional(),
  startDate: z.string().max(30).optional(),
  endDate: z.string().max(30).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  scope: z.enum(['project', 'property']).optional(),
  propertyId: z.string().max(128).nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// ============================================================================
// PATCH — Update Agreement
// ============================================================================

async function handlePatch(request: NextRequest, segmentData?: RouteContext): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { id } = await segmentData!.params;

        if (!id || typeof id !== 'string') {
          return NextResponse.json(
            { success: false, error: 'Agreement ID is required' },
            { status: 400 }
          );
        }

        const parsed = safeParseBody(UpdateAgreementSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const result = await BrokerageServerService.updateAgreement(
          id,
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

        await logAuditEvent(ctx, 'data_updated', id, 'agreement', {
          metadata: { reason: 'Brokerage agreement updated' },
        }).catch(() => {/* non-blocking */});

        return NextResponse.json({ success: true }, { status: 200 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update brokerage agreement');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );
  return handler(request);
}

// ============================================================================
// DELETE — Terminate Agreement
// ============================================================================

async function handleDelete(request: NextRequest, segmentData?: RouteContext): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { id } = await segmentData!.params;

        if (!id || typeof id !== 'string') {
          return NextResponse.json(
            { success: false, error: 'Agreement ID is required' },
            { status: 400 }
          );
        }

        const result = await BrokerageServerService.terminateAgreement(
          id,
          ctx.companyId,
          ctx.uid
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        await logEntityDeletion(ctx, 'agreement', id).catch(() => {/* non-blocking */});

        return NextResponse.json({ success: true }, { status: 200 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to terminate brokerage agreement');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );
  return handler(request);
}

export const PATCH = withSensitiveRateLimit(handlePatch);
export const DELETE = withSensitiveRateLimit(handleDelete);
