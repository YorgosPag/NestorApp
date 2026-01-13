import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { handleBuildingInstantiation } from '@/server/admin/building-instantiation-handler';

/**
 * ENTERPRISE SEED ROUTE: Create Buildings from Templates
 *
 * Server-only admin endpoint that creates buildings from Firestore templates.
 * Uses shared handler from building-instantiation-handler.ts.
 *
 * NOTE: This route is functionally identical to /api/buildings/populate.
 * Both routes use the same shared handler. The distinction is maintained
 * for backward compatibility and semantic clarity (seed vs populate naming).
 *
 * GATES:
 * - server-only (import 'server-only')
 * - Environment allowlist (dev/staging only)
 * - Firebase Auth ID token with admin role claim
 *
 * @method POST - Create buildings from templates
 * @requires ADMIN_COMPANY_NAME - Server-only env var
 * @requires Authorization: Bearer <idToken>
 *
 * @author Enterprise Architecture Team
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  const response = await handleBuildingInstantiation(request, {
    source: 'api/buildings/seed',
    operationPrefix: 'SEED_BUILDINGS',
    createdBy: 'seed-operation',
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
