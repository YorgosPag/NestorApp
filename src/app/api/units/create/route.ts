import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { FieldValue } from 'firebase-admin/firestore';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { isRoleBypass } from '@/lib/auth/roles';
import { createModuleLogger } from '@/lib/telemetry';
import {
  formatFloorCode,
  resolveTypeCode,
  formatEntityCode,
  parseEntityCode,
} from '@/services/entity-code.service';
import { extractBuildingLetter } from '@/config/entity-code-config';
import type { UnitType } from '@/types/unit';

const logger = createModuleLogger('UnitsCreateRoute');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Unit creation payload from client.
 * All fields except name are optional.
 */
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
      // 🔐 ADMIN SDK: Get server-side Firestore instance
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        logger.error('Firebase Admin not initialized');
        throw new ApiError(503, 'Database unavailable');
      }

      try {
        // 🏢 ENTERPRISE: Parse request body
        const body: UnitCreatePayload = await request.json();

        // 🔒 VALIDATION: Name is required
        if (!body.name || !body.name.trim()) {
          throw new ApiError(400, 'Unit name is required');
        }

        // 🏢 ADR-232: Super admin entities get companyId: null
        // Regular users inherit companyId from building (or fallback to auth context)
        const isSuperAdmin = isRoleBypass(ctx.globalRole);
        let resolvedCompanyId: string | null = isSuperAdmin ? null : ctx.companyId;

        if (!isSuperAdmin && body.buildingId) {
          const buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(body.buildingId).get();
          if (buildingDoc.exists) {
            const buildingCompanyId = buildingDoc.data()?.companyId;
            if (buildingCompanyId) {
              resolvedCompanyId = buildingCompanyId;
              logger.info('[Units] companyId inherited from building', {
                buildingId: body.buildingId,
                buildingCompanyId,
                userCompanyId: ctx.companyId,
              });
            }
          }
        }

        // 🏢 ADR-233: Auto-generate entity code if not provided
        let entityCode = body.code?.trim() || '';
        if (!entityCode && body.buildingId) {
          try {
            const buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(body.buildingId).get();
            const buildingData = buildingDoc.data();
            const buildingName = (buildingData?.name as string) || '?';
            const buildingLetter = extractBuildingLetter(buildingName);
            const unitType = (body.type || 'apartment') as UnitType;
            const typeCode = resolveTypeCode('unit', unitType);
            const floorLevel = typeof body.floor === 'number' ? body.floor : 0;
            const floorCode = formatFloorCode(floorLevel);

            if (typeCode) {
              // Find next sequence by scanning existing codes
              const existingUnits = await adminDb.collection(COLLECTIONS.UNITS)
                .where('buildingId', '==', body.buildingId)
                .where('floor', '==', floorLevel)
                .get();

              let maxSeq = 0;
              for (const doc of existingUnits.docs) {
                const code = doc.data().code as string | undefined;
                if (!code) continue;
                const parsed = parseEntityCode(code);
                if (parsed && parsed.typeCode === typeCode && parsed.floorCode === floorCode) {
                  if (parsed.sequence > maxSeq) maxSeq = parsed.sequence;
                }
              }

              entityCode = formatEntityCode(buildingLetter, typeCode, floorCode, maxSeq + 1);
              logger.info('[Units] Auto-generated entity code', { entityCode, buildingId: body.buildingId });
            }
          } catch (codeErr) {
            logger.warn('[Units] Entity code auto-generation failed, proceeding without code', {
              error: codeErr instanceof Error ? codeErr.message : String(codeErr),
            });
          }
        }

        const sanitizedData = {
          ...body,
          ...(entityCode ? { code: entityCode } : {}),
          name: body.name.trim(),
          companyId: resolvedCompanyId,  // 🔒 ADR-232: null for super admin, inherited for regular
          linkedCompanyId: null,          // 🏢 ADR-232: Set via cascade propagation
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          createdBy: ctx.uid,
        };

        // 🏢 ENTERPRISE: Remove undefined fields (Firestore doesn't accept undefined)
        const cleanData = Object.fromEntries(
          Object.entries(sanitizedData).filter(([, value]) => value !== undefined)
        );

        logger.info('[Units] Creating new unit', { name: body.name, companyId: resolvedCompanyId, buildingId: body.buildingId || 'none' });

        // 🏗️ CREATE: Use Admin SDK with enterprise ID (ADR-210)
        const { generateUnitId } = await import('@/services/enterprise-id.service');
        const unitId = generateUnitId();
        await adminDb.collection(COLLECTIONS.UNITS).doc(unitId).set(cleanData);

        logger.info('[Units] Unit created', { unitId });

        // 📊 Audit log
        await logAuditEvent(ctx, 'data_created', 'unit', 'api', {
          newValue: {
            type: 'status',
            value: {
              unitId,
              name: body.name,
              buildingId: body.buildingId || null,
            },
          },
          metadata: { reason: 'Unit created via API' },
        });

        // 🏢 ENTERPRISE: Return created unit ID
        return apiSuccess<UnitCreateResponse>(
          { unitId },
          'Unit created successfully'
        );

      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('[Units] Error creating unit', { error: error instanceof Error ? error.message : String(error) });
        throw new ApiError(500, error instanceof Error ? error.message : 'Failed to create unit');
      }
    },
    { permissions: 'units:units:create' }
  )
);
