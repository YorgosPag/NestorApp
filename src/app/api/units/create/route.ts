import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import type { UnitType } from '@/types/unit';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('UnitsCreateRoute');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Unit creation payload from client.
 * All fields except name are optional.
 */
interface UnitLevelPayload {
  floorId: string;
  floorNumber: number;
  name: string;
  isPrimary: boolean;
}

interface UnitCreatePayload {
  name: string;
  code?: string;
  type?: string;
  buildingId?: string;
  building?: string;
  floor?: number;
  floorId?: string;
  project?: string;
  status?: string;
  operationalStatus?: string;
  area?: number;
  description?: string;
  vertices?: unknown[];
  layout?: Record<string, number>;
  // ADR-236: Multi-level fields
  isMultiLevel?: boolean;
  levels?: UnitLevelPayload[];
}

interface UnitCreateResponse {
  unitId: string;
}

// =============================================================================
// POST — Create Unit via Admin SDK
// =============================================================================

/**
 * 🏢 ENTERPRISE: Create new unit via Admin SDK
 *
 * @security Firestore rules block client-side writes (allow create: if false)
 *           This endpoint uses Admin SDK to bypass rules with proper auth
 * @permission units:units:create
 * @see ADR-078
 */
export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<UnitCreateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        const body: UnitCreatePayload = await request.json();

        // Validation
        if (!body.name || !body.name.trim()) {
          throw new ApiError(400, 'Unit name is required');
        }

        // 🏢 ADR-236: Validate multi-level floors (entity-specific business logic)
        if (body.isMultiLevel && Array.isArray(body.levels)) {
          if (body.levels.length < 2) {
            throw new ApiError(400, 'Multi-level units require at least 2 floors');
          }
          const primaryCount = body.levels.filter(l => l.isPrimary).length;
          if (primaryCount !== 1) {
            throw new ApiError(400, 'Exactly one floor must be marked as primary');
          }
          const primary = body.levels.find(l => l.isPrimary);
          if (primary) {
            body.floor = primary.floorNumber;
            body.floorId = primary.floorId;
          }
        }

        // Entity-specific fields (exclude common fields handled by createEntity)
        const COMMON_FIELD_KEYS = new Set(['companyId', 'linkedCompanyId', 'createdAt', 'updatedAt', 'createdBy']);
        const entitySpecificFields: Record<string, unknown> = {
          ...Object.fromEntries(
            Object.entries(body).filter(([key, value]) => value !== undefined && !COMMON_FIELD_KEYS.has(key))
          ),
          name: body.name.trim(),
        };

        // If explicit code provided, include it (service will skip auto-generation)
        if (body.code?.trim()) {
          entitySpecificFields.code = body.code.trim();
        }

        logger.info('[Units] Creating new unit', {
          name: body.name,
          code: body.code ?? '(auto)',
          buildingId: body.buildingId || 'none',
        });

        // 🏢 ADR-238: Centralized entity creation
        const result = await createEntity('unit', {
          auth: ctx,
          parentId: body.buildingId ?? null,
          entitySpecificFields,
          codeOptions: {
            currentValue: body.code?.trim(),
            floorLevel: typeof body.floor === 'number' ? body.floor : 0,
            unitType: (body.type || 'apartment') as UnitType,
          },
          apiPath: '/api/units/create (POST)',
        });

        return apiSuccess<UnitCreateResponse>(
          { unitId: result.id },
          'Unit created successfully'
        );
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('[Units] Error creating unit', { error: getErrorMessage(error) });
        throw new ApiError(500, getErrorMessage(error, 'Failed to create unit'));
      }
    },
    { permissions: 'units:units:create' }
  )
);
