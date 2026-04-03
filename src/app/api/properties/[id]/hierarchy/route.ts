/**
 * @fileoverview Property Hierarchy API — ADR-198
 * @description Επιστρέφει πλήρη ιεραρχία μονάδας: company → project → building → property
 * @pattern GET /api/properties/[id]/hierarchy
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { extractNestedIdFromUrl } from '@/lib/api/route-helpers';

const logger = createModuleLogger('PropertyHierarchyRoute');

// ============================================================================
// TYPES
// ============================================================================

export interface PropertyHierarchyResponse {
  /** Εταιρεία */
  company: {
    id: string;
    name: string;
  } | null;
  /** Έργο */
  project: {
    id: string;
    name: string;
    permitTitle: string;
    address: string;
    city: string;
    postalCode: string;
    municipality: string;
    regionalUnit: string;
  } | null;
  /** Κτίριο */
  building: {
    id: string;
    name: string;
  } | null;
  /** Μονάδα */
  property: {
    id: string;
    name: string;
    floor: number;
    type: string;
  };
}

// ============================================================================
// GET /api/properties/[id]/hierarchy
// ============================================================================

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<PropertyHierarchyResponse>>(
    async (
      request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        throw new ApiError(503, 'Database unavailable');
      }

      const propertyId = extractNestedIdFromUrl(request.url, 'properties');

      if (!propertyId) {
        throw new ApiError(400, 'Property ID is required');
      }

      await requirePropertyInTenantScope({ ctx, propertyId: propertyId, path: '/api/properties/[id]/hierarchy' });

      // 1. Fetch property
      const propertyDoc = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
      if (!propertyDoc.exists) {
        throw new ApiError(404, 'Property not found');
      }
      const propertyData = propertyDoc.data();
      if (!propertyData) {
        throw new ApiError(404, 'Property data empty');
      }

      const result: PropertyHierarchyResponse = {
        company: null,
        project: null,
        building: null,
        property: {
          id: propertyDoc.id,
          name: propertyData.name ?? propertyData.code ?? propertyDoc.id,
          floor: propertyData.floor ?? 0,
          type: propertyData.type ?? '',
        },
      };

      // 2. Fetch building (if buildingId exists)
      const buildingId = propertyData.buildingId;
      if (buildingId) {
        const buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();
        if (buildingDoc.exists) {
          const buildingData = buildingDoc.data();
          if (buildingData) {
            result.building = {
              id: buildingDoc.id,
              name: buildingData.name ?? '',
            };

            // 3. Fetch project (from building.projectId)
            const projectId = buildingData.projectId;
            if (projectId) {
              const projectDoc = await adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
              if (projectDoc.exists) {
                const projectData = projectDoc.data();
                if (projectData) {
                  // Extract address details from structured addresses[] or legacy fields
                  const addresses = projectData.addresses as Array<{
                    isPrimary?: boolean;
                    street?: string;
                    number?: string;
                    city?: string;
                    postalCode?: string;
                    municipality?: string;
                    regionalUnit?: string;
                  }> | undefined;
                  const primaryAddr = addresses?.find(a => a.isPrimary) ?? addresses?.[0];

                  result.project = {
                    id: projectDoc.id,
                    name: projectData.name ?? '',
                    permitTitle: projectData.title ?? '',
                    address: projectData.address ?? '',
                    city: projectData.city ?? '',
                    postalCode: primaryAddr?.postalCode ?? '',
                    municipality: primaryAddr?.municipality ?? '',
                    regionalUnit: primaryAddr?.regionalUnit ?? '',
                  };

                  // 4. Fetch company (ADR-232: use linkedCompanyId)
                  const companyId = projectData.linkedCompanyId ?? projectData.companyId;
                  if (companyId) {
                    const companyDoc = await adminDb.collection(COLLECTIONS.CONTACTS).doc(companyId).get();
                    if (companyDoc.exists) {
                      const companyData = companyDoc.data();
                      if (companyData) {
                        result.company = {
                          id: companyDoc.id,
                          name: companyData.companyName ?? companyData.displayName ?? projectData.company ?? '',
                        };
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      logger.info('Hierarchy resolved', { propertyId, hasProject: !!result.project, hasCompany: !!result.company });

      return apiSuccess(result);
    },
  ),
);
