/**
 * =============================================================================
 * DATABASE NORMALIZATION MIGRATION - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * Enterprise database normalization (3NF) using Firebase Admin SDK.
 * Extracts embedded buildingFloors arrays to normalized floors collection.
 *
 * @module api/admin/migrations/normalize-floors
 * @enterprise RFC v6 - Authorization & RBAC System
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute (super_admin ONLY)
 * - System-Level Operation: Cross-tenant database normalization
 * - Multi-Layer Security: withAuth + explicit super_admin check
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { handleFloorsNormalization } from './normalize-floors-operations';

/**
 * POST /api/admin/migrations/normalize-floors
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute
 * - Super_admin ONLY (explicit check in handler)
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export async function POST(request: NextRequest): Promise<Response> {
  const handler = withSensitiveRateLimit(withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleFloorsNormalization(req, ctx);
    },
    { permissions: 'admin:migrations:execute' }
  ));

  return handler(request);
}
