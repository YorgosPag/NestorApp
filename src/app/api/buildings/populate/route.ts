import 'server-only';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  audit,
  getAdminFirestore,
  SERVER_COLLECTIONS,
} from '@/server/admin/admin-guards';
import { buildingInstantiationRoute } from '@/server/admin/building-instantiation-route';
import { getCompanyByName } from '@/services/companies.service';
import { getRequiredAdminCompanyName } from '@/config/admin-env';
import { generateOperationId } from '@/services/enterprise-id.service';
import { withAuth, BYPASS_ROLES } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { FIELDS } from '@/config/firestore-field-constants';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

/**
 * ENTERPRISE POPULATE ROUTE: Create Buildings from Templates
 *
 * Server-only admin endpoint that populates buildings from Firestore templates.
 * Includes GET endpoint for verification of existing buildings.
 *
 * NOTE: POST is functionally identical to /api/buildings/seed — both delegate to
 * the SAME route factory. The distinction is kept for backward compatibility and
 * semantic clarity, and survives only in the audit trail (`source` / `operationPrefix`).
 *
 * SECURITY GATES:
 * - server-only (import 'server-only')
 * - withAuth + requiredGlobalRoles: BYPASS_ROLES (both GET and POST)
 * - Admin SDK only (getAdminFirestore)
 *
 * @method POST - Create buildings from templates
 * @method GET - Verify existing buildings for company
 * @requires ADMIN_COMPANY_NAME - Server-only env var
 * @requires super_admin role
 *
 * @author Enterprise Architecture Team
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Building summary for GET endpoint
 */
interface BuildingSummary {
  id: string;
  name: string;
  status: string;
  address?: string;
  totalValue?: number;
  createdAt: unknown;
}

/** Response type for populate GET */
interface VerifyResponse {
  success: boolean;
  error?: string;
  suggestion?: string;
  operationId: string;
  totalBuildings?: number;
  projectGroups?: Record<string, BuildingSummary[]>;
  company?: string;
  companyId?: string;
  timestamp?: string;
  details?: string;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * @rateLimit STANDARD (60 req/min) - CRUD
 */
export const POST = buildingInstantiationRoute({
  source: 'api/buildings/populate',
  operationPrefix: 'POPULATE_BUILDINGS',
  createdBy: 'populate-operation',
  includeEnterpriseFields: true,
});

// ============================================================================
// VERIFICATION ENDPOINT
// ============================================================================

/**
 * @rateLimit STANDARD (60 req/min) - CRUD
 */
export const GET = withStandardRateLimit(
  withAuth<VerifyResponse>(
  async (_request: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => {
    const operationId = generateOperationId();

    audit(operationId, 'VERIFY_BUILDINGS_START', {
      source: 'api/buildings/populate',
    });

    try {
      let companyName: string;
      try {
        companyName = getRequiredAdminCompanyName();
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: getErrorMessage(error),
            suggestion: 'Add ADMIN_COMPANY_NAME to .env.local',
            operationId,
          },
          { status: 500 }
        );
      }

      const company = await getCompanyByName(companyName);
      if (!company || !company.id) {
        return NextResponse.json(
          {
            success: false,
            error: `Company "${companyName}" not found in database`,
            suggestion: 'Ensure company data exists',
            operationId,
          },
          { status: 404 }
        );
      }

      const companyId = company.id;

      // Get Admin Firestore instance
      const db = getAdminFirestore();
      const buildingsSnapshot = await db
        .collection(SERVER_COLLECTIONS.BUILDINGS)
        .where(FIELDS.COMPANY_ID, '==', companyId)
        .get();

      const projectGroups: Record<string, BuildingSummary[]> = {};
      buildingsSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const projectId = (data.projectId as string) || 'unassigned';

        if (!projectGroups[projectId]) {
          projectGroups[projectId] = [];
        }
        projectGroups[projectId].push({
          id: docSnap.id,
          name: data.name as string,
          status: data.status as string,
          address: data.address as string | undefined,
          totalValue: data.totalValue as number | undefined,
          createdAt: data.createdAt,
        });
      });

      audit(operationId, 'VERIFY_BUILDINGS_COMPLETE', {
        totalBuildings: buildingsSnapshot.docs.length,
        projectCount: Object.keys(projectGroups).length,
        companyId,
      });

      return NextResponse.json({
        success: true,
        operationId,
        totalBuildings: buildingsSnapshot.docs.length,
        projectGroups,
        company: company.companyName,
        companyId,
        timestamp: nowISO(),
      });
    } catch (error) {
      audit(operationId, 'VERIFY_BUILDINGS_ERROR', {
        error: getErrorMessage(error),
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Buildings verification failed',
          details: getErrorMessage(error),
          operationId,
        },
        { status: 500 }
      );
    }
  },
  { requiredGlobalRoles: BYPASS_ROLES }
  )
);
