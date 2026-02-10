/**
 * =============================================================================
 * RADICAL CLEAN SCHEMA - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose DELETES and RECREATES all navigation documents with pure schema
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification CRITICAL - Total schema reconstruction (DELETE ALL + RECREATE)
 *
 * PROBLEM:
 * - updateDoc preserves legacy fields causing persistent inconsistency
 * - Documents retain legacy data (fixedBy, fixReason, etc.)
 * - Continuing data inconsistency
 *
 * RADICAL SOLUTION:
 * - DELETE every single document
 * - RECREATE with ONLY enterprise standard fields
 * - ZERO tolerance for legacy data
 *
 * @method GET - Info endpoint (read-only)
 * @method POST - Execute radical cleanup (DELETE ALL + RECREATE)
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:data:fix permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - Layer 3: Audit logging (logDataFix)
 *
 * @classification CRITICAL - MOST DESTRUCTIVE OPERATION IN THE SYSTEM
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, deleteDoc, setDoc, doc, serverTimestamp, Timestamp, FieldValue } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('NavigationRadicalCleanRoute');

/** Firestore Timestamp type */
type FirestoreTimestamp = Timestamp | FieldValue | Date;

interface RadicalCleanupResult {
  success: boolean;
  message: string;
  operations: Array<{
    documentId: string;
    originalContactId: string;
    action: 'recreated' | 'error';
    beforeFieldCount: number;
    afterFieldCount: number;
  }>;
  stats: {
    documentsProcessed: number;
    documentsRecreated: number;
    errors: number;
  };
}

// 🏢 PURE ENTERPRISE SCHEMA - ΜΟΝΟ ΑΥΤΑ ΤΑ ΠΕΔΙΑ!
interface PureEnterpriseNavigationSchema {
  // CORE FIELDS (4)
  contactId: string;
  addedAt: FirestoreTimestamp;
  addedBy: string;
  status: 'active';

  // ENTERPRISE METADATA (4)
  version: number;
  schemaVersion: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;

  // COMPLIANCE TRACKING (2)
  complianceLevel: 'enterprise';
  lastCleaned: FirestoreTimestamp;
}

/**
 * POST - Execute Radical Cleanup (withAuth protected)
 * DELETES ALL navigation documents + RECREATES with pure schema.
 *
 * @security withAuth + super_admin check + audit logging + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<RadicalCleanupResult>> => {
    return handleRadicalCleanupExecute(req, ctx);
  },
  { permissions: 'admin:data:fix' }
));

/**
 * Internal handler for POST (execute radical cleanup).
 */
