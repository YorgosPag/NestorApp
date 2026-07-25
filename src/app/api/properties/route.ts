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
import { resolveTenantListScopeFromUrl, tenantScopeLabel } from '@/lib/auth/tenant-scope';
import { tenantScopedCollection } from '@/lib/firestore/tenant-scoped-query';
import { tenantIsolationResponse } from '@/lib/api/tenant-scope-http';
import { compareByLocale } from '@/lib/intl-formatting';
import { requireBuildingInTenant, TenantIsolationError } from '@/lib/auth/tenant-isolation';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { UnitsApiData } from '@/types/api/building-spaces.api.types';
import { mapPropertyDoc } from '@/lib/firestore-mappers';

const logger = createModuleLogger('PropertiesRoute');

// Response types for type-safe withAuth
type PropertiesListSuccess = {
  success: true;
  data: UnitsApiData;
};

type PropertiesListError = {
  success: false;
  error: string;
  details?: string;
};

type PropertiesListResponse = PropertiesListSuccess | PropertiesListError;


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

        // 🔒 ADR-701: browse doctrine, resolved once — see lib/auth/tenant-scope
        const scope = resolveTenantListScopeFromUrl(request.url, ctx);

        logger.info('[Properties/List] Fetching properties', { companyId: tenantScopeLabel(scope), userId: ctx.uid, buildingId: buildingId || 'all', floorId: floorId || 'all', isSuperAdmin: scope.isSuperAdmin });

        // ============================================================================
        // TENANT-SCOPED QUERY (Admin SDK + Tenant Isolation)
        // ============================================================================

        let unitsQuery: FirebaseFirestore.Query;

        if (buildingId && !scope.isSuperAdmin) {
          try {
            await requireBuildingInTenant({
              ctx,
              buildingId,
              path: '/api/properties',
            });
          } catch (error) {
            if (error instanceof TenantIsolationError) {
              return tenantIsolationResponse(error, 'Building not found');
            }
            throw error;
          }

          // Isolation here is the ownership check above, NOT a companyId filter:
          // a unit may legitimately carry a different companyId than its building.
          unitsQuery = getAdminFirestore()
            .collection(COLLECTIONS.PROPERTIES)
            .where(FIELDS.BUILDING_ID, '==', buildingId);
        } else {
          unitsQuery = tenantScopedCollection(COLLECTIONS.PROPERTIES, scope);
          if (buildingId) {
            unitsQuery = unitsQuery.where(FIELDS.BUILDING_ID, '==', buildingId);
          }
        }

        if (floorId) {
          unitsQuery = unitsQuery.where(FIELDS.FLOOR_ID, '==', floorId);
        } else {
          // ADR-281: Exclude soft-deleted records — use != only when floorId is absent
          // (floorId path filters deleted in JS to avoid composite index on companyId+floorId+status)
          unitsQuery = unitsQuery.where('status', '!=', 'deleted');
        }

        const propertiesSnapshot = await unitsQuery.get();

        const mappedDocs = propertiesSnapshot.docs.map(doc =>
          mapPropertyDoc(doc.id, doc.data() as Record<string, unknown>)
        );

        // ADR-281: When floorId path was used, filter deleted in JS (avoids composite index requirement)
        const filteredDocs = floorId
          ? mappedDocs.filter(p => p.status !== 'deleted')
          : mappedDocs;

        filteredDocs.sort((a, b) => compareByLocale(a.name, b.name));

        logger.info('[Properties/List] Found properties', { count: filteredDocs.length, companyId: tenantScopeLabel(scope), buildingId: buildingId || 'all' });

        logger.info('[Properties/List] Complete', { count: filteredDocs.length });

        return NextResponse.json({
          success: true,
          data: {
            units: filteredDocs,
            count: filteredDocs.length,
          } satisfies UnitsApiData,
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
