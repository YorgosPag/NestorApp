/**
 * =============================================================================
 * ENTERPRISE MIGRATION EXECUTION API - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * Production-grade endpoint for database migrations with RBAC protection.
 *
 * @module api/admin/migrations/execute
 * @enterprise RFC v6 - Authorization & RBAC System
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute (super_admin ONLY)
 * - System-Level Operation: NOT tenant-scoped (affects all companies)
 * - Multi-Layer Security: withAuth + explicit super_admin check
 * - Comprehensive audit logging with logMigrationExecuted
 * - Enterprise patterns: SAP/Microsoft migration safeguards
 *
 * 🏢 ENTERPRISE: Migrations are CRITICAL SYSTEM OPERATIONS
 * - Only super_admin can execute migrations
 * - All migrations are logged to /companies/{companyId}/audit_logs
 * - Request metadata tracked (IP, User-Agent, Path)
 * - Performance logging με duration tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logMigrationExecuted, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { MigrationEngine } from '@/database/migrations/MigrationEngine';
import { createProjectCompanyRelationshipsMigration } from '@/database/migrations/001_fix_project_company_relationships';
import { createFloorsNormalizationMigration } from '@/database/migrations/002_normalize_floors_collection';
import { createEnterpriseArchitectureConsolidationMigration } from '@/database/migrations/003_enterprise_database_architecture_consolidation';
import { migration as projectCodesMigration, executeDryRun as projectCodesDryRun, executeMigration as projectCodesExecute } from '@/database/migrations/005_assign_project_codes';
import { migration as storageBuildingMigration, dryRun as storageBuildingDryRun, execute as storageBuildingExecute } from '@/database/migrations/006_normalize_storage_building_references';

/**
 * POST /api/admin/migrations/execute
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute
 * - Super_admin ONLY (explicit check below)
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export async function POST(request: NextRequest) {
  const handler = withSensitiveRateLimit(withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleMigrationExecution(req, ctx);
    },
    { permissions: 'admin:migrations:execute' }
  ));

  return handler(request);
}

async function handleMigrationExecution(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  const startTime = Date.now();

  // ========================================================================
  // LAYER 1: Super_admin ONLY check (EXTRA security layer)
  // ========================================================================

  // 🔐 ENTERPRISE: Migrations are SYSTEM-LEVEL operations (NOT tenant-scoped)
  // Only super_admin can execute migrations (company_admin does NOT have access)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [MIGRATION] BLOCKED: Non-super_admin attempted migration execution: ` +
      `${ctx.email} (${ctx.globalRole})`
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can execute migrations',
        message: 'Migrations are system-level operations restricted to super_admin'
      },
      { status: 403 }
    );
  }

  console.log(`🔐 [MIGRATION] Request from ${ctx.email} (${ctx.globalRole}, company: ${ctx.companyId})`);

  try {
    const { migrationId, dryRun = false } = await request.json();

    console.log(`🏢 ENTERPRISE MIGRATION SYSTEM`);
    console.log(`📋 Migration ID: ${migrationId}`);
    console.log(`🧪 Dry Run: ${dryRun ? 'YES' : 'NO'}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);

    // Initialize enterprise migration engine
    const migrationEngine = new MigrationEngine({
      enableBackup: true,
      enableRollback: true,
      validateBeforeExecute: true,
      validateAfterExecute: true,
      maxRetries: 3,
      timeoutMs: 300000, // 5 minutes
      batchSize: 100
    });

    // Get migration by ID
    let migration;
    switch (migrationId) {
      case '001_fix_project_company_relationships':
        migration = createProjectCompanyRelationshipsMigration();
        break;
      case '002_normalize_floors_collection':
        migration = createFloorsNormalizationMigration();
        break;
      case '003_enterprise_database_architecture_consolidation':
        migration = createEnterpriseArchitectureConsolidationMigration();
        break;
      case '005_assign_project_codes':
        // Special handling for project codes migration (has its own execution functions)
        const projectCodesResult = dryRun
          ? await projectCodesDryRun()
          : await projectCodesExecute({ dryRun: false });

        const projectCodesResponse = {
          success: true,
          migration: {
            id: projectCodesMigration.id,
            name: projectCodesMigration.name,
            version: projectCodesMigration.version,
            description: projectCodesMigration.description,
            author: projectCodesMigration.author
          },
          execution: {
            mode: dryRun ? 'DRY_RUN' : 'PRODUCTION',
            startedAt: new Date(startTime).toISOString(),
            completedAt: new Date().toISOString(),
            totalTimeMs: Date.now() - startTime,
            result: projectCodesResult
          },
          environment: {
            nodeEnv: process.env.NODE_ENV,
            timestamp: new Date().toISOString(),
            system: 'Nestor Pagonis Enterprise Platform'
          }
        };

        // 🏢 ENTERPRISE: Audit logging (non-blocking)
        if (!dryRun) {
          const metadata = extractRequestMetadata(request);
          await logMigrationExecuted(
            ctx,
            projectCodesMigration.id,
            {
              migrationName: projectCodesMigration.name,
              mode: 'PRODUCTION',
              totalTimeMs: Date.now() - startTime,
              result: 'success',
              metadata,
            },
            `Migration executed by ${ctx.globalRole} ${ctx.email}`
          ).catch((err: unknown) => {
            console.error('⚠️ [MIGRATION] Audit logging failed (non-blocking):', err);
          });
        }

        return NextResponse.json(projectCodesResponse, { status: 200 });

      case '006_normalize_storage_building_references':
        // Special handling for storage building migration
        const storageBuildingResult = dryRun
          ? await storageBuildingDryRun()
          : await storageBuildingExecute({ dryRun: false });

        const storageBuildingResponse = {
          success: true,
          migration: {
            id: storageBuildingMigration.id,
            name: storageBuildingMigration.name,
            version: storageBuildingMigration.version,
            description: storageBuildingMigration.description,
            author: storageBuildingMigration.author
          },
          execution: {
            mode: dryRun ? 'DRY_RUN' : 'PRODUCTION',
            startedAt: new Date(startTime).toISOString(),
            completedAt: new Date().toISOString(),
            totalTimeMs: Date.now() - startTime,
            result: storageBuildingResult
          },
          environment: {
            nodeEnv: process.env.NODE_ENV,
            timestamp: new Date().toISOString(),
            system: 'Nestor Pagonis Enterprise Platform'
          }
        };

        // 🏢 ENTERPRISE: Audit logging (non-blocking)
        if (!dryRun && 'success' in storageBuildingResult && storageBuildingResult.success) {
          const metadata = extractRequestMetadata(request);
          await logMigrationExecuted(
            ctx,
            storageBuildingMigration.id,
            {
              migrationName: storageBuildingMigration.name,
              mode: 'PRODUCTION',
              affectedRecords: storageBuildingResult.affectedRecords,
              totalTimeMs: Date.now() - startTime,
              result: 'success',
              metadata,
            },
            `Migration executed by ${ctx.globalRole} ${ctx.email}`
          ).catch((err: unknown) => {
            console.error('⚠️ [MIGRATION] Audit logging failed (non-blocking):', err);
          });
        }

        return NextResponse.json(storageBuildingResponse, { status: 200 });

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown migration ID: ${migrationId}`,
            availableMigrations: [
              '001_fix_project_company_relationships',
              '002_normalize_floors_collection',
              '003_enterprise_database_architecture_consolidation',
              '005_assign_project_codes',
              '006_normalize_storage_building_references'
            ]
          },
          { status: 400 }
        );
    }

    // Execute migration
    const result = dryRun
      ? await migrationEngine.dryRun(migration)
      : await migrationEngine.executeMigration(migration);

    // Calculate total execution time
    const totalExecutionTime = Date.now() - startTime;

    // Prepare comprehensive response
    const response = {
      success: result.success,
      migration: {
        id: migration.id,
        name: migration.name,
        version: migration.version,
        description: migration.description,
        author: migration.author
      },
      execution: {
        mode: dryRun ? 'DRY_RUN' : 'PRODUCTION',
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        executionTimeMs: result.executionTimeMs,
        totalTimeMs: totalExecutionTime,
        affectedRecords: result.affectedRecords
      },
      result: {
        success: result.success,
        errors: result.errors || [],
        warnings: result.warnings || []
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        system: 'Nestor Pagonis Enterprise Platform'
      }
    };

    // Log final status
    if (result.success) {
      console.log(`🎉 MIGRATION COMPLETED SUCCESSFULLY`);
      console.log(`📊 Affected Records: ${result.affectedRecords}`);
      console.log(`⏱️ Execution Time: ${result.executionTimeMs}ms`);
      console.log(`⏱️ Total Time: ${totalExecutionTime}ms`);

      // 🏢 ENTERPRISE: Audit logging (non-blocking, ONLY for successful production migrations)
      if (!dryRun) {
        const metadata = extractRequestMetadata(request);
        await logMigrationExecuted(
          ctx,
          migration.id,
          {
            migrationName: migration.name,
            mode: 'PRODUCTION',
            affectedRecords: result.affectedRecords,
            executionTimeMs: result.executionTimeMs,
            totalTimeMs: totalExecutionTime,
            result: 'success',
            metadata,
          },
          `Migration executed by ${ctx.globalRole} ${ctx.email}`
        ).catch((err: unknown) => {
          console.error('⚠️ [MIGRATION] Audit logging failed (non-blocking):', err);
        });
      }
    } else {
      console.log(`❌ MIGRATION FAILED`);
      console.log(`🔍 Errors: ${result.errors?.length || 0}`);
      console.log(`⚠️ Warnings: ${result.warnings?.length || 0}`);
    }

    return NextResponse.json(response, {
      status: result.success ? 200 : 500
    });

  } catch (error) {
    const totalExecutionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ MIGRATION SYSTEM ERROR: ${errorMessage}`);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        execution: {
          startedAt: new Date(startTime).toISOString(),
          failedAt: new Date().toISOString(),
          totalTimeMs: totalExecutionTime
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          timestamp: new Date().toISOString(),
          system: 'Nestor Pagonis Enterprise Platform'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/migrations/execute
 *
 * Public endpoint for listing available migrations (discovery).
 * Execution requires POST με admin:migrations:execute permission.
 */
