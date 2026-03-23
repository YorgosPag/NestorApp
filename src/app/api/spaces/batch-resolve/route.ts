/**
 * POST /api/spaces/batch-resolve
 *
 * Resolves multiple parking/storage spaces in a single request.
 * Replaces N+1 individual GET calls from the sales dialog hook.
 *
 * @module api/spaces/batch-resolve
 * @permission units:units:view
 * @rateLimit STANDARD (60 req/min)
 * @see ADR-245 API Routes Centralization
 */

import 'server-only';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id.service';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { safeJsonBody } from '@/lib/validation/shared-schemas';
import { filterSnapshotsByTenant } from '@/lib/auth/tenant-isolation';
import type { BatchResolvedSpace, BatchResolveResponse } from '@/types/spaces';

// =============================================================================
// VALIDATION
// =============================================================================

const BatchResolveSchema = z.object({
  spaceIds: z.array(z.string().min(1)).min(1).max(50),
});

// =============================================================================
// CONSTANTS — derived from SSOT (enterprise-id.service)
// =============================================================================

/** Prefix→collection mapping, derived from ENTERPRISE_ID_PREFIXES SSOT */
const PREFIX_TO_COLLECTION: ReadonlyMap<string, { collection: string; spaceType: 'parking' | 'storage' }> = new Map([
  [`${ENTERPRISE_ID_PREFIXES.PARKING}_`, { collection: COLLECTIONS.PARKING_SPACES, spaceType: 'parking' }],
  [`${ENTERPRISE_ID_PREFIXES.STORAGE}_`, { collection: COLLECTIONS.STORAGE, spaceType: 'storage' }],
]);

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Determine collection from space ID prefix using ENTERPRISE_ID_PREFIXES SSOT.
 */
function resolveCollection(spaceId: string): { collection: string; spaceType: 'parking' | 'storage' } | null {
  for (const [prefix, meta] of PREFIX_TO_COLLECTION) {
    if (spaceId.startsWith(prefix)) return meta;
  }
  return null;
}

/** Typed result from a single collection batch fetch */
interface CollectionBatchResult {
  spaces: BatchResolvedSpace[];
  notFound: string[];
}

/** Batch-fetch and tenant-filter a set of IDs from one collection */
async function fetchCollection(
  adminDb: FirebaseFirestore.Firestore,
  ids: ReadonlyArray<string>,
  collection: string,
  spaceType: 'parking' | 'storage',
  ctx: AuthContext,
): Promise<CollectionBatchResult> {
  const refs = ids.map((id) => adminDb.collection(collection).doc(id));
  const snapshots = await adminDb.getAll(...refs);

  // 🔒 Centralized tenant isolation (supports super_admin bypass)
  const { allowed, denied } = await filterSnapshotsByTenant(snapshots, ctx, '/api/spaces/batch-resolve');

  // Track non-existent documents
  const missingIds = snapshots
    .filter((snap) => !snap.exists)
    .map((snap) => snap.id);

  const spaces: BatchResolvedSpace[] = allowed.map((snap) => {
    const data = snap.data() as Record<string, unknown>;
    return {
      id: snap.id,
      spaceType,
      area: (data.area as number) ?? 0,
      commercial: data.commercial as BatchResolvedSpace['commercial'],
      name: (data.name as string) ?? undefined,
      buildingId: (data.buildingId as string) ?? undefined,
      floorId: (data.floorId as string) ?? undefined,
      status: (data.status as string) ?? undefined,
    };
  });

  return { spaces, notFound: [...denied, ...missingIds] };
}

// =============================================================================
// POST — Batch Resolve Spaces
// =============================================================================

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<BatchResolveResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      const parsed = await safeJsonBody(BatchResolveSchema, request);
      if (parsed.error) throw new ApiError(400, 'Validation failed');

      const { spaceIds } = parsed.data;

      // Group IDs by collection for efficient fetching
      const grouped = new Map<string, { collection: string; spaceType: 'parking' | 'storage'; ids: string[] }>();
      const unknownIds: string[] = [];

      for (const id of spaceIds) {
        const resolved = resolveCollection(id);
        if (!resolved) {
          unknownIds.push(id);
          continue;
        }
        const key = resolved.collection;
        const group = grouped.get(key);
        if (group) {
          group.ids.push(id);
        } else {
          grouped.set(key, { ...resolved, ids: [id] });
        }
      }

      // Fetch all collections in parallel — each returns its own result (no shared mutation)
      const results = await Promise.all(
        Array.from(grouped.values()).map(({ collection, spaceType, ids }) =>
          fetchCollection(adminDb, ids, collection, spaceType, ctx)
        )
      );

      // Merge results
      const spaces = results.flatMap((r) => r.spaces);
      const notFound = [...unknownIds, ...results.flatMap((r) => r.notFound)];

      return apiSuccess<BatchResolveResponse>(
        { spaces, notFound },
        `Resolved ${spaces.length} spaces`
      );
    },
    { permissions: 'units:units:view' }
  )
);
