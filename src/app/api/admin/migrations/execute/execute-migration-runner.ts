/**
 * =============================================================================
 * migrations/execute — POST dispatch logic (ADR-704 split)
 * =============================================================================
 *
 * Meta-router over heterogeneous migration modules: engine-driven migrations
 * (001/002/003) + self-executing "special" migrations (005/006). Extracted
 * from route.ts; the two special cases (previously copy-pasted twins) are
 * unified behind one `SpecialSpec` behavior descriptor.
 *
 * @module api/admin/migrations/execute/runner
 * @enterprise RFC v6 - Authorization & RBAC System
 */

import { NextRequest, NextResponse } from 'next/server';
import { logMigrationExecuted, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth/types';
import { isRoleBypass } from '@/lib/auth/roles';
import { MigrationEngine } from '@/database/migrations/MigrationEngine';
import { createProjectCompanyRelationshipsMigration } from '@/database/migrations/001_fix_project_company_relationships';
import { createFloorsNormalizationMigration } from '@/database/migrations/002_normalize_floors_collection';
import { createEnterpriseArchitectureConsolidationMigration } from '@/database/migrations/003_enterprise_database_architecture_consolidation';
import { migration as projectCodesMigration, executeDryRun as projectCodesDryRun, executeMigration as projectCodesExecute } from '@/database/migrations/005_assign_project_codes';
import { migration as storageBuildingMigration, dryRun as storageBuildingDryRun, execute as storageBuildingExecute } from '@/database/migrations/006_normalize_storage_building_references';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import { KNOWN_MIGRATION_IDS } from './execute-migration-catalog';

const logger = createModuleLogger('MigrationExecuteRoute');
const SYSTEM = 'Nestor Pagonis Enterprise Platform';

type MigrationObj = ReturnType<typeof createProjectCompanyRelationshipsMigration>;

interface MigrationMeta { id: string; name: string; version: string; description: string; author: string }

/** A self-executing migration that owns its own dry-run/execute functions. */
interface SpecialSpec {
  migration: MigrationMeta;
  run: (dryRun: boolean) => Promise<unknown>;
  affected?: (result: unknown) => number | undefined;
  shouldAudit?: (result: unknown) => boolean;
}

function env() {
  return { nodeEnv: process.env.NODE_ENV, timestamp: nowISO(), system: SYSTEM };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function resolveStandardMigration(id: string): MigrationObj | null {
  switch (id) {
    case '001_fix_project_company_relationships':
      return createProjectCompanyRelationshipsMigration();
    case '002_normalize_floors_collection':
      return createFloorsNormalizationMigration();
    case '003_enterprise_database_architecture_consolidation':
      return createEnterpriseArchitectureConsolidationMigration();
    default:
      return null;
  }
}

function resolveSpecialSpec(id: string): SpecialSpec | null {
  if (id === '005_assign_project_codes') {
    return {
      migration: projectCodesMigration,
      run: (dryRun) => (dryRun ? projectCodesDryRun() : projectCodesExecute({ dryRun: false })),
    };
  }
  if (id === '006_normalize_storage_building_references') {
    return {
      migration: storageBuildingMigration,
      run: (dryRun) => (dryRun ? storageBuildingDryRun() : storageBuildingExecute({ dryRun: false })),
      affected: (r) =>
        r && typeof r === 'object' && 'affectedRecords' in r
          ? (r as { affectedRecords?: number }).affectedRecords
          : undefined,
      shouldAudit: (r) =>
        Boolean(r && typeof r === 'object' && 'success' in r && (r as { success?: boolean }).success),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Special (self-executing) path — 005 / 006
// ---------------------------------------------------------------------------

async function auditSpecial(
  spec: SpecialSpec,
  result: unknown,
  request: NextRequest,
  ctx: AuthContext,
  startTime: number,
): Promise<void> {
  const payload: Record<string, unknown> = {
    migrationName: spec.migration.name,
    mode: 'PRODUCTION',
    totalTimeMs: Date.now() - startTime,
    result: 'success',
    metadata: extractRequestMetadata(request),
  };
  const affected = spec.affected?.(result);
  if (affected !== undefined) payload.affectedRecords = affected;

  await logMigrationExecuted(ctx, spec.migration.id, payload, `Migration executed by ${ctx.globalRole} ${ctx.email}`)
    .catch((err: unknown) => logger.warn('Audit logging failed (non-blocking)', { error: err }));
}

async function runSpecialMigration(
  spec: SpecialSpec,
  dryRun: boolean,
  request: NextRequest,
  ctx: AuthContext,
  startTime: number,
): Promise<NextResponse> {
  const result = await spec.run(dryRun);

  const response = {
    success: true,
    migration: {
      id: spec.migration.id,
      name: spec.migration.name,
      version: spec.migration.version,
      description: spec.migration.description,
      author: spec.migration.author,
    },
    execution: {
      mode: dryRun ? 'DRY_RUN' : 'PRODUCTION',
      startedAt: new Date(startTime).toISOString(),
      completedAt: nowISO(),
      totalTimeMs: Date.now() - startTime,
      result,
    },
    environment: env(),
  };

  if (!dryRun && (spec.shouldAudit ? spec.shouldAudit(result) : true)) {
    await auditSpecial(spec, result, request, ctx, startTime);
  }

  return NextResponse.json(response, { status: 200 });
}

// ---------------------------------------------------------------------------
// Standard (engine-driven) path — 001 / 002 / 003
// ---------------------------------------------------------------------------

async function auditStandard(
  migration: MigrationObj,
  result: { affectedRecords?: number; executionTimeMs?: number },
  request: NextRequest,
  ctx: AuthContext,
  totalTimeMs: number,
): Promise<void> {
  await logMigrationExecuted(ctx, migration.id, {
    migrationName: migration.name,
    mode: 'PRODUCTION',
    affectedRecords: result.affectedRecords,
    executionTimeMs: result.executionTimeMs,
    totalTimeMs,
    result: 'success',
    metadata: extractRequestMetadata(request),
  }, `Migration executed by ${ctx.globalRole} ${ctx.email}`)
    .catch((err: unknown) => logger.warn('Audit logging failed (non-blocking)', { error: err }));
}

async function runStandardMigration(
  migration: MigrationObj,
  dryRun: boolean,
  request: NextRequest,
  ctx: AuthContext,
  startTime: number,
): Promise<NextResponse> {
  const engine = new MigrationEngine({
    enableBackup: true,
    enableRollback: true,
    validateBeforeExecute: true,
    validateAfterExecute: true,
    maxRetries: 3,
    timeoutMs: 300000, // 5 minutes
    batchSize: 100,
  });

  const result = dryRun ? await engine.dryRun(migration) : await engine.executeMigration(migration);
  const totalTimeMs = Date.now() - startTime;

  const response = {
    success: result.success,
    migration: {
      id: migration.id,
      name: migration.name,
      version: migration.version,
      description: migration.description,
      author: migration.author,
    },
    execution: {
      mode: dryRun ? 'DRY_RUN' : 'PRODUCTION',
      startedAt: new Date(startTime).toISOString(),
      completedAt: nowISO(),
      executionTimeMs: result.executionTimeMs,
      totalTimeMs,
      affectedRecords: result.affectedRecords,
    },
    result: { success: result.success, errors: result.errors || [], warnings: result.warnings || [] },
    environment: env(),
  };

  if (result.success) {
    logger.info('MIGRATION COMPLETED SUCCESSFULLY', {
      affectedRecords: result.affectedRecords,
      executionTimeMs: result.executionTimeMs,
      totalTimeMs,
    });
    if (!dryRun) await auditStandard(migration, result, request, ctx, totalTimeMs);
  } else {
    logger.error('MIGRATION FAILED', {
      errors: result.errors?.length || 0,
      warnings: result.warnings?.length || 0,
    });
  }

  return NextResponse.json(response, { status: result.success ? 200 : 500 });
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function dispatchMigration(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🔐 Migrations are SYSTEM-LEVEL (NOT tenant-scoped) — bypass roles ONLY
  if (!isRoleBypass(ctx.globalRole)) {
    logger.warn('BLOCKED: Non-super_admin attempted migration execution', { email: ctx.email, globalRole: ctx.globalRole });
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can execute migrations',
        message: 'Migrations are system-level operations restricted to super_admin',
      },
      { status: 403 },
    );
  }

  logger.info('Migration request', { email: ctx.email, globalRole: ctx.globalRole, companyId: ctx.companyId });

  try {
    const { migrationId, dryRun = false } = await request.json();
    logger.info('ENTERPRISE MIGRATION SYSTEM', { migrationId, dryRun, startedAt: nowISO() });

    const special = resolveSpecialSpec(migrationId);
    if (special) return await runSpecialMigration(special, dryRun, request, ctx, startTime);

    const migration = resolveStandardMigration(migrationId);
    if (migration) return await runStandardMigration(migration, dryRun, request, ctx, startTime);

    return NextResponse.json(
      { success: false, error: `Unknown migration ID: ${migrationId}`, availableMigrations: KNOWN_MIGRATION_IDS },
      { status: 400 },
    );
  } catch (error) {
    const totalTimeMs = Date.now() - startTime;
    logger.error('MIGRATION SYSTEM ERROR', { error: getErrorMessage(error) });
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
        execution: { startedAt: new Date(startTime).toISOString(), failedAt: nowISO(), totalTimeMs },
        environment: env(),
      },
      { status: 500 },
    );
  }
}
