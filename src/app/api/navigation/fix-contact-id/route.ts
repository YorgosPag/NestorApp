/**
 * =============================================================================
 * FIX CONTACT ID - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Fixes wrong contactId in navigation documents
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification Data fix operation
 *
 * This endpoint:
 * - Fixes wrong contactId values in navigation_companies
 * - Updates documents with correct contactId
 * - Ensures navigation displays correct projects
 *
 * PROBLEM IDENTIFIED:
 * - navigation_companies έχει contactId: "pagonis"
 * - Σωστό contactId: "pzNUy8ksddGCtcQMqumR"
 * - Projects δεν εμφανίζονται γιατί το ID δεν ταιριάζει
 *
 * @method GET - Info endpoint (read-only)
 * @method POST - Execute contactId fix (updates documents)
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:data:fix permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - Layer 3: Audit logging (logDataFix)
 *
 * @classification CRITICAL - Data fix operation
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, query, getDocs, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('NavigationFixContactIdRoute');

interface ContactIdFixResult {
  success: boolean;
  message: string;
  fixes: Array<{
    documentId: string;
    oldContactId: string;
    newContactId: string;
    companyName: string;
    action: 'fixed' | 'already_correct' | 'error';
  }>;
  stats: {
    documentsChecked: number;
    documentsFixed: number;
    errors: number;
  };
}

/**
 * POST - Execute ContactId Fix (withAuth protected)
 * Fixes wrong contactId in navigation documents.
 *
 * @security withAuth + super_admin check + audit logging + admin:data:fix permission
 */
export const POST = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<ContactIdFixResult>> => {
    return handleFixContactIdExecute(req, ctx);
  },
  { permissions: 'admin:data:fix' }
);

/**
 * Internal handler for POST (execute contactId fix).
 */
