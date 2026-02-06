/**
 * =============================================================================
 * ADD COMPANIES - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Adds multiple companies to navigation collection
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification Data creation operation
 *
 * This endpoint:
 * - Adds multiple companies to navigation collection
 * - Uses Firebase Admin SDK for elevated permissions
 * - Processes company IDs in bulk
 *
 * @method POST - Add companies (accepts companyIds array)
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:data:fix permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - Layer 3: Audit logging (logDataFix)
 *   - Layer 4: Firebase Admin SDK (elevated permissions)
 *
 * @classification Data creation operation
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';

/**
 * POST - Add Companies (withAuth protected)
 * Adds multiple companies to navigation collection.
 *
 * @security withAuth + super_admin check + audit logging + admin:data:fix permission
 */
export const POST = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleAddCompaniesExecute(req, ctx);
  },
  { permissions: 'admin:data:fix' }
);

/**
 * Internal handler for POST (add companies).
 */
async function handleAddCompaniesExecute(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [POST /api/navigation/add-companies] BLOCKED: Non-super_admin attempted bulk company add`,
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
    const { companyIds } = await request.json();

    console.log('🧭 Starting navigation companies addition via API...');
    console.log(`📝 Processing ${companyIds.length} company IDs`);

    if (!getAdminFirestore()) {
      return NextResponse.json({
        success: false,
        error: 'Firebase Admin SDK not initialized'
      }, { status: 500 });
    }

    const addedNavigationIds: string[] = [];

    for (let i = 0; i < companyIds.length; i++) {
      const contactId = companyIds[i];

      try {
        const navigationEntry = {
          contactId: contactId,
          addedAt: new Date(),
          addedBy: 'system'
        };

        const docRef = await getAdminFirestore().collection(COLLECTIONS.NAVIGATION).add(navigationEntry);
        addedNavigationIds.push(docRef.id);

        console.log(`✅ Added to navigation: Company ${contactId} (Entry ID: ${docRef.id})`);

      } catch (navigationError) {
        console.error(`❌ Error adding company ${contactId} to navigation:`, navigationError);
        // Συνεχίζουμε με τις επόμενες εταιρείες ακόμα κι αν μία αποτύχει
      }
    }

    console.log(`✅ Successfully added ${addedNavigationIds.length}/${companyIds.length} companies to navigation`);

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logDataFix(
      ctx,
      'add_companies_to_navigation',
      {
        operation: 'add-companies',
        companiesRequested: companyIds.length,
        companiesAdded: addedNavigationIds.length,
        addedNavigationIds,
        executionTimeMs: duration,
        result: 'success',
        metadata,
      },
      `Bulk company add by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      console.error('⚠️ Audit logging failed (non-blocking):', err);
    });

    return NextResponse.json({
      success: true,
      message: `Successfully added ${addedNavigationIds.length} companies to navigation`,
      addedNavigationIds,
      navigationCount: addedNavigationIds.length,
      requestedCount: companyIds.length,
      executionTimeMs: duration
    });

  } catch (error: unknown) {
    console.error('❌ Error in add-companies API:', error);
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to add companies to navigation',
      executionTimeMs: duration
    }, { status: 500 });
  }
}
