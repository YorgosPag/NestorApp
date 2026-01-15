import 'server-only';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  audit,
  getAdminFirestore,
  SERVER_COLLECTIONS,
} from '@/server/admin/admin-guards';
import { handleBuildingInstantiation } from '@/server/admin/building-instantiation-handler';
import { getCompanyByName } from '@/services/companies.service';
import { getRequiredAdminCompanyName } from '@/config/admin-env';
import { generateOperationId } from '@/services/enterprise-id.service';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';

/**
 * ENTERPRISE POPULATE ROUTE: Create Buildings from Templates
 *
 * Server-only admin endpoint that populates buildings from Firestore templates.
 * Uses shared handler from building-instantiation-handler.ts for POST.
 * Includes GET endpoint for verification of existing buildings.
 *
 * NOTE: POST is functionally identical to /api/buildings/seed.
 * Both routes use the same shared handler. The distinction is maintained
 * for backward compatibility and semantic clarity.
 *
 * SECURITY GATES:
 * - server-only (import 'server-only')
 * - withAuth + requiredGlobalRoles: 'super_admin' (both GET and POST)
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

/** Response type for populate POST */
interface PopulateResponse {
  success: boolean;
  error?: string;
  suggestion?: string;
  operationId: string;
  message?: string;
  summary?: {
    totalTemplates: number;
    created: number;
    skipped: number;
    errors: number;
    companyId: string;
    companyName: string;
  };
  results?: unknown[];
  companyId?: string;
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

export const POST = withAuth<PopulateResponse>(
  async (request: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => {
    const response = await handleBuildingInstantiation(request, {
      source: 'api/buildings/populate',
      operationPrefix: 'POPULATE_BUILDINGS',
      createdBy: 'populate-operation',
      includeEnterpriseFields: true,
    });

    return NextResponse.json(
      {
        success: response.success,
        error: response.error,
        suggestion: response.suggestion,
        operationId: response.operationId,
        message: response.message,
        summary: response.summary,
        results: response.results,
        companyId: response.companyId,
      },
      { status: response.statusCode }
    );
  },
  { requiredGlobalRoles: 'super_admin' }
);

// ============================================================================
// VERIFICATION ENDPOINT
// ============================================================================

export const GET = withAuth<VerifyResponse>(
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
            error: (error as Error).message,
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
        .where('companyId', '==', companyId)
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
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      audit(operationId, 'VERIFY_BUILDINGS_ERROR', {
        error: (error as Error).message,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Buildings verification failed',
          details: (error as Error).message,
          operationId,
        },
        { status: 500 }
      );
    }
  },
  { requiredGlobalRoles: 'super_admin' }
);
