/**
 * =============================================================================
 * AUTO-FIX MISSING COMPANIES - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Auto-detects and fixes companies with projects missing from navigation
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification Data fix operation
 *
 * This endpoint:
 * - Detects companies with projects that are missing from navigation
 * - Adds them to navigation_companies collection
 * - Ensures all companies with projects appear in navigation
 *
 * PROBLEM SOLVED:
 * - Companies με projects δεν εμφανίζονται στο navigation
 * - Companies υπάρχουν στη contacts collection αλλά όχι στη navigation_companies
 * - Navigation system δεν φορτώνει projects για companies που δεν είναι στη navigation_companies
 *
 * @method GET - Info endpoint (read-only)
 * @method POST - Execute auto-fix (adds missing companies)
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:data:fix permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - Layer 3: Audit logging (logDataFix)
 *
 * @classification Data fix operation
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, query, getDocs, where, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('NavigationAutoFixRoute');

interface AutoFixResult {
  success: boolean;
  message: string;
  fixes: Array<{
    companyId: string;
    companyName: string;
    projectCount: number;
    action: 'added_to_navigation' | 'already_exists' | 'no_projects';
  }>;
  stats: {
    companiesChecked: number;
    companiesWithProjects: number;
    companiesMissingFromNavigation: number;
    companiesAdded: number;
  };
}

type ProjectRecord = {
  id: string;
  companyId?: string | null;
} & Record<string, unknown>;

/**
 * POST - Execute Auto-Fix (withAuth protected)
 * Detects and adds missing companies to navigation.
 *
 * @security withAuth + super_admin check + audit logging + admin:data:fix permission
 */
export const POST = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<AutoFixResult>> => {
    return handleAutoFixExecute(req, ctx);
  },
  { permissions: 'admin:data:fix' }
);

/**
 * Internal handler for POST (execute auto-fix).
 */
