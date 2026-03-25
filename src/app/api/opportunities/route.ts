/**
 * =============================================================================
 * POST /api/opportunities — Create Opportunity
 * =============================================================================
 *
 * Auth: withAuth (authenticated users)
 * Rate: withSensitiveRateLimit (financial/CRM data)
 *
 * @module api/opportunities
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
import { safeParseBody } from '@/lib/validation/shared-schemas';

const CreateOpportunitySchema = z.object({
  name: z.string().min(1).max(200),
  contactId: z.string().max(128).optional(),
  contactName: z.string().max(200).optional(),
  projectId: z.string().max(128).optional(),
  unitId: z.string().max(128).optional(),
  stage: z.string().max(50).optional(),
  value: z.number().min(0).max(999_999_999).optional(),
  probability: z.number().min(0).max(100).optional(),
  source: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
  expectedCloseDate: z.string().max(30).optional(),
}).passthrough();

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(CreateOpportunitySchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const result = await OpportunitiesServerService.create(
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
        const message = getErrorMessage(error, 'Failed to create opportunity');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );
  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
