/**
 * =============================================================================
 * ENTERPRISE MIGRATION EXECUTION API - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * POST executes a migration by id (engine-driven or self-executing); GET lists
 * available migrations (discovery). Dispatch logic lives in
 * `execute-migration-runner.ts`, catalog data in `execute-migration-catalog.ts`
 * (ADR-704 split).
 *
 * @module api/admin/migrations/execute
 * @enterprise RFC v6 - Authorization & RBAC System
 *
 * 🔒 SECURITY: super_admin ONLY (bypass roles) + withSensitiveRateLimit (POST)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import { dispatchMigration } from './execute-migration-runner';
import { AVAILABLE_MIGRATIONS } from './execute-migration-catalog';

export async function POST(request: NextRequest): Promise<Response> {
  const handler = withSensitiveRateLimit(withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
      dispatchMigration(req, ctx),
    { permissions: 'admin:migrations:execute' }
  ));

  return handler(request);
}

/**
 * GET /api/admin/migrations/execute — list available migrations (discovery).
 * Execution requires POST with admin:migrations:execute permission.
 */
export async function GET(): Promise<Response> {
  try {
    return NextResponse.json({
      success: true,
      system: {
        name: 'Enterprise Migration System',
        version: '2.0.0',
        security: 'AUTHZ Phase 2 - RBAC Protected (super_admin ONLY)',
        environment: process.env.NODE_ENV,
        timestamp: nowISO(),
      },
      availableMigrations: AVAILABLE_MIGRATIONS,
      capabilities: {
        dryRun: true,
        rollback: true,
        backup: true,
        validation: true,
        batchProcessing: true,
        timeoutProtection: true,
      },
      security: {
        authentication: 'Firebase Auth + withAuth middleware',
        permission: 'admin:migrations:execute',
        roles: ['super_admin'],
        auditLogging: 'All migrations logged to /companies/{companyId}/audit_logs',
        tenantScope: 'System-level (NOT tenant-scoped)',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error), timestamp: nowISO() },
      { status: 500 }
    );
  }
}
