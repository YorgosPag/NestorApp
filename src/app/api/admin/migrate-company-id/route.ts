/**
 * =============================================================================
 * MIGRATE COMPANY ID — API Route (ADR-210)
 * =============================================================================
 *
 * @method GET  - Dry-run: shows what WOULD change
 * @method POST - Execute: performs the full migration
 * @protection withAuth + super_admin only
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logSystemOperation, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { executeMigration } from './migration-operations';

const logger = createModuleLogger('MigrateCompanyId');

// =============================================================================
// GET — Dry Run
// =============================================================================

export const GET = withSensitiveRateLimit(
  withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      if (ctx.globalRole !== 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: super_admin required' },
          { status: 403 }
        );
      }

      logger.info('DRY RUN started', { callerEmail: ctx.email });

      const report = await executeMigration(ctx, true);

      return NextResponse.json({
        success: true,
        message: 'DRY RUN complete — no changes were made',
        report,
      });
    },
    { permissions: 'admin_access' }
  )
);

// =============================================================================
// POST — Execute Migration
// =============================================================================

export const maxDuration = 60;

export const POST = withSensitiveRateLimit(
  withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      if (ctx.globalRole !== 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: super_admin required' },
          { status: 403 }
        );
      }

      logger.info('EXECUTE started', { callerEmail: ctx.email });

      const report = await executeMigration(ctx, false);

      try {
        const metadata = extractRequestMetadata(req);
        await logSystemOperation(
          ctx,
          'company_id_migration',
          {
            oldCompanyId: report.oldCompanyId,
            newCompanyId: report.newCompanyId,
            totalDocumentsUpdated: report.totalDocumentsUpdated,
            collectionsCount: report.steps.collections.length,
            errorsCount: report.errors.length,
            ...metadata,
          },
          `Migrated company ID from ${report.oldCompanyId} to ${report.newCompanyId}. ` +
          `${report.totalDocumentsUpdated} documents updated across ${report.steps.collections.length} collections. ` +
          `${report.errors.length} errors.`
        );
      } catch {
        logger.warn('Audit logging failed (non-blocking)');
      }

      const hasErrors = report.errors.length > 0;

      return NextResponse.json({
        success: !hasErrors,
        message: hasErrors
          ? `Migration completed with ${report.errors.length} error(s)`
          : 'Migration completed successfully',
        report,
        nextSteps: [
          `1. Update src/config/tenant.ts: change LEGACY_TENANT_COMPANY_ID to '${report.newCompanyId}'`,
          `2. Rename constant to TENANT_COMPANY_ID (no longer legacy)`,
          '3. Update scripts with hardcoded old ID',
          '4. Commit + push',
          '5. Logout + Login to refresh Firebase token with new companyId',
          '6. Verify at /debug/token-info',
        ],
      });
    },
    { permissions: 'admin_access' }
  )
);
