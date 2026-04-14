import 'server-only';

/**
 * =============================================================================
 * POST /api/ika/labor-compliance-save-preview
 * =============================================================================
 *
 * Impact preview endpoint called BEFORE saving global ΕΦΚΑ labor compliance
 * config (insurance classes + contribution rates).
 *
 * No request body needed — impact is assessed company-wide using `companyId`
 * from the authenticated session context.
 *
 * @returns ProjectMutationImpactPreview — allow / warn / block
 * @enterprise ADR-307 — IKA Mutation Impact Guards
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { previewLaborComplianceSaveImpact } from '@/lib/firestore/ika-labor-compliance-save-impact.service';
import type { ProjectMutationImpactPreview } from '@/types/project-mutation-impact';

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth<ApiSuccessResponse<ProjectMutationImpactPreview>>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const preview = await previewLaborComplianceSaveImpact(ctx.companyId);
      return apiSuccess(preview);
    },
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