async function handleFixContactIdExecute(request: NextRequest, ctx: AuthContext): Promise<NextResponse<ContactIdFixResult>> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('[Navigation/FixContactId] BLOCKED: Non-super_admin attempted contactId fix', { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole });

    const errorResult: ContactIdFixResult = {
      success: false,
      message: 'Forbidden: This CRITICAL operation requires super_admin role',
      fixes: [],
      stats: {
        documentsChecked: 0,
        documentsFixed: 0,
        errors: 1
      }
    };

    return NextResponse.json(errorResult, { status: 403 });
  }

  try {
    logger.info('[Navigation/FixContactId] Starting contactId correction');

    const result: ContactIdFixResult = {
      success: false,
      message: '',
      fixes: [],
      stats: {
        documentsChecked: 0,
        documentsFixed: 0,
        errors: 0
      }
    };

    // STEP 1: Find navigation_companies με λάθος contactId "pagonis"
    logger.info('[Navigation/FixContactId] Step 1: Searching for wrong contactId entries');
    const navigationQuery = query(
      collection(db, COLLECTIONS.NAVIGATION),
      where('contactId', '==', 'pagonis')
    );
    const navigationSnapshot = await getDocs(navigationQuery);

    logger.info('[Navigation/FixContactId] Found documents with wrong contactId', { count: navigationSnapshot.docs.length });
    result.stats.documentsChecked = navigationSnapshot.docs.length;

    if (navigationSnapshot.docs.length === 0) {
      result.success = true;
      result.message = 'No documents found with incorrect contactId "pagonis". Navigation is already correct.';
      return NextResponse.json(result);
    }

    // STEP 2: Verify that the target company exists
    logger.info('[Navigation/FixContactId] Step 2: Verifying target company exists');
    const targetContactId = 'pzNUy8ksddGCtcQMqumR';

    const contactsQuery = query(
      collection(db, COLLECTIONS.CONTACTS),
      where('__name__', '==', targetContactId)
    );
    const contactsSnapshot = await getDocs(contactsQuery);

    if (contactsSnapshot.docs.length === 0) {
      result.success = false;
      result.message = `Target company with ID "${targetContactId}" not found in contacts collection. Cannot proceed with fix.`;
      return NextResponse.json(result, { status: 400 });
    }

    const targetCompany = contactsSnapshot.docs[0].data();
    const companyName = targetCompany.companyName || 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.';

    logger.info('[Navigation/FixContactId] Target company verified', { companyName });

    // STEP 3: Fix each navigation document
    logger.info('[Navigation/FixContactId] Step 3: Fixing navigation documents');

    for (const navDoc of navigationSnapshot.docs) {
      try {
        const docId = navDoc.id;
        const docData = navDoc.data();

        logger.info('[Navigation/FixContactId] Fixing document', { docId, oldContactId: docData.contactId, newContactId: targetContactId });

        // Update the document
        await updateDoc(doc(db, COLLECTIONS.NAVIGATION, docId), {
          contactId: targetContactId,
          fixedAt: new Date(),
          fixedBy: 'enterprise-critical-fix-system',
          previousContactId: docData.contactId,
          fixReason: 'Wrong contactId preventing project display in navigation'
        });

        result.stats.documentsFixed++;
        result.fixes.push({
          documentId: docId,
          oldContactId: docData.contactId,
          newContactId: targetContactId,
          companyName,
          action: 'fixed'
        });

        logger.info('[Navigation/FixContactId] Successfully fixed document', { docId });

      } catch (error) {
        logger.error('[Navigation/FixContactId] Failed to fix document', { docId: navDoc.id, error: error instanceof Error ? error.message : String(error) });
        result.stats.errors++;
        result.fixes.push({
          documentId: navDoc.id,
          oldContactId: navDoc.data().contactId,
          newContactId: targetContactId,
          companyName,
          action: 'error'
        });
      }
    }

    // STEP 4: Generate result summary
    const { stats } = result;

    if (stats.documentsFixed > 0 && stats.errors === 0) {
      result.success = true;
      result.message = `Successfully fixed ${stats.documentsFixed} navigation documents. ` +
                      `Company "${companyName}" projects should now appear in navigation.`;

      logger.info('[Navigation/FixContactId] COMPLETED SUCCESSFULLY', { documentsChecked: stats.documentsChecked, documentsFixed: stats.documentsFixed, companyName, targetContactId });

    } else if (stats.documentsFixed > 0 && stats.errors > 0) {
      result.success = true; // Partial success
      result.message = `Partially completed fix: ${stats.documentsFixed} fixed, ${stats.errors} errors. ` +
                      `Some projects may now appear for "${companyName}".`;

      logger.warn('[Navigation/FixContactId] Partial success', { documentsFixed: stats.documentsFixed, errors: stats.errors });

    } else {
      result.success = false;
      result.message = `Failed to fix navigation documents. ${stats.errors} errors occurred.`;

      logger.error('[Navigation/FixContactId] Fix failed', { errors: stats.errors });
    }

    // STEP 5: Log sample fixes for transparency
    if (result.fixes.length > 0) {
      logger.info('[Navigation/FixContactId] Fix details', {
        fixes: result.fixes.map(fix => ({ documentId: fix.documentId, action: fix.action, oldContactId: fix.oldContactId, newContactId: fix.newContactId }))
      });
    }

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logDataFix(
      ctx,
      'fix_navigation_contact_id',
      {
        operation: 'fix-contact-id',
        documentsChecked: result.stats.documentsChecked,
        documentsFixed: result.stats.documentsFixed,
        errors: result.stats.errors,
        targetContactId: 'pzNUy8ksddGCtcQMqumR',
        executionTimeMs: duration,
        result: result.success ? 'success' : 'failed',
        metadata,
      },
      `ContactId fix by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      logger.error('[Navigation/FixContactId] Audit logging failed (non-blocking)', { error: err instanceof Error ? err.message : String(err) });
    });

    return NextResponse.json({ ...result, executionTimeMs: duration });

  } catch (error: unknown) {
    logger.error('[Navigation/FixContactId] Enterprise critical fix failed', { error: error instanceof Error ? error.message : String(error) });
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: false,
      message: `Critical fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      fixes: [],
      stats: {
        documentsChecked: 0,
        documentsFixed: 0,
        errors: 1
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
      endpoint: 'Enterprise Critical Fix - Contact ID Correction',
      description: 'Fixes wrong contactId "pagonis" → "pzNUy8ksddGCtcQMqumR" in navigation_companies',
      problem: 'ΠΑΓΩΝΗΣ company projects not showing due to wrong contactId in navigation',
      solution: 'Update navigation_companies documents with correct contactId',
      usage: 'POST to this endpoint to execute the fix',
      priority: 'CRITICAL',
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