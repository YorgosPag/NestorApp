/**
 * =============================================================================
 * PATCH + DELETE /api/opportunities/[id] — Update & Delete Opportunity
 * =============================================================================
 *
 * PATCH:  Update opportunity fields (with server-side validation)
 * DELETE: Hard-delete opportunity (with tenant isolation)
 *
 * Auth: withAuth (authenticated users)
 * Rate: withSensitiveRateLimit (financial/CRM data)
 *
 * @module api/opportunities/[id]
 * @enterprise ADR-252 Security Fix: Server-side validation
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { OpportunitiesServerService } from '@/services/opportunities-server.service';
import { getErrorMessage } from '@/lib/error-utils';
import { requireOpportunityInTenant } from '@/lib/auth/tenant-isolation';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const UpdateOpportunitySchema = z.object({
  stage: z.string().max(50).optional(),
  value: z.number().min(0).max(999_999_999).optional(),
  probability: z.number().min(0).max(100).optional(),
  notes: z.string().max(5000).optional(),
  source: z.string().max(100).optional(),
  expectedCloseDate: z.string().max(30).nullable().optional(),
  lostReason: z.string().max(500).optional(),
}).passthrough();

type RouteContext = { params: Promise<{ id: string }> };

// =============================================================================
// PATCH — Update Opportunity
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: RouteContext
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        // 🔒 ADR: Centralized tenant isolation (existence + companyId + audit logging)
        await requireOpportunityInTenant({ ctx, opportunityId: id, path: '/api/opportunities/[id]' });

        const parsed = safeParseBody(UpdateOpportunitySchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const result = await OpportunitiesServerService.update(
          id,
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

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update opportunity');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );
  return handler(request);
}

// =============================================================================
// DELETE — Delete Opportunity
// =============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: RouteContext
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        // 🔒 ADR: Centralized tenant isolation (existence + companyId + audit logging)
        await requireOpportunityInTenant({ ctx, opportunityId: id, path: '/api/opportunities/[id]' });

        const result = await OpportunitiesServerService.remove(
          id,
          ctx.companyId
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to delete opportunity');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );
  return handler(request);
}

export const PATCH = withSensitiveRateLimit(handlePatch);
export const DELETE = withSensitiveRateLimit(handleDelete);