async function handleRadicalCleanupExecute(request: NextRequest, ctx: AuthContext): Promise<NextResponse<RadicalCleanupResult>> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('[Navigation/RadicalClean] BLOCKED: Non-super_admin attempted total schema cleanup', { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole });

    const duration = Date.now() - startTime;
    const errorResult: RadicalCleanupResult = {
      success: false,
      message: 'Forbidden: This CRITICAL operation requires super_admin role',
      operations: [],
      stats: {
        documentsProcessed: 0,
        documentsRecreated: 0,
        errors: 1
      }
    };

    return NextResponse.json(errorResult, { status: 403 });
  }

  try {
    logger.info('[Navigation/RadicalClean] Starting total schema cleanup - DELETE and RECREATE all documents');

    const result: RadicalCleanupResult = {
      success: false,
      message: '',
      operations: [],
      stats: {
        documentsProcessed: 0,
        documentsRecreated: 0,
        errors: 0
      }
    };

    // STEP 1: Get all navigation documents
    logger.info('[Navigation/RadicalClean] Step 1: Loading all navigation documents');
    const navigationSnapshot = await getDocs(collection(db, COLLECTIONS.NAVIGATION));

    logger.info('[Navigation/RadicalClean] Found documents to recreate', { count: navigationSnapshot.docs.length });
    result.stats.documentsProcessed = navigationSnapshot.docs.length;

    if (navigationSnapshot.docs.length === 0) {
      result.success = true;
      result.message = 'No documents found to clean up.';
      return NextResponse.json(result);
    }

    // STEP 2: RADICAL CLEANUP - DELETE και RECREATE
    logger.info('[Navigation/RadicalClean] Step 2: Radical cleanup - delete and recreate all documents');

    for (const navDoc of navigationSnapshot.docs) {
      try {
        const docId = navDoc.id;
        const currentData = navDoc.data();
        const originalContactId = currentData.contactId;
        const beforeFieldCount = Object.keys(currentData).length;

        logger.info('[Navigation/RadicalClean] Recreating document', { docId, originalContactId, beforeFieldCount });

        // STEP 2A: DELETE the entire document
        await deleteDoc(doc(db, COLLECTIONS.NAVIGATION, docId));
        logger.info('[Navigation/RadicalClean] Document deleted', { docId });

        // STEP 2B: CREATE brand new document with PURE enterprise schema
        const pureSchema: PureEnterpriseNavigationSchema = {
          // PRESERVE ONLY ESSENTIAL DATA
          contactId: originalContactId || 'MISSING_CONTACT_ID',
          addedAt: currentData.addedAt || serverTimestamp(),
          addedBy: currentData.addedBy || 'legacy-system',
          status: 'active',

          // PURE ENTERPRISE METADATA
          version: 1, // Reset version to 1
          schemaVersion: '2.0.0-pure',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),

          // COMPLIANCE FIELDS
          complianceLevel: 'enterprise',
          lastCleaned: serverTimestamp()
        };

        // CREATE the new clean document
        await setDoc(doc(db, COLLECTIONS.NAVIGATION, docId), pureSchema);

        const afterFieldCount = Object.keys(pureSchema).length;

        result.stats.documentsRecreated++;
        result.operations.push({
          documentId: docId,
          originalContactId,
          action: 'recreated',
          beforeFieldCount,
          afterFieldCount
        });

        logger.info('[Navigation/RadicalClean] Document recreated', { docId, beforeFieldCount, afterFieldCount, newFields: Object.keys(pureSchema) });

      } catch (error) {
        logger.error('[Navigation/RadicalClean] Failed to recreate document', { docId: navDoc.id, error: error instanceof Error ? error.message : String(error) });
        result.stats.errors++;
        result.operations.push({
          documentId: navDoc.id,
          originalContactId: navDoc.data().contactId || 'unknown',
          action: 'error',
          beforeFieldCount: Object.keys(navDoc.data()).length,
          afterFieldCount: 0
        });
      }
    }

    // STEP 3: FINAL VALIDATION - Check uniformity
    logger.info('[Navigation/RadicalClean] Step 3: Final validation - checking schema uniformity');
    const validationSnapshot = await getDocs(collection(db, COLLECTIONS.NAVIGATION));

    let allFieldCounts: number[] = [];
    let allFieldSets: string[][] = [];

    for (const doc of validationSnapshot.docs) {
      const docData = doc.data();
      const fieldCount = Object.keys(docData).length;
      const fields = Object.keys(docData).sort();

      allFieldCounts.push(fieldCount);
      allFieldSets.push(fields);
    }

    const uniqueFieldCounts = [...new Set(allFieldCounts)];
    const isUniformCount = uniqueFieldCounts.length === 1;

    // Check if all documents have identical field names
    const firstFieldSet = allFieldSets[0]?.join(',');
    const allIdentical = allFieldSets.every(fieldSet => fieldSet.join(',') === firstFieldSet);

    logger.info('[Navigation/RadicalClean] Validation results', { fieldCounts: allFieldCounts, uniqueFieldCounts, isUniformCount, allIdentical });

    // STEP 4: Generate final result
    const { stats } = result;
    const isFullyCompliant = isUniformCount && allIdentical && uniqueFieldCounts[0] === 10;

    if (stats.documentsRecreated > 0 && stats.errors === 0 && isFullyCompliant) {
      result.success = true;
      result.message = `🎉 RADICAL CLEANUP SUCCESS: ALL ${stats.documentsRecreated} documents RECREATED with IDENTICAL schema. ` +
                      `Every document has exactly ${uniqueFieldCounts[0]} fields. TOTAL schema uniformity achieved!`;

      logger.info('[Navigation/RadicalClean] COMPLETED SUCCESSFULLY', { documentsRecreated: stats.documentsRecreated, uniformFieldCount: uniqueFieldCounts[0] });

    } else if (!isFullyCompliant) {
      result.success = false;
      result.message = `❌ RADICAL CLEANUP FAILED: Schema still not uniform. Field counts: [${uniqueFieldCounts.join(', ')}]. ` +
                      `Field uniformity: ${allIdentical ? 'OK' : 'FAILED'}`;

    } else if (stats.errors > 0) {
      result.success = false;
      result.message = `❌ RADICAL CLEANUP FAILED: ${stats.errors} documents failed to recreate.`;
    }

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking) - CRITICAL operation!
    const metadata = extractRequestMetadata(request);
    await logDataFix(
      ctx,
      'radical_clean_schema_total_recreation',
      {
        operation: 'radical-clean-schema',
        warning: 'CRITICAL - DELETED AND RECREATED ALL navigation documents',
        documentsProcessed: result.stats.documentsProcessed,
        documentsRecreated: result.stats.documentsRecreated,
        documentsErrors: result.stats.errors,
        pureSchemaFields: 10,
        complianceLevel: result.success ? 'achieved' : 'failed',
        executionTimeMs: duration,
        result: result.success ? 'success' : 'failed',
        metadata,
      },
      `CRITICAL: Radical schema cleanup by ${ctx.globalRole} ${ctx.email} - DELETED ALL documents`
    ).catch((err: unknown) => {
      logger.error('[Navigation/RadicalClean] Audit logging failed (non-blocking)', { error: err instanceof Error ? err.message : String(err) });
    });

    return NextResponse.json(result);

  } catch (error: unknown) {
    logger.error('[Navigation/RadicalClean] Radical enterprise cleanup failed', { error: error instanceof Error ? error.message : String(error) });
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: false,
      message: `Radical cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      operations: [],
      stats: {
        documentsProcessed: 0,
        documentsRecreated: 0,
        errors: 1
      }
    }, { status: 500 });
  }
}

/**
 * GET - Info Endpoint (withAuth protected)
 * Returns endpoint information and schema details.
 *
 * @security withAuth + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export const GET = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return NextResponse.json({
      endpoint: 'Radical Enterprise Cleanup - Navigation Companies',
      description: 'DELETES and RECREATES all documents with pure enterprise schema',
      problem: 'updateDoc preserves legacy fields causing persistent inconsistency',
      solution: 'DELETE existing + CREATE new = guaranteed schema uniformity',
      warning: '🚨 CRITICAL OPERATION - Deletes all existing documents',
      pureSchema: {
        totalFields: 10,
        coreFields: ['contactId', 'addedAt', 'addedBy', 'status'],
        metadataFields: ['version', 'schemaVersion', 'createdAt', 'updatedAt'],
        complianceFields: ['complianceLevel', 'lastCleaned']
      },
      guarantee: 'ALL documents will have EXACTLY the same fields',
      usage: 'POST to execute radical schema cleanup',
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
));