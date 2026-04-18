/**
 * =============================================================================
 * NAVIGATION AUTO-FIX — Handler + Types (ADR-312 Phase 3.6)
 * =============================================================================
 *
 * Extracted from `route.ts` to keep the route file under the 300-LOC budget
 * for API routes (CLAUDE.md N.7.1). Owns the full auto-fix execution path
 * (scan contacts → group projects → add missing navigation entries → audit).
 *
 * @module app/api/navigation/auto-fix-missing-companies/fix-handler
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateNavigationId } from '@/services/enterprise-id.service';
import { logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { resolveCompanyDisplayName } from '@/services/company/company-name-resolver';

const logger = createModuleLogger('NavigationAutoFixHandler');

export interface AutoFixResult {
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
 * Execute the auto-fix scan.
 * Caller (`route.ts::POST`) is responsible for `withAuth` + permission check.
 * This handler additionally enforces the `super_admin` role gate internally.
 */
export async function handleAutoFixExecute(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<AutoFixResult>> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('[Navigation/AutoFix] BLOCKED: Non-super_admin attempted navigation auto-fix', {
      userId: ctx.uid,
      email: ctx.email,
      globalRole: ctx.globalRole,
    });

    const errorResult: AutoFixResult = {
      success: false,
      message: 'Forbidden: This operation requires super_admin role',
      fixes: [],
      stats: {
        companiesChecked: 0,
        companiesWithProjects: 0,
        companiesMissingFromNavigation: 0,
        companiesAdded: 0,
      },
    };

    return NextResponse.json(errorResult, { status: 403 });
  }

  try {
    const db = getAdminFirestore();
    logger.info('[Navigation/AutoFix] Starting navigation companies repair');

    const result: AutoFixResult = {
      success: false,
      message: '',
      fixes: [],
      stats: {
        companiesChecked: 0,
        companiesWithProjects: 0,
        companiesMissingFromNavigation: 0,
        companiesAdded: 0,
      },
    };

    // STEP 1: Get all companies from contacts collection
    logger.info('[Navigation/AutoFix] Step 1: Fetching all companies from contacts');
    const companiesSnapshot = await db
      .collection(COLLECTIONS.CONTACTS)
      .where('type', '==', 'company')
      .where('status', '==', 'active')
      .get();

    logger.info('[Navigation/AutoFix] Found active companies', { count: companiesSnapshot.docs.length });
    result.stats.companiesChecked = companiesSnapshot.docs.length;

    // STEP 2: Get all projects and group by companyId
    logger.info('[Navigation/AutoFix] Step 2: Analyzing projects distribution');
    const projectsSnapshot = await db.collection(COLLECTIONS.PROJECTS).get();

    const projectsByCompany: Record<string, ProjectRecord[]> = {};
    projectsSnapshot.docs.forEach((doc) => {
      const project = doc.data();
      const companyId = project.companyId;
      if (companyId) {
        if (!projectsByCompany[companyId]) {
          projectsByCompany[companyId] = [];
        }
        projectsByCompany[companyId].push({ id: doc.id, ...project });
      }
    });

    logger.info('[Navigation/AutoFix] Projects analysis', {
      totalProjects: projectsSnapshot.docs.length,
      companiesWithProjects: Object.keys(projectsByCompany).length,
    });

    // STEP 3: Get existing navigation companies
    logger.info('[Navigation/AutoFix] Step 3: Checking existing navigation companies');
    const navigationSnapshot = await db.collection(COLLECTIONS.NAVIGATION).get();
    const existingNavigationCompanyIds = new Set(
      navigationSnapshot.docs.map((doc) => doc.data().contactId),
    );

    logger.info('[Navigation/AutoFix] Existing navigation companies', {
      count: existingNavigationCompanyIds.size,
    });

    // STEP 4: Process each company
    logger.info('[Navigation/AutoFix] Step 4: Processing companies for auto-fix');

    for (const companyDoc of companiesSnapshot.docs) {
      const companyId = companyDoc.id;
      const companyData = companyDoc.data();
      const companyName = resolveCompanyDisplayName({
        id: companyId,
        name: companyData.name,
        companyName: companyData.companyName,
        tradeName: companyData.tradeName,
        legalName: companyData.legalName,
        displayName: companyData.displayName,
      });

      const companyProjects = projectsByCompany[companyId] || [];
      const projectCount = companyProjects.length;

      if (projectCount > 0) {
        result.stats.companiesWithProjects++;

        if (!existingNavigationCompanyIds.has(companyId)) {
          result.stats.companiesMissingFromNavigation++;

          logger.warn('[Navigation/AutoFix] MISSING: Company not in navigation', {
            companyName,
            companyId,
            projectCount,
          });

          try {
            // ADR-252 Phase 3: Include companyId for tenant-scoped Firestore rules
            // For auto-fix, the contactId IS the companyId (company's own contact doc)
            const navId = generateNavigationId();
            await db.collection(COLLECTIONS.NAVIGATION).doc(navId).set({
              contactId: companyId,
              companyId: companyId,
              addedAt: new Date(),
              addedBy: 'enterprise-auto-fix-system',
            });

            result.stats.companiesAdded++;
            result.fixes.push({
              companyId,
              companyName,
              projectCount,
              action: 'added_to_navigation',
            });

            logger.info('[Navigation/AutoFix] FIXED: Added company to navigation', {
              companyName,
              projectCount,
            });
          } catch (error) {
            logger.error('[Navigation/AutoFix] Failed to add company to navigation', {
              companyName,
              error: getErrorMessage(error),
            });
            result.fixes.push({
              companyId,
              companyName,
              projectCount,
              action: 'already_exists', // Use as error placeholder
            });
          }
        } else {
          result.fixes.push({
            companyId,
            companyName,
            projectCount,
            action: 'already_exists',
          });
        }
      } else {
        result.fixes.push({
          companyId,
          companyName,
          projectCount: 0,
          action: 'no_projects',
        });
      }
    }

    // STEP 5: Generate result summary
    const { stats } = result;

    if (stats.companiesAdded > 0) {
      result.success = true;
      result.message =
        `Successfully added ${stats.companiesAdded} companies to navigation. ` +
        `${stats.companiesWithProjects} companies have projects, ` +
        `${stats.companiesMissingFromNavigation} were missing from navigation.`;

      logger.info('[Navigation/AutoFix] COMPLETED SUCCESSFULLY', {
        companiesChecked: stats.companiesChecked,
        companiesWithProjects: stats.companiesWithProjects,
        companiesMissingFromNavigation: stats.companiesMissingFromNavigation,
        companiesAdded: stats.companiesAdded,
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
        fixes: result.fixes.slice(0, 3).map((fix) => ({
          companyName: fix.companyName,
          action: fix.action,
          projectCount: fix.projectCount,
        })),
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
      `Navigation auto-fix by ${ctx.globalRole} ${ctx.email}`,
    ).catch((err: unknown) => {
      logger.error('[Navigation/AutoFix] Audit logging failed (non-blocking)', {
        error: getErrorMessage(err),
      });
    });

    return NextResponse.json({ ...result, executionTimeMs: duration });
  } catch (error: unknown) {
    logger.error('[Navigation/AutoFix] Enterprise auto-fix failed', { error: getErrorMessage(error) });
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        message: `Auto-fix failed: ${getErrorMessage(error)}`,
        fixes: [],
        stats: {
          companiesChecked: 0,
          companiesWithProjects: 0,
          companiesMissingFromNavigation: 0,
          companiesAdded: 0,
        },
        executionTimeMs: duration,
      },
      { status: 500 },
    );
  }
}
