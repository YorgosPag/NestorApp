import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import {
  createDryRunReport,
  createLiveMigrationReport,
  DxfMigrationAPI,
  executeDxfMigrationAudit,
} from './migration-operations';

const logger = createModuleLogger('MigrateDxfRoute');

const createForbiddenResponse = (action: 'preview' | 'execute'): NextResponse => {
  const actionLabel = action === 'preview' ? 'preview' : 'execute';
  const message = action === 'preview'
    ? 'DXF migrations are system-level operations restricted to super_admin'
    : 'DXF data migration is a system-level operation restricted to super_admin';

  return NextResponse.json(
    {
      success: false,
      error: `Forbidden: Only super_admin can ${actionLabel} DXF migrations`,
      message,
    },
    { status: 403 },
  );
};

const ensureSuperAdmin = (ctx: AuthContext, action: 'preview' | 'execute'): NextResponse | null => {
  if (ctx.globalRole === 'super_admin') {
    return null;
  }

  logger.warn(`BLOCKED: Non-super_admin attempted DXF migration ${action}`, {
    email: ctx.email,
    globalRole: ctx.globalRole,
  });

  return createForbiddenResponse(action);
};

export const GET = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    const forbiddenResponse = ensureSuperAdmin(ctx, 'preview');
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    logger.info('DXF migration preview request', { email: ctx.email, globalRole: ctx.globalRole, companyId: ctx.companyId });

    try {
      logger.info('DXF Migration - DRY RUN Analysis');
      const migrator = new DxfMigrationAPI(true);
      const analysis = await migrator.analyzeLegacyData();
      const report = createDryRunReport(analysis);

      logger.info('DRY RUN result', { legacyFiles: analysis.legacyFiles.length, properFiles: analysis.properFiles.length });
      return NextResponse.json({ success: true, ...report });
    } catch (error: unknown) {
      logger.error('DRY RUN Analysis failed', { error });
      return NextResponse.json(
        {
          success: false,
          error: 'DRY RUN Analysis failed',
          details: getErrorMessage(error),
        },
        { status: 500 },
      );
    }
  },
  { permissions: 'admin:migrations:execute' },
));

export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    const forbiddenResponse = ensureSuperAdmin(ctx, 'execute');
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    logger.info('DXF migration execute request', { email: ctx.email, globalRole: ctx.globalRole, companyId: ctx.companyId });
    const startTime = Date.now();

    try {
      logger.info('DXF Migration - LIVE MIGRATION');
      const analysisMigrator = new DxfMigrationAPI(true);
      const analysis = await analysisMigrator.analyzeLegacyData();

      if (analysis.legacyFiles.length === 0) {
        logger.info('No legacy files to migrate');
        return NextResponse.json({
          success: true,
          mode: 'LIVE_MIGRATION',
          message: 'No legacy files to migrate - all files are already using Storage format!',
          summary: {
            migratedCount: 0,
            alreadyProperCount: analysis.properFiles.length,
          },
        });
      }

      const migrator = new DxfMigrationAPI(false);
      const migrationResult = await migrator.migrateLegacyFiles(analysis);
      const report = createLiveMigrationReport(analysis, migrationResult, Date.now() - startTime);

      logger.info('Migration completed', {
        migratedCount: migrationResult.migratedCount,
        failedCount: migrationResult.failedCount,
      });

      await executeDxfMigrationAudit(req, ctx, analysis, report, migrationResult);

      if (migrationResult.errors.length > 0) {
        return NextResponse.json({ success: false, ...report }, { status: 207 });
      }

      return NextResponse.json({ success: true, ...report });
    } catch (error: unknown) {
      logger.error('LIVE Migration failed', { error });
      return NextResponse.json(
        {
          success: false,
          error: 'LIVE Migration failed',
          details: getErrorMessage(error),
        },
        { status: 500 },
      );
    }
  },
  { permissions: 'admin:migrations:execute' },
));
