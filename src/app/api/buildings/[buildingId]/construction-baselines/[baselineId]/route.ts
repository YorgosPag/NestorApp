/**
 * Construction Baseline Detail API — Full snapshot with phases + tasks (ADR-266)
 *
 * Separate endpoint because listing all baselines should NOT return
 * the embedded phases/tasks arrays (too heavy for list views).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth, requireBuildingInTenant } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { normalizeToISO } from '@/lib/date-local';
import type { ConstructionBaseline } from '@/types/building/construction';

interface BaselineDetailResponse {
  success: boolean;
  baseline: ConstructionBaseline | null;
}

// =============================================================================
// GET — Return full baseline with embedded phases + tasks
// =============================================================================

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string; baselineId: string }> }
) {
  const { buildingId, baselineId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<BaselineDetailResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      await requireBuildingInTenant({ ctx, buildingId, path: `/api/buildings/${buildingId}/construction-baselines/${baselineId}` });

      const docSnap = await adminDb.collection(COLLECTIONS.CONSTRUCTION_BASELINES).doc(baselineId).get();

      if (!docSnap.exists) throw new ApiError(404, 'Baseline not found');

      const data = docSnap.data();
      if (data?.buildingId !== buildingId) throw new ApiError(403, 'Baseline does not belong to this building');

      const baseline: ConstructionBaseline = {
        id: docSnap.id,
        buildingId: data.buildingId,
        companyId: data.companyId,
        name: data.name ?? '',
        version: data.version ?? 1,
        description: data.description ?? null,
        phases: Array.isArray(data.phases) ? data.phases : [],
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        createdAt: normalizeToISO(data.createdAt) ?? undefined,
        createdBy: data.createdBy,
      };

      return NextResponse.json({ success: true, baseline } satisfies BaselineDetailResponse);
    },
    { permissions: 'buildings:buildings:view' }
  ));

  return handler(request);
}
