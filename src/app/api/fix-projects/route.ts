/**
 * =============================================================================
 * FIX PROJECTS - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Fixes project companyIds using Admin SDK (database-driven)
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification Data fix operation
 *
 * This endpoint updates project companyIds:
 * - Database-driven company lookup (no hardcoded IDs)
 * - Updates all projects with correct companyId
 * - Verifies changes after update
 *
 * @method GET - System information
 * @method POST - Execute companyId fix
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:data:fix permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - Layer 3: Audit logging (logDataFix)
 *   - Layer 4: Firebase Admin SDK (elevated permissions)
 *
 * @technology Firebase Admin SDK (bypasses Firestore rules)
 * @classification Data fix operation
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * POST - Execute Project CompanyId Fix (withAuth protected)
 * Updates all project companyIds using Admin SDK.
 *
 * @security withAuth + super_admin check + audit logging + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleFixProjectsExecute(req, ctx);
  },
  { permissions: 'admin:data:fix' }
));

/**
 * Internal handler for POST (fix projects).
 */
async function handleFixProjectsExecute(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [POST /api/fix-projects] BLOCKED: Non-super_admin attempted project companyId fix`,
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
    console.log('🔧 FIXING PROJECT COMPANY IDS...');

    const adminDb = getAdminFirestore();

    // 🏢 ENTERPRISE: Database-driven company lookup (NO MORE HARDCODED IDs)
    const getCompanyIdByName = async (companyName: string): Promise<string | null> => {
      try {
        const companiesQuery = await adminDb.collection(COLLECTIONS.CONTACTS)
          .where('type', '==', 'company')
          .where('companyName', '==', companyName)
          .limit(1)
          .get();

        if (companiesQuery.empty) {
          console.error(`🚨 Company not found: ${companyName}`);
          return null;
        }

        return companiesQuery.docs[0].id;
      } catch (error) {
        console.error(`🚨 Error loading company ID for ${companyName}:`, error);
        return null;
      }
    };

    const mainCompanyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company';
    const correctCompanyId = await getCompanyIdByName(mainCompanyName);

    if (!correctCompanyId) {
      return NextResponse.json({
        error: `Company "${mainCompanyName}" not found in database`,
        suggestion: 'Ensure company exists before running project fixes'
      }, { status: 404 });
    }

    console.log(`✅ Using database-driven companyId: ${correctCompanyId}`);

    // Παίρνουμε όλα τα projects
    const projectsSnapshot = await adminDb.collection(COLLECTIONS.PROJECTS).get();
    console.log(`📊 Found ${projectsSnapshot.size} projects`);

    const results = [];

    for (const doc of projectsSnapshot.docs) {
      const project = doc.data();
      const projectId = doc.id;

      console.log(`🔍 Project ${projectId}: current companyId="${project.companyId || '(empty)'}"`);

      if (project.companyId !== correctCompanyId) {
        console.log(`🔄 Updating project ${projectId}`);

        await adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).update({
          companyId: correctCompanyId
        });

        results.push({
          projectId,
          name: project.name,
          oldCompanyId: project.companyId || '(empty)',
          newCompanyId: correctCompanyId,
          status: 'UPDATED'
        });

        console.log(`✅ Updated project ${projectId}`);
      } else {
        results.push({
          projectId,
          name: project.name,
          companyId: project.companyId,
          status: 'NO_CHANGE'
        });
        console.log(`✅ Project ${projectId} already correct`);
      }
    }

    // Επιβεβαίωση
    const verificationSnapshot = await adminDb.collection(COLLECTIONS.PROJECTS).get();
    const verification = [];

    for (const doc of verificationSnapshot.docs) {
      const project = doc.data();
      verification.push({
        projectId: doc.id,
        name: project.name,
        companyId: project.companyId,
        isCorrect: project.companyId === correctCompanyId
      });
    }

    const allCorrect = verification.every(p => p.isCorrect);

    console.log(`🎉 COMPLETED! All projects fixed: ${allCorrect}`);

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logDataFix(
      ctx,
      'fix_project_company_ids',
      {
        operation: 'fix-projects',
        totalProjects: projectsSnapshot.size,
        projectsUpdated: results.filter(r => r.status === 'UPDATED').length,
        projectsNoChange: results.filter(r => r.status === 'NO_CHANGE').length,
        targetCompanyId: correctCompanyId,
        allProjectsCorrect: allCorrect,
        executionTimeMs: duration,
        result: allCorrect ? 'success' : 'partial_success',
        metadata,
      },
      `Project companyIds fix by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      console.error('⚠️ Audit logging failed (non-blocking):', err);
    });

    return NextResponse.json({
      success: true,
      message: allCorrect ? 'ALL PROJECTS FIXED!' : 'Some projects still need fixing',
      results,
      verification,
      summary: {
        totalProjects: projectsSnapshot.size,
        updatedProjects: results.filter(r => r.status === 'UPDATED').length,
        allProjectsCorrect: allCorrect
      },
      executionTimeMs: duration,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Fix Projects Error:', errorMessage);
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: false,
      error: errorMessage,
      executionTimeMs: duration,
    }, { status: 500 });
  }
}

/**
 * GET - System Information (withAuth protected)
 * Returns endpoint information and requester details.
 *
 * @security withAuth + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export const GET = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleFixProjectsInfo(req, ctx);
  },
  { permissions: 'admin:data:fix' }
));

/**
 * Internal handler for GET (system info).
 */
async function handleFixProjectsInfo(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  return NextResponse.json({
    message: 'Project Company IDs Fix Endpoint',
    usage: 'POST /api/fix-projects',
    requester: {
      email: ctx.email,
      globalRole: ctx.globalRole,
      hasAccess: ctx.globalRole === 'super_admin'
    }
  });
}