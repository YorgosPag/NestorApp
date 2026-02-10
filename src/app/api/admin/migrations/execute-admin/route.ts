/**
 * =============================================================================
 * ADMIN SDK MIGRATION - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * Enterprise migration using Firebase Admin SDK for elevated permissions.
 * Fixes project-company relationships με batch operations.
 *
 * @module api/admin/migrations/execute-admin
 * @enterprise RFC v6 - Authorization & RBAC System
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute (super_admin ONLY)
 * - System-Level Operation: Cross-tenant database migration
 * - Multi-Layer Security: withAuth + explicit super_admin check
 * - Comprehensive audit logging with logMigrationExecuted
 * - Enterprise patterns: SAP/Microsoft migration safeguards
 *
 * 🏢 ENTERPRISE: Admin SDK Batch Operations
 * - Uses Firebase Admin SDK for elevated permissions
 * - Atomic batch operations for consistency
 * - Full verification με integrity score
 * - All operations logged to audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logMigrationExecuted, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ExecuteAdminMigrationRoute');

interface MigrationResult {
  success: boolean;
  affectedRecords: number;
  executionTimeMs: number;
  details: Record<string, unknown>;
}

/**
 * POST /api/admin/migrations/execute-admin
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute
 * - Super_admin ONLY (explicit check below)
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export async function POST(request: NextRequest): Promise<Response> {
  const handler = withSensitiveRateLimit(withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleAdminSdkMigration(req, ctx);
    },
    { permissions: 'admin:migrations:execute' }
  ));

  return handler(request);
}

async function handleAdminSdkMigration(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  const startTime = Date.now();

  // ========================================================================
  // LAYER 1: Super_admin ONLY check (EXTRA security layer)
  // ========================================================================

  // 🔐 ENTERPRISE: Admin SDK migrations are SYSTEM-LEVEL (cross-tenant)
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted Admin SDK migration', { email: ctx.email, globalRole: ctx.globalRole });
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can execute Admin SDK migrations',
        message: 'Admin SDK migrations are system-level operations restricted to super_admin'
      },
      { status: 403 }
    );
  }

  logger.info('Admin SDK migration request', { email: ctx.email, globalRole: ctx.globalRole, companyId: ctx.companyId });

  try {
    logger.info('ENTERPRISE ADMIN MIGRATION STARTING...');

    const adminDb = getAdminFirestore();

    // Step 1: Fetch all companies
    logger.info('Step 1: Fetching companies...');
    const companiesSnapshot = await adminDb.collection(COLLECTIONS.CONTACTS)
      .where('type', '==', 'company')
      .where('status', '==', 'active')
      .get();

    // 🏢 ENTERPRISE: Type-safe company/project data
    interface CompanyData { id: string; companyName?: string; }
    interface ProjectData { id: string; name?: string; company?: string; companyId?: string; }

    const companies: CompanyData[] = companiesSnapshot.docs.map(doc => ({
      id: doc.id,
      companyName: doc.data().companyName as string | undefined
    }));

    logger.info('Found active companies', { count: companies.length });

    // Step 2: Fetch all projects
    logger.info('Step 2: Fetching projects...');
    const projectsSnapshot = await adminDb.collection(COLLECTIONS.PROJECTS).get();
    const projects: ProjectData[] = projectsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name as string | undefined,
      company: doc.data().company as string | undefined,
      companyId: doc.data().companyId as string | undefined
    }));

    logger.info('Found projects', { count: projects.length });

    // Step 3: Analyze and create mappings
    logger.info('Step 3: Analyzing project-company mappings...');
    const mappings = [];

    for (const project of projects) {
      const matchingCompany = companies.find(
        company => company.companyName === project.company
      );

      if (matchingCompany && project.companyId !== matchingCompany.id) {
        mappings.push({
          projectId: project.id,
          projectName: project.name,
          oldCompanyId: project.companyId || '<empty>',
          newCompanyId: matchingCompany.id,
          companyName: matchingCompany.companyName
        });
      }
    }

    logger.info('Found projects requiring updates', { count: mappings.length });

    // Step 4: Execute updates using Admin SDK (batch operation)
    logger.info('Step 4: Executing batch updates...');
    const batch = adminDb.batch();
    let updateCount = 0;

    for (const mapping of mappings) {
      const projectRef = adminDb.collection(COLLECTIONS.PROJECTS).doc(mapping.projectId);

      batch.update(projectRef, {
        companyId: mapping.newCompanyId,
        updatedAt: new Date().toISOString(),
        migrationInfo: {
          migrationId: '001_fix_project_company_relationships_admin',
          migratedAt: new Date().toISOString(),
          oldCompanyId: mapping.oldCompanyId,
          newCompanyId: mapping.newCompanyId,
          migrationMethod: 'admin_sdk_batch'
        }
      });

      logger.info('Queued update', { projectName: mapping.projectName, companyName: mapping.companyName });
      updateCount++;
    }

    // Commit the batch
    if (updateCount > 0) {
      await batch.commit();
      logger.info('Successfully updated projects', { count: updateCount });
    } else {
      logger.info('No projects required updates');
    }

    // Step 5: Verification
    logger.info('Step 5: Verifying migration results...');
    const verificationSnapshot = await adminDb.collection(COLLECTIONS.PROJECTS).get();
    const updatedProjects: ProjectData[] = verificationSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name as string | undefined,
      company: doc.data().company as string | undefined,
      companyId: doc.data().companyId as string | undefined
    }));

    let validProjects = 0;
    let orphanProjects = 0;

    for (const project of updatedProjects) {
      const hasValidCompanyId = companies.some(company => company.id === project.companyId);
      if (hasValidCompanyId) {
        validProjects++;
      } else {
        orphanProjects++;
      }
    }

    const integrityScore = (validProjects / updatedProjects.length) * 100;

    logger.info('Final Results', { totalProjects: updatedProjects.length, validProjects, orphanProjects, integrityScore: integrityScore.toFixed(1) });

    const executionTime = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logMigrationExecuted(
      ctx,
      '001_fix_project_company_relationships_admin',
      {
        migrationName: 'Fix Project-Company Relationships (Admin SDK)',
        method: 'firebase_admin_batch',
        affectedRecords: updateCount,
        executionTimeMs: executionTime,
        integrityScore: parseFloat(integrityScore.toFixed(1)),
        totalProjects: updatedProjects.length,
        validProjects,
        orphanProjects,
        result: 'success',
        metadata,
      },
      `Admin SDK migration executed by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      logger.warn('Audit logging failed (non-blocking)', { error: err });
    });

    return NextResponse.json({
      success: true,
      migration: {
        id: '001_fix_project_company_relationships_admin',
        name: 'Fix Project-Company Relationships (Admin SDK)',
        method: 'firebase_admin_batch'
      },
      execution: {
        executionTimeMs: executionTime,
        affectedRecords: updateCount,
        completedAt: new Date().toISOString()
      },
      results: {
        mappings: mappings.map(m => ({
          projectName: m.projectName,
          companyName: m.companyName,
          oldCompanyId: m.oldCompanyId,
          newCompanyId: m.newCompanyId
        })),
        verification: {
          totalProjects: updatedProjects.length,
          validProjects,
          orphanProjects,
          integrityScore: parseFloat(integrityScore.toFixed(1))
        }
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        system: 'Nestor Pagonis Enterprise Platform - Admin SDK'
      }
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('ADMIN MIGRATION FAILED', { error: errorMessage });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        execution: {
          executionTimeMs: executionTime,
          failedAt: new Date().toISOString()
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          timestamp: new Date().toISOString(),
          system: 'Nestor Pagonis Enterprise Platform - Admin SDK'
        }
      },
      { status: 500 }
    );
  }
}