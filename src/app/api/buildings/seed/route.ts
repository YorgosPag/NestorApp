import 'server-only';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { handleBuildingInstantiation } from '@/server/admin/building-instantiation-handler';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

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
 * SECURITY GATES:
 * - server-only (import 'server-only')
 * - withAuth + requiredGlobalRoles: 'super_admin'
 * - Admin SDK only (via handleBuildingInstantiation)
 *
 * @method POST - Create buildings from templates
 * @requires ADMIN_COMPANY_NAME - Server-only env var
 * @requires super_admin role
 *
 * @author Enterprise Architecture Team
 */

// ============================================================================
// TYPES
// ============================================================================

/** Response type for seed POST */
interface SeedResponse {
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

// ============================================================================
// API ENDPOINT
// ============================================================================

/**
 * @rateLimit STANDARD (60 req/min) - CRUD
 */
export const POST = withStandardRateLimit(
  withAuth<SeedResponse>(
  async (request: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => {
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
  },
  { requiredGlobalRoles: 'super_admin' }
  )
);
