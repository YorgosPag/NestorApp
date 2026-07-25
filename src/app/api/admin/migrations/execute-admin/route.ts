/**
 * =============================================================================
 * ADMIN SDK MIGRATION - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * Enterprise migration using Firebase Admin SDK to fix project-company
 * relationships via batch operations + verification. Logic lives in
 * `execute-admin-operations.ts` (ADR-704 split).
 *
 * @module api/admin/migrations/execute-admin
 * @enterprise RFC v6 - Authorization & RBAC System
 *
 * 🔒 SECURITY: super_admin ONLY (bypass roles) + withSensitiveRateLimit
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { runAdminSdkMigration } from './execute-admin-operations';

export async function POST(request: NextRequest): Promise<Response> {
  const handler = withSensitiveRateLimit(withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
      runAdminSdkMigration(req, ctx),
    { permissions: 'admin:migrations:execute' }
  ));

  return handler(request);
}
