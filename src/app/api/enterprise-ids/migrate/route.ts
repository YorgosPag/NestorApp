/**
 * 🚀 ENTERPRISE ID MIGRATION API ENDPOINT
 *
 * ✅ PURE HTTP: μόνο Request/Response (40 γραμμές)
 * ✅ NO DUPLICATES: όλη η λογική στον MigrationController
 * ✅ CLEAN: Route → Controller pattern
 * 🔒 SECURITY: Protected with super_admin role (2026-02-06)
 */

import { NextResponse } from 'next/server';
import { MigrationPhase, type MigrationStats } from '@/services/enterprise-id-migration.service';
import { EntityType, isValidEntityType } from '@/services/relationships/enterprise-relationship-engine.contracts';
import { MigrationController, type MigrationConfig } from './migration-controller';
import { withAuth } from '@/lib/auth/middleware';
import { getErrorMessage } from '@/lib/error-utils';

const controller = new MigrationController();

// =============================================================================
// TYPES
// =============================================================================

interface MigrationStatusResponse {
  success: boolean;
  message: string;
  stats: MigrationStats;
  phase: MigrationPhase;
}

interface MigrationExecutionResponse {
  success: boolean;
  message?: string;
  errors?: readonly string[]; // 🏢 ENTERPRISE: readonly for type compatibility with MigrationResult
  stats?: MigrationStats;
}

// =============================================================================
// API HANDLERS
// =============================================================================

/**
 * 🔒 GET /api/enterprise-ids/migrate - Get migration status
 *
 * @security super_admin only
 * @returns Migration status and statistics
 */
export const GET = withAuth<MigrationStatusResponse>(
  async (_req, _ctx, _cache) => {
    try {
      const { stats, phase } = controller.getMigrationStatus();
      return NextResponse.json({ success: true, message: 'Status retrieved', stats, phase });
    } catch (error) {
      return NextResponse.json({
        success: false,
        message: 'Failed to get status',
        stats: {} as MigrationStats,
        phase: MigrationPhase.DUAL_SUPPORT,
        errors: [getErrorMessage(error)]
      }, { status: 500 });
    }
  },
  { requiredGlobalRoles: 'super_admin' }
);

/**
 * 🔒 POST /api/enterprise-ids/migrate - Execute migration
 *
 * @security super_admin only
 * @body MigrationConfig - Migration configuration
 * @returns Migration execution results
 */
export const POST = withAuth<MigrationExecutionResponse>(
  async (req, _ctx, _cache) => {
    try {
      const body = await req.json();
      const config: MigrationConfig = {
        phase: body.phase || MigrationPhase.DUAL_SUPPORT,
        entityTypes: validateEntityTypes(body.entityTypes || ['company', 'project', 'building', 'unit', 'contact']),
        dryRun: body.dryRun || false,
        batchSize: body.batchSize || 10
      };

      const result = await controller.executeMigration(config);
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json({
        success: false,
        message: 'Migration failed',
        errors: [getErrorMessage(error)]
      }, { status: 500 });
    }
  },
  { requiredGlobalRoles: 'super_admin' }
);

function validateEntityTypes(types: readonly string[]): readonly EntityType[] {
  return types.filter((type): type is EntityType => isValidEntityType(type));
}