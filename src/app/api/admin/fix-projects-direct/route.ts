/**
 * =============================================================================
 * FIX PROJECTS DIRECT - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Direct Admin SDK fix for project companyIds
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification System-level operation (data fix)
 *
 * This endpoint uses Firebase Admin SDK to directly update project companyIds
 * bypassing Firestore security rules for emergency data fixes.
 *
 * @method GET - System information
 * @method POST - Execute direct companyId fix
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:direct:operations permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - Layer 3: Audit logging (logDirectOperation)
 *   - Layer 4: Firebase Admin SDK (elevated permissions)
 *
 * @technology Firebase Admin SDK (bypasses Firestore rules)
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDirectOperation, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * POST - Execute Direct Project Fix (withAuth protected)
 * Updates project companyIds using Firebase Admin SDK.
 *
 * @security withAuth + super_admin check + audit logging + admin:direct:operations permission
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleFixProjectsDirectExecute(req, ctx);
  },
  { permissions: 'admin:direct:operations' }
));

/**
 * Internal handler for POST (direct project fix).
 */
async function handleFixProjectsDirectExecute(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [POST /api/admin/fix-projects-direct] BLOCKED: Non-super_admin attempted direct project fix`,
      { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole }
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: This operation requires super_admin role',
        code: 'SUPER_ADMIN_REQUIRED',
      },
      { status: 403 }
    );
  }

  try {
    const adminDb = getAdminFirestore();

    console.log('🔧 ENTERPRISE DIRECT FIX: Project CompanyIDs');
    console.log('⏰ Started at:', new Date().toISOString());

    // 🏢 ENTERPRISE: Load target company ID from environment
    const correctCompanyId = process.env.NEXT_PUBLIC_MAIN_COMPANY_ID || 'default-company-id';

    // Get all projects using Admin SDK
    console.log('📋 Loading all projects...');
    const projectsSnapshot = await adminDb.collection(COLLECTIONS.PROJECTS).get();

    if (projectsSnapshot.empty) {
      console.log('⚠️ No projects found in database');
      return NextResponse.json({
        success: false,
        error: 'No projects found in database',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    console.log(`📊 Found ${projectsSnapshot.size} projects`);

    // Process each project
    const updates = [];
    const errors = [];

    for (const doc of projectsSnapshot.docs) {
      const project = doc.data();
      const projectId = doc.id;

      console.log(`🔍 Project ${projectId}:`);
      console.log(`   Current companyId: "${project.companyId || '(empty)'}"`);
      console.log(`   Project name: "${project.name}"`);
      console.log(`   Company: "${project.company}"`);

      // Check if update is needed
      if (project.companyId !== correctCompanyId) {
        console.log(`🔄 Updating project ${projectId} companyId`);
        console.log(`   From: "${project.companyId || '(empty)'}"`);
        console.log(`   To: "${correctCompanyId}"`);

        try {
          // Direct Admin SDK update - bypasses all permissions
          await adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).update({
            companyId: correctCompanyId
          });

          updates.push({
            projectId,
            projectName: project.name,
            oldCompanyId: project.companyId || '(empty)',
            newCompanyId: correctCompanyId,
            status: 'SUCCESS'
          });

          console.log(`✅ Successfully updated project ${projectId}`);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Failed to update project ${projectId}:`, errorMessage);

          errors.push({
            projectId,
            projectName: project.name,
            error: errorMessage
          });
        }
      } else {
        console.log(`✅ Project ${projectId} already has correct companyId`);
        updates.push({
          projectId,
          projectName: project.name,
          oldCompanyId: project.companyId,
          newCompanyId: correctCompanyId,
          status: 'NO_CHANGE_NEEDED'
        });
      }
    }

    // Verification: Re-read all projects to confirm updates
    console.log('🔍 Verifying updates...');
    const verificationSnapshot = await adminDb.collection(COLLECTIONS.PROJECTS).get();
    const verificationResults = [];

    for (const doc of verificationSnapshot.docs) {
      const project = doc.data();
      verificationResults.push({
        projectId: doc.id,
        projectName: project.name,
        companyId: project.companyId,
        isCorrect: project.companyId === correctCompanyId
      });
    }

    const totalExecutionTime = Date.now() - startTime;
    const successfulUpdates = updates.filter(u => u.status === 'SUCCESS').length;
    const totalProjects = projectsSnapshot.size;
    const correctProjects = verificationResults.filter(p => p.isCorrect).length;

    console.log('📊 FINAL RESULTS:');
    console.log(`   Total projects: ${totalProjects}`);
    console.log(`   Successful updates: ${successfulUpdates}`);
    console.log(`   Projects with correct companyId: ${correctProjects}/${totalProjects}`);
    console.log(`   Errors: ${errors.length}`);
    console.log(`   Total execution time: ${totalExecutionTime}ms`);

    const response = {
      success: errors.length === 0,
      summary: {
        totalProjects,
        successfulUpdates,
        correctProjectsAfterUpdate: correctProjects,
        errors: errors.length,
        allProjectsFixed: correctProjects === totalProjects
      },
      execution: {
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        executionTimeMs: totalExecutionTime,
        mode: 'DIRECT_ADMIN_SDK'
      },
      target: {
        correctCompanyId,
        companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company'
      },
      updates,
      errors,
      verification: verificationResults,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        system: 'Nestor Pagonis Enterprise Platform - Direct Admin Fix'
      }
    };

    if (response.success && response.summary.allProjectsFixed) {
      console.log('🎉 ALL PROJECTS SUCCESSFULLY FIXED!');
    } else {
      console.log('⚠️ Fix completed with issues');
    }

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logDirectOperation(
      ctx,
      'fix_projects_direct_companyid',
      {
        operation: 'fix-projects-direct',
        totalProjects: response.summary.totalProjects,
        successfulUpdates: response.summary.successfulUpdates,
        correctProjectsAfter: response.summary.correctProjectsAfterUpdate,
        errors: response.summary.errors,
        targetCompanyId: correctCompanyId,
        allProjectsFixed: response.summary.allProjectsFixed,
        executionTimeMs: response.execution.executionTimeMs,
        result: response.success ? 'success' : 'partial_success',
        metadata,
      },
      `Direct project companyId fix by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      console.error('⚠️ Audit logging failed (non-blocking):', err);
    });

    return NextResponse.json(response, {
      status: response.success ? 200 : 500
    });

  } catch (error: unknown) {
    const totalExecutionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('❌ DIRECT FIX SYSTEM ERROR:', errorMessage);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      execution: {
        startedAt: new Date(startTime).toISOString(),
        failedAt: new Date().toISOString(),
        totalTimeMs: totalExecutionTime,
        mode: 'DIRECT_ADMIN_SDK'
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        system: 'Nestor Pagonis Enterprise Platform - Direct Admin Fix'
      }
    }, { status: 500 });
  }
}

/**
 * GET - System Information (withAuth protected)
 * Returns endpoint information and capabilities.
 *
 * @security withAuth + admin:direct:operations permission
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export const GET = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleFixProjectsDirectInfo(req, ctx);
  },
  { permissions: 'admin:direct:operations' }
));

/**
 * Internal handler for GET (system info).
 */
async function handleFixProjectsDirectInfo(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  try {
    const targetCompanyId = process.env.NEXT_PUBLIC_MAIN_COMPANY_ID || 'default-company-id';

    return NextResponse.json({
      success: true,
      system: {
        name: 'Direct Admin Project CompanyID Fix',
        version: '1.0.0',
        description: 'Bypasses all permission systems using Firebase Admin SDK',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      },
      usage: {
        endpoint: 'POST /api/admin/fix-projects-direct',
        method: 'Direct Firebase Admin SDK update',
        target: `Fix all project companyIds to: ${targetCompanyId}`,
        features: ['Permission bypass', 'Verification', 'Detailed logging']
      },
      requester: {
        email: ctx.email,
        globalRole: ctx.globalRole,
        hasAccess: ctx.globalRole === 'super_admin'
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}