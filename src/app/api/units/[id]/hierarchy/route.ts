/**
 * @fileoverview Unit Hierarchy API — ADR-198
 * @description Επιστρέφει πλήρη ιεραρχία μονάδας: company → project → building → unit
 * @pattern GET /api/units/[id]/hierarchy
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('UnitHierarchyRoute');

// ============================================================================
// TYPES
// ============================================================================

export interface UnitHierarchyResponse {
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
  } | null;
  /** Κτίριο */
  building: {
    id: string;
    name: string;
  } | null;
  /** Μονάδα */
  unit: {
    id: string;
    name: string;
    floor: number;
    type: string;
  };
}

// ============================================================================
// GET /api/units/[id]/hierarchy
// ============================================================================

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<UnitHierarchyResponse>>(
    async (
      request: NextRequest,
      _ctx: AuthContext,
      _cache: PermissionCache,
    ) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        throw new ApiError(503, 'Database unavailable');
      }

      // Extract unit ID from URL
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const unitIdIndex = pathParts.indexOf('units') + 1;
      const unitId = pathParts[unitIdIndex];

      if (!unitId) {
        throw new ApiError(400, 'Unit ID is required');
      }

      // 1. Fetch unit
      const unitDoc = await adminDb.collection(COLLECTIONS.UNITS).doc(unitId).get();
      if (!unitDoc.exists) {
        throw new ApiError(404, 'Unit not found');
      }
      const unitData = unitDoc.data();
      if (!unitData) {
        throw new ApiError(404, 'Unit data empty');
      }

      const result: UnitHierarchyResponse = {
        company: null,
        project: null,
        building: null,
        unit: {
          id: unitDoc.id,
          name: unitData.name ?? unitData.code ?? unitDoc.id,
          floor: unitData.floor ?? 0,
          type: unitData.type ?? '',
        },
      };

      // 2. Fetch building (if buildingId exists)
      const buildingId = unitData.buildingId;
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
                  result.project = {
                    id: projectDoc.id,
                    name: projectData.name ?? '',
                    permitTitle: projectData.title ?? '',
                    address: projectData.address ?? '',
                    city: projectData.city ?? '',
                  };

                  // 4. Fetch company (from project.companyId)
                  const companyId = projectData.companyId;
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

      logger.info('Hierarchy resolved', { unitId, hasProject: !!result.project, hasCompany: !!result.company });

      return apiSuccess(result);
    },
  ),
);