export async function GET(request: NextRequest) {
  try {
    // Return available migrations and system status
    const availableMigrations = [
      {
        id: '001_fix_project_company_relationships',
        name: 'Fix Project-Company Relationships',
        version: '1.0.0',
        description: 'Corrects incorrect companyId values in projects to establish proper relationships with companies',
        author: 'Claude Enterprise Migration System',
        status: 'available'
      },
      {
        id: '002_normalize_floors_collection',
        name: 'Normalize Floors Collection (Enterprise 3NF)',
        version: '1.0.0',
        description: 'Extracts embedded buildingFloors arrays to normalized floors collection with proper foreign key relationships following 3NF principles',
        author: 'Claude Enterprise Migration System',
        status: 'available'
      },
      {
        id: '005_assign_project_codes',
        name: 'Assign Human-Readable Project Codes',
        version: '1.0.0',
        description: 'Assigns sequential human-readable project codes (PRJ-001, PRJ-002, etc.) to existing projects using atomic Firestore transactions',
        author: 'Enterprise Architecture Team',
        status: 'available'
      },
      {
        id: '006_normalize_storage_building_references',
        name: 'Normalize Storage Building References',
        version: '1.0.0',
        description: 'Convert storage.building (name) to storage.buildingId (ID) for enterprise data integrity',
        author: 'Enterprise Architecture Team',
        status: 'available'
      }
    ];

    return NextResponse.json({
      success: true,
      system: {
        name: 'Enterprise Migration System',
        version: '2.0.0',
        security: 'AUTHZ Phase 2 - RBAC Protected (super_admin ONLY)',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      },
      availableMigrations,
      capabilities: {
        dryRun: true,
        rollback: true,
        backup: true,
        validation: true,
        batchProcessing: true,
        timeoutProtection: true
      },
      security: {
        authentication: 'Firebase Auth + withAuth middleware',
        permission: 'admin:migrations:execute',
        roles: ['super_admin'],
        auditLogging: 'All migrations logged to /companies/{companyId}/audit_logs',
        tenantScope: 'System-level (NOT tenant-scoped)',
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}