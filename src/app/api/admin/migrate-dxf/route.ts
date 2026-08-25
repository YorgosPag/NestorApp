import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { BYPASS_ROLES } from '@/lib/auth/roles';
import {
  createDryRunReport,
  createLiveMigrationReport,
  DxfMigrationAPI,
  executeDxfMigrationAudit,
} from './migration-operations';

const logger = createModuleLogger('MigrateDxfRoute');

export const GET = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
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
  { requiredGlobalRoles: BYPASS_ROLES, permissions: 'admin:migrations:execute' },
));

export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
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
  { requiredGlobalRoles: BYPASS_ROLES, permissions: 'admin:migrations:execute' },
));
