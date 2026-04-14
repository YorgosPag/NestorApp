import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { apiSuccess, ApiError, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { isRoleBypass } from '@/lib/auth/roles';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { previewLandownersSaveImpact } from '@/lib/firestore/project-landowners-save-impact.service';
import type { Project } from '@/types/project';
import type { ProjectMutationImpactPreview } from '@/types/project-mutation-impact';

const LandownersSavePreviewSchema = z.object({
  landownersChanged: z.boolean(),
  bartexChanged: z.boolean(),
});

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  const { projectId } = await segmentData!.params;

  const handler = withAuth<ApiSuccessResponse<ProjectMutationImpactPreview>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const parsed = safeParseBody(LandownersSavePreviewSchema, await req.json());
      if (parsed.error) {
        throw new ApiError(400, 'Validation failed');
      }

      const db = getAdminFirestore();
      const projectDoc = await db.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
      if (!projectDoc.exists) {
        throw new ApiError(404, 'Project not found');
      }

      const project = { id: projectDoc.id, ...(projectDoc.data() ?? {}) } as Project;
      const isSuperAdmin = isRoleBypass(ctx.globalRole);
      if (!isSuperAdmin && project.companyId !== ctx.companyId) {
        throw new ApiError(403, 'Access denied - Project not found');
      }

      const preview = await previewLandownersSaveImpact(projectId, parsed.data);
      return apiSuccess(preview);
    },
    { permissions: 'projects:projects:update' }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
