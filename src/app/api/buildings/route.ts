export const maxDuration = 30;

import { z } from 'zod';
import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeProjectIdForQuery } from '@/utils/firestore-helpers';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { getErrorMessage } from '@/lib/error-utils';
import { POLICY_ERROR_CODES } from '@/lib/policy';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import {
  BuildingCreationPolicyError,
  assertBuildingCreatePolicy,
  assertBuildingUpstreamChain,
} from '@/services/building/building-creation-policy';

const CreateBuildingSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  description: z.string().max(2000).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(200).optional(),
  totalArea: z.number().min(0).max(999_999_999).optional(),
  builtArea: z.number().min(0).max(999_999_999).optional(),
  floors: z.number().int().min(0).max(999).optional(),
  units: z.number().int().min(0).max(9999).optional(),
  totalValue: z.number().min(0).max(999_999_999).optional(),
  startDate: z.string().max(30).optional(),
  completionDate: z.string().max(30).optional(),
  status: z.string().max(50).optional(),
  projectId: z.string().max(128).optional(),
  companyId: z.string().max(128).optional(),
  company: z.string().max(200).optional(),
  addresses: z.array(z.record(z.unknown())).optional(),
  category: z.enum(['mixed', 'residential', 'commercial', 'industrial']).optional(),
}).passthrough();

const logger = createModuleLogger('BuildingsRoute');

// GET — Building list (extracted for SRP, same pattern as PATCH below)
export { GET } from './buildings-list.handler';
export type {
  BuildingDocument,
  BuildingsListScope,
  BuildingsResponseData,
} from './buildings-list.handler';

/**
 * 🏗️ ENTERPRISE: Create new building via Admin SDK
 *
 * @security Firestore rules block client-side writes (allow write: if false)
 *           This endpoint uses Admin SDK to bypass rules with proper auth
 * @permission buildings:buildings:create
 */
interface BuildingCreatePayload {
  name: string;
  code: string;
  description?: string;
  address?: string;
  city?: string;
  totalArea?: number | string;
  builtArea?: number | string;
  floors?: number | string;
  units?: number | string;
  totalValue?: number | string;
  startDate?: string;
  completionDate?: string;
  status?: string;
  projectId?: string | null;
  companyId?: string;
  company?: string;
  addresses?: Record<string, unknown>[];  // 🏢 ENTERPRISE: Multi-address support (ADR-167)
  category?: string;
}

interface BuildingCreateResponse {
  buildingId: string;
  building: BuildingCreatePayload & { id: string };
}

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<BuildingCreateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    try {
      const parsed = safeParseBody(CreateBuildingSchema, await request.json());
      if (parsed.error) throw new ApiError(400, 'Validation failed');
      const body = parsed.data;

      // 🔐 ADR-284 §3.0.5: Layer 0.5 Building Creation Policy (server-side enforcement)
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        logger.error('Firebase Admin not initialized');
        throw new ApiError(500, 'Database unavailable: Firebase Admin not initialized');
      }
      try {
        assertBuildingCreatePolicy(body as unknown as Record<string, unknown>);
        await assertBuildingUpstreamChain(adminDb, {
          projectId: String(body.projectId),
        });
      } catch (error) {
        if (error instanceof BuildingCreationPolicyError) {
          throw new ApiError(400, error.message, error.code);
        }
        throw error;
      }

      // 🔐 ADR-233 §3.4: Uniqueness validation for building `code` within projectId scope
      // Protects against race conditions when two users pick the same auto-suggested code.
      if (body.projectId) {
        const duplicateSnap = await adminDb.collection(COLLECTIONS.BUILDINGS)
          .where(FIELDS.PROJECT_ID, '==', normalizeProjectIdForQuery(String(body.projectId)))
          .where('code', '==', body.code)
          .limit(1)
          .get();
        if (!duplicateSnap.empty) {
          const existingId = duplicateSnap.docs[0].id;
          logger.warn('[Buildings] Duplicate code for projectId', { code: body.code, projectId: body.projectId, existingId });
          throw new ApiError(409, `Building code "${body.code}" already exists in this project`, POLICY_ERROR_CODES.DUPLICATE_CODE);
        }
      }

      // Entity-specific fields: exclude common fields handled by createEntity
      const { companyId: _c, ...bodyFields } = body;
      const entitySpecificFields: Record<string, unknown> = {
        ...Object.fromEntries(
          Object.entries(bodyFields).filter(([, value]) => value !== undefined)
        ),
        progress: 0,
      };

      logger.info('[Buildings] Creating new building for tenant', { companyId: ctx.companyId });

      // 🏢 ADR-238: Centralized entity creation (auto companyId, audit, timestamps)
      // Resolve projectId → project name at write time so the History tab
      // shows the project name instead of the raw ID (ADR-195 fix).
      const auditFieldResolvers = body.projectId
        ? {
            projectId: async (id: unknown) => {
              try {
                const snap = await adminDb
                  .collection(COLLECTIONS.PROJECTS)
                  .doc(String(id))
                  .get();
                return (snap.data()?.name as string | undefined) ?? null;
              } catch {
                return null;
              }
            },
          }
        : undefined;

      const result = await createEntity('building', {
        auth: ctx,
        parentId: body.projectId ? String(body.projectId) : null,
        entitySpecificFields,
        apiPath: '/api/buildings (POST)',
        auditFieldResolvers,
      });

      // ADR-029 Phase D: search_documents written by Cloud Function onBuildingWrite.
      return apiSuccess<BuildingCreateResponse>(
        {
          buildingId: result.id,
          building: { ...body, id: result.id }
        },
        'Building created successfully'
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('[Buildings] Error creating building', { error });
      throw new ApiError(500, getErrorMessage(error, 'Failed to create building'));
    }
    },
    { permissions: 'buildings:buildings:create' }
  )
);

// PATCH — Update Building (extracted for SRP, ADR-281)
export { PATCH } from './building-update.handler';