async function handleAutoFixExecute(request: NextRequest, ctx: AuthContext): Promise<NextResponse<AutoFixResult>> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('[Navigation/AutoFix] BLOCKED: Non-super_admin attempted navigation auto-fix', { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole });

    const errorResult: AutoFixResult = {
      success: false,
      message: 'Forbidden: This operation requires super_admin role',
      fixes: [],
      stats: {
        companiesChecked: 0,
        companiesWithProjects: 0,
        companiesMissingFromNavigation: 0,
        companiesAdded: 0
      }
    };

    return NextResponse.json(errorResult, { status: 403 });
  }

  try {
    logger.info('[Navigation/AutoFix] Starting navigation companies repair');

    const result: AutoFixResult = {
      success: false,
      message: '',
      fixes: [],
      stats: {
        companiesChecked: 0,
        companiesWithProjects: 0,
        companiesMissingFromNavigation: 0,
        companiesAdded: 0
      }
    };

    // STEP 1: Get all companies from contacts collection
    logger.info('[Navigation/AutoFix] Step 1: Fetching all companies from contacts');
    const companiesQuery = query(
      collection(db, COLLECTIONS.CONTACTS),
      where('type', '==', 'company'),
      where('status', '==', 'active')
    );
    const companiesSnapshot = await getDocs(companiesQuery);

    logger.info('[Navigation/AutoFix] Found active companies', { count: companiesSnapshot.docs.length });
    result.stats.companiesChecked = companiesSnapshot.docs.length;

    // STEP 2: Get all projects and group by companyId
    logger.info('[Navigation/AutoFix] Step 2: Analyzing projects distribution');
    const projectsSnapshot = await getDocs(collection(db, COLLECTIONS.PROJECTS));

    // Group projects by companyId
    const projectsByCompany: Record<string, ProjectRecord[]> = {};
    projectsSnapshot.docs.forEach(doc => {
      const project = doc.data();
      const companyId = project.companyId;
      if (companyId) {
        if (!projectsByCompany[companyId]) {
          projectsByCompany[companyId] = [];
        }
        projectsByCompany[companyId].push({ id: doc.id, ...project });
      }
    });

    logger.info('[Navigation/AutoFix] Projects analysis', { totalProjects: projectsSnapshot.docs.length, companiesWithProjects: Object.keys(projectsByCompany).length });

    // STEP 3: Get existing navigation companies
    logger.info('[Navigation/AutoFix] Step 3: Checking existing navigation companies');
    const navigationSnapshot = await getDocs(collection(db, COLLECTIONS.NAVIGATION));
    const existingNavigationCompanyIds = new Set(
      navigationSnapshot.docs.map(doc => doc.data().contactId)
    );

    logger.info('[Navigation/AutoFix] Existing navigation companies', { count: existingNavigationCompanyIds.size });

    // STEP 4: Process each company
    logger.info('[Navigation/AutoFix] Step 4: Processing companies for auto-fix');

    for (const companyDoc of companiesSnapshot.docs) {
      const companyId = companyDoc.id;
      const companyData = companyDoc.data();
      const companyName = companyData.companyName || 'Unknown Company';

      // Check if company has projects
      const companyProjects = projectsByCompany[companyId] || [];
      const projectCount = companyProjects.length;

      if (projectCount > 0) {
        result.stats.companiesWithProjects++;

        // Check if company is missing from navigation
        if (!existingNavigationCompanyIds.has(companyId)) {
          result.stats.companiesMissingFromNavigation++;

          logger.warn('[Navigation/AutoFix] MISSING: Company not in navigation', { companyName, companyId, projectCount });

          // Add to navigation_companies collection
          try {
            await addDoc(collection(db, COLLECTIONS.NAVIGATION), {
              contactId: companyId,
              addedAt: new Date(),
              addedBy: 'enterprise-auto-fix-system'
            });

            result.stats.companiesAdded++;
            result.fixes.push({
              companyId,
              companyName,
              projectCount,
              action: 'added_to_navigation'
            });

            logger.info('[Navigation/AutoFix] FIXED: Added company to navigation', { companyName, projectCount });

          } catch (error) {
            logger.error('[Navigation/AutoFix] Failed to add company to navigation', { companyName, error: error instanceof Error ? error.message : String(error) });
            result.fixes.push({
              companyId,
              companyName,
              projectCount,
              action: 'already_exists' // Use as error placeholder
            });
          }

        } else {
          result.fixes.push({
            companyId,
            companyName,
            projectCount,
            action: 'already_exists'
          });
        }

      } else {
        result.fixes.push({
          companyId,
          companyName,
          projectCount: 0,
          action: 'no_projects'
        });
      }
    }

    // STEP 5: Generate result summary
    const { stats } = result;

    if (stats.companiesAdded > 0) {
      result.success = true;
      result.message = `Successfully added ${stats.companiesAdded} companies to navigation. ` +
                      `${stats.companiesWithProjects} companies have projects, ` +
                      `${stats.companiesMissingFromNavigation} were missing from navigation.`;

      logger.info('[Navigation/AutoFix] COMPLETED SUCCESSFULLY', {
        companiesChecked: stats.companiesChecked,
        companiesWithProjects: stats.companiesWithProjects,
        companiesMissingFromNavigation: stats.companiesMissingFromNavigation,
        companiesAdded: stats.companiesAdded
      });

    } else if (stats.companiesMissingFromNavigation === 0) {
      result.success = true;
      result.message = `Navigation is already up-to-date. All ${stats.companiesWithProjects} companies with projects are present in navigation.`;

      logger.info('[Navigation/AutoFix] No action needed, navigation is up-to-date');

    } else {
      result.success = false;
      result.message = `Failed to add companies to navigation. Found ${stats.companiesMissingFromNavigation} companies that need fixing.`;

      logger.error('[Navigation/AutoFix] Completed with errors');
    }

    // STEP 6: Log sample fixes for transparency
    if (result.fixes.length > 0) {
      logger.info('[Navigation/AutoFix] Sample fixes applied', {
        fixes: result.fixes.slice(0, 3).map(fix => ({ companyName: fix.companyName, action: fix.action, projectCount: fix.projectCount }))
      });
    }

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logDataFix(
      ctx,
      'auto_fix_missing_navigation_companies',
      {
        operation: 'auto-fix-missing-companies',
        companiesChecked: result.stats.companiesChecked,
        companiesWithProjects: result.stats.companiesWithProjects,
        companiesMissingFromNavigation: result.stats.companiesMissingFromNavigation,
        companiesAdded: result.stats.companiesAdded,
        executionTimeMs: duration,
        result: result.success ? 'success' : 'failed',
        metadata,
      },
      `Navigation auto-fix by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      logger.error('[Navigation/AutoFix] Audit logging failed (non-blocking)', { error: err instanceof Error ? err.message : String(err) });
    });

    return NextResponse.json({ ...result, executionTimeMs: duration });

  } catch (error: unknown) {
    logger.error('[Navigation/AutoFix] Enterprise auto-fix failed', { error: error instanceof Error ? error.message : String(error) });
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: false,
      message: `Auto-fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      fixes: [],
      stats: {
        companiesChecked: 0,
        companiesWithProjects: 0,
        companiesMissingFromNavigation: 0,
        companiesAdded: 0
      },
      executionTimeMs: duration
    }, { status: 500 });
  }
}

/**
 * GET - Info Endpoint (withAuth protected)
 * Returns endpoint information.
 *
 * @security withAuth + admin:data:fix permission
 */
export const GET = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return NextResponse.json({
      endpoint: 'Enterprise Navigation Auto-Fix',
      description: 'Automatically detects and fixes companies with projects that are missing from navigation',
      usage: 'POST to this endpoint to run the auto-fix',
      methods: ['POST'],
      security: 'Requires super_admin role',
      requester: {
        email: ctx.email,
        globalRole: ctx.globalRole,
        hasAccess: ctx.globalRole === 'super_admin'
      }
    });
  },
  { permissions: 'admin:data:fix' }
);
