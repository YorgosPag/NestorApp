/**
 * Enterprise Migration Execution API
 * Production-grade endpoint for database migrations
 */

import { NextRequest, NextResponse } from 'next/server';
import { MigrationEngine } from '@/database/migrations/MigrationEngine';
import { createProjectCompanyRelationshipsMigration } from '@/database/migrations/001_fix_project_company_relationships';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

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
      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown migration ID: ${migrationId}`,
            availableMigrations: [
              '001_fix_project_company_relationships'
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
      }
    ];

    return NextResponse.json({
      success: true,
      system: {
        name: 'Enterprise Migration System',
        version: '1.0.0',
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