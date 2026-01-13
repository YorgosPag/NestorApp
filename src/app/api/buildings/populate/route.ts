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
 * GATES:
 * - server-only (import 'server-only')
 * - Environment allowlist (dev/staging only)
 * - Firebase Auth ID token with admin role claim (POST only)
 *
 * @method POST - Create buildings from templates
 * @method GET - Verify existing buildings for company
 * @requires ADMIN_COMPANY_NAME - Server-only env var
 * @requires Authorization: Bearer <idToken> (POST only)
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

// ============================================================================
// API ENDPOINTS
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
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
}

// ============================================================================
// VERIFICATION ENDPOINT
// ============================================================================

export async function GET(): Promise<NextResponse> {
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
}
