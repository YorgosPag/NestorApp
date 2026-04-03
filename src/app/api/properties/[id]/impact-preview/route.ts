import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { apiSuccess, ApiError, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { extractNestedIdFromUrl } from '@/lib/api/route-helpers';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { PropertyPatchSchema } from '../property-patch-helpers';
import { previewPropertyMutationImpact } from '@/lib/firestore/property-mutation-impact-preview.service';
import type { PropertyMutationImpactPreview } from '@/types/property-mutation-impact';

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<PropertyMutationImpactPreview>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        throw new ApiError(503, 'Database unavailable');
      }

      const propertyId = extractNestedIdFromUrl(request.url, 'properties');
      if (!propertyId) {
        throw new ApiError(400, 'Property ID is required');
      }

      const parsed = safeParseBody(PropertyPatchSchema, await request.json());
      if (parsed.error) {
        throw new ApiError(400, 'Validation failed');
      }

      await requirePropertyInTenantScope({ ctx, propertyId, path: '/api/properties/[id]/impact-preview' });

      const propertyDoc = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
      if (!propertyDoc.exists) {
        throw new ApiError(404, 'Property not found');
      }

      const preview = await previewPropertyMutationImpact(
        propertyId,
        propertyDoc.data() ?? {},
        parsed.data as Record<string, unknown>,
      );

      return apiSuccess(preview);
    },
    { permissions: 'properties:properties:update' }
  )
);
