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
import { ENTITY_TYPES, isPlatformEntityType, type EntityType } from '@/config/domain-constants';
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
        entityTypes: validateEntityTypes(body.entityTypes || DEFAULT_MIGRATION_ENTITY_TYPES),
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

/**
 * Default set migrated when the caller sends no `entityTypes`.
 *
 * ⚠️ This used to be a literal array containing `'unit'` — a spelling that has
 * never been an {@link ENTITY_TYPES} member. `validateEntityTypes` filters
 * unknown values SILENTLY, so the default migration quietly skipped properties
 * entirely and reported success over four types instead of five. Built from the
 * constants now, so an invented spelling cannot compile.
 */
const DEFAULT_MIGRATION_ENTITY_TYPES: readonly EntityType[] = [
  ENTITY_TYPES.COMPANY,
  ENTITY_TYPES.PROJECT,
  ENTITY_TYPES.BUILDING,
  ENTITY_TYPES.PROPERTY,
  ENTITY_TYPES.CONTACT,
];

function validateEntityTypes(types: readonly string[]): readonly EntityType[] {
  return types.filter(isPlatformEntityType);
}