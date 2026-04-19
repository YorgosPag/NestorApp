/**
 * 🏠 UNITS LIST ENDPOINT
 *
 * @module api/properties
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added RBAC protection
 *
 * 🔒 SECURITY:
 * - Permission: properties:properties:view (GET)
 * - Global Role: super_admin (POST - utility)
 * - Tenant isolation: Query filtered by ctx.companyId
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { isRoleBypass } from '@/lib/auth/roles';
import { requireBuildingInTenant, TenantIsolationError } from '@/lib/auth/tenant-isolation';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('PropertiesRoute');

// Response types for type-safe withAuth
type PropertiesListSuccess = {
  success: true;
  properties: unknown[];
  count: number;
};

type PropertiesListError = {
  success: false;
  error: string;
  details?: string;
};

type PropertiesListResponse = PropertiesListSuccess | PropertiesListError;

function sortPropertiesByName(
  properties: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return properties.sort((left, right) => {
    const leftName = typeof left.name === 'string' ? left.name : '';
    const rightName = typeof right.name === 'string' ? right.name : '';
    return leftName.localeCompare(rightName);
  });
}

/**
 * @rateLimit STANDARD (60 req/min) - CRUD
 */
export const GET = withStandardRateLimit(
  async (request: NextRequest) => {
  const handler = withAuth<PropertiesListResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<PropertiesListResponse>> => {
      try {
        // 🏢 ENTERPRISE: Extract query parameters for filtering
        const { searchParams } = new URL(request.url);
        const buildingId = searchParams.get('buildingId');
        const floorId = searchParams.get('floorId');
        const queryCompanyId = searchParams.get('companyId');

        // 🏢 ENTERPRISE: Super admin can access any company's properties
        const isSuperAdmin = isRoleBypass(ctx.globalRole);
        const tenantCompanyId = isSuperAdmin && queryCompanyId
          ? queryCompanyId
          : ctx.companyId;

        logger.info('[Properties/List] Fetching properties', { companyId: tenantCompanyId, userId: ctx.uid, buildingId: buildingId || 'all', floorId: floorId || 'all', isSuperAdmin });

        // ============================================================================
        // TENANT-SCOPED QUERY (Admin SDK + Tenant Isolation)
        // Super admin with buildingId: query by buildingId directly (units may
        // have different companyId than the building's companyId)
        // ============================================================================

        const db = getAdminFirestore();
        let unitsQuery: FirebaseFirestore.Query = db.collection(COLLECTIONS.PROPERTIES);

        if (buildingId && !isSuperAdmin) {
          try {
            await requireBuildingInTenant({
              ctx,
              buildingId,
              path: '/api/properties',
            });
          } catch (error) {
            if (error instanceof TenantIsolationError) {
              return NextResponse.json({
                success: false,
                error: error.code === 'NOT_FOUND' ? 'Building not found' : 'Access denied',
                details: error.message,
              }, { status: error.status });
            }
            throw error;
          }

          unitsQuery = unitsQuery.where(FIELDS.BUILDING_ID, '==', buildingId);
        } else if (isSuperAdmin) {
          if (queryCompanyId) {
            unitsQuery = unitsQuery.where(FIELDS.COMPANY_ID, '==', queryCompanyId);
          }
          if (buildingId) {
            unitsQuery = unitsQuery.where(FIELDS.BUILDING_ID, '==', buildingId);
          }
        } else {
          unitsQuery = unitsQuery.where(FIELDS.COMPANY_ID, '==', tenantCompanyId);
        }

        if (floorId) {
          unitsQuery = unitsQuery.where(FIELDS.FLOOR_ID, '==', floorId);
        } else {
          // ADR-281: Exclude soft-deleted records — use != only when floorId is absent
          // (floorId path filters deleted in JS to avoid composite index on companyId+floorId+status)
          unitsQuery = unitsQuery.where('status', '!=', 'deleted');
        }

        const propertiesSnapshot = await unitsQuery.get();

        const rawDocs = propertiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as Record<string, unknown>
        }));

        // ADR-281: When floorId path was used, filter deleted in JS (avoids composite index requirement)
        const filteredDocs = floorId
          ? rawDocs.filter(doc => doc['status'] !== 'deleted')
          : rawDocs;

        const properties = sortPropertiesByName(filteredDocs);

        logger.info('[Properties/List] Found properties', { count: properties.length, companyId: tenantCompanyId, buildingId: buildingId || 'all' });

        logger.info('[Properties/List] Complete', { count: properties.length });

        return NextResponse.json({
          success: true,
          properties,
          count: properties.length
        });

      } catch (error) {
        logger.error('[Properties/List] Error', {
          error: getErrorMessage(error),
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to fetch properties',
          details: getErrorMessage(error)
        }, { status: 500 });
      }
    },
    { permissions: 'properties:properties:view' }
  );

  return handler(request);
  }
);

// POST — Link Sold Properties to Contacts (extracted for SRP, ADR-281)
export { POST } from './property-link-sold.handler';
