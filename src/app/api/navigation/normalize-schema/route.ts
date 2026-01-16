/**
 * =============================================================================
 * NORMALIZE SCHEMA - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Normalizes inconsistent navigation schema to enterprise standards
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification Data fix operation
 *
 * This endpoint:
 * - Normalizes inconsistent schema in navigation documents
 * - Ensures all documents have mandatory fields
 * - Adds enterprise metadata where missing
 *
 * PROBLEM:
 * - Documents have 2, 3, 7 different field counts
 * - Inconsistent structure across collection
 * - Unprofessional data inconsistency
 *
 * SOLUTION:
 * - Unified schema with mandatory fields
 * - Enterprise metadata (version, source, status)
 * - Complete audit trail
 *
 * @method GET - Info endpoint (read-only)
 * @method POST - Execute normalization (updates documents)
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
import { collection, getDocs, updateDoc, doc, serverTimestamp, Timestamp, FieldValue } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';

/** Firestore Timestamp type for navigation documents */
type FirestoreTimestamp = Timestamp | FieldValue | Date;

interface SchemaNormalizationResult {
  success: boolean;
  message: string;
  normalization: Array<{
    documentId: string;
    originalFields: string[];
    normalizedFields: string[];
    fieldCount: {
      before: number;
      after: number;
    };
    action: 'normalized' | 'already_compliant' | 'error';
  }>;
  stats: {
    documentsChecked: number;
    documentsNormalized: number;
    documentsCompliant: number;
    errors: number;
  };
}

// Enterprise Schema Definition για Navigation Companies
interface NavigationCompanySchema {
  // MANDATORY CORE FIELDS (Enterprise Standard)
  contactId: string;                    // Reference to contacts collection
  addedAt: FirestoreTimestamp;         // Firestore Timestamp - when added to navigation
  addedBy: string;                     // System/user identifier who added

  // ENTERPRISE METADATA (Optional but recommended)
  version?: number;                    // Document version for change tracking
  source?: 'system' | 'manual' | 'migration' | 'auto-fix'; // How it was created
  status?: 'active' | 'inactive';     // Navigation status

  // AUDIT TRAIL (For documents that have been modified)
  fixedAt?: FirestoreTimestamp;        // When last fixed/updated
  fixedBy?: string;                    // System that performed fix
  fixReason?: string;                  // Reason for fix
  previousContactId?: string;          // Previous contactId if changed
  migrationInfo?: {                    // Migration metadata
    migratedAt: FirestoreTimestamp;
    migratedBy: string;
    reason: string;
  };
}

/**
 * POST - Execute Schema Normalization (withAuth protected)
 * Normalizes navigation document schemas to enterprise standards.
 *
 * @security withAuth + super_admin check + audit logging + admin:data:fix permission
 */
export const POST = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<SchemaNormalizationResult>> => {
    return handleNormalizeSchemaExecute(req, ctx);
  },
  { permissions: 'admin:data:fix' }
);

/**
 * Internal handler for POST (execute normalization).
 */
async function handleNormalizeSchemaExecute(request: NextRequest, ctx: AuthContext): Promise<NextResponse<SchemaNormalizationResult>> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [POST /api/navigation/normalize-schema] BLOCKED: Non-super_admin attempted schema normalization`,
      { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole }
    );

    const errorResult: SchemaNormalizationResult = {
      success: false,
      message: 'Forbidden: This operation requires super_admin role',
      normalization: [],
      stats: {
        documentsChecked: 0,
        documentsNormalized: 0,
        documentsCompliant: 0,
        errors: 1
      }
    };

    return NextResponse.json(errorResult, { status: 403 });
  }

  try {
    console.log('🏢 ENTERPRISE SCHEMA NORMALIZATION: Starting navigation_companies normalization...');

    const result: SchemaNormalizationResult = {
      success: false,
      message: '',
      normalization: [],
      stats: {
        documentsChecked: 0,
        documentsNormalized: 0,
        documentsCompliant: 0,
        errors: 0
      }
    };

    // STEP 1: Get all navigation_companies documents
    console.log('📊 Step 1: Fetching all navigation_companies documents...');
    const navigationSnapshot = await getDocs(collection(db, COLLECTIONS.NAVIGATION));

    console.log(`   Found ${navigationSnapshot.docs.length} navigation companies documents`);
    result.stats.documentsChecked = navigationSnapshot.docs.length;

    if (navigationSnapshot.docs.length === 0) {
      result.success = true;
      result.message = 'No navigation companies found. Collection is empty.';
      return NextResponse.json(result);
    }

    // STEP 2: Analyze and normalize each document
    console.log('🔧 Step 2: Analyzing and normalizing document schemas...');

    for (const navDoc of navigationSnapshot.docs) {
      try {
        const docId = navDoc.id;
        const docData = navDoc.data();
        const originalFields = Object.keys(docData);

        console.log(`   📋 Analyzing document ${docId}: ${originalFields.length} fields`);
        console.log(`      Fields: [${originalFields.join(', ')}]`);

        // Check if document needs normalization
        const needsNormalization = !hasCompliantSchema(docData);

        if (needsNormalization) {
          console.log(`   🔄 Normalizing document ${docId}...`);

          // Create normalized document
          const normalizedDoc: Partial<NavigationCompanySchema> = {
            // Preserve existing core data
            contactId: docData.contactId || 'unknown',
            addedAt: docData.addedAt || serverTimestamp(),
            addedBy: docData.addedBy || 'legacy-system',

            // Add enterprise metadata
            version: docData.version || 1,
            source: docData.source || detectSource(docData),
            status: docData.status || 'active',

            // Preserve existing fix information if exists
            ...(docData.fixedAt && { fixedAt: docData.fixedAt }),
            ...(docData.fixedBy && { fixedBy: docData.fixedBy }),
            ...(docData.fixReason && { fixReason: docData.fixReason }),
            ...(docData.previousContactId && { previousContactId: docData.previousContactId }),

            // Add normalization metadata
            migrationInfo: {
              migratedAt: serverTimestamp(),
              migratedBy: 'enterprise-schema-normalization-system',
              reason: 'Schema normalization - converting inconsistent structure to enterprise standard'
            }
          };

          // Update document
          await updateDoc(doc(db, COLLECTIONS.NAVIGATION, docId), normalizedDoc);

          const normalizedFields = Object.keys(normalizedDoc);
          result.stats.documentsNormalized++;
          result.normalization.push({
            documentId: docId,
            originalFields,
            normalizedFields,
            fieldCount: {
              before: originalFields.length,
              after: normalizedFields.length
            },
            action: 'normalized'
          });

          console.log(`   ✅ Document ${docId} normalized: ${originalFields.length} → ${normalizedFields.length} fields`);

        } else {
          console.log(`   ✅ Document ${docId} already compliant`);
          result.stats.documentsCompliant++;
          result.normalization.push({
            documentId: docId,
            originalFields,
            normalizedFields: originalFields,
            fieldCount: {
              before: originalFields.length,
              after: originalFields.length
            },
            action: 'already_compliant'
          });
        }

      } catch (error) {
        console.error(`   ❌ Failed to normalize document ${navDoc.id}:`, error);
        result.stats.errors++;
        result.normalization.push({
          documentId: navDoc.id,
          originalFields: Object.keys(navDoc.data()),
          normalizedFields: [],
          fieldCount: {
            before: Object.keys(navDoc.data()).length,
            after: 0
          },
          action: 'error'
        });
      }
    }

    // STEP 3: Generate result summary
    const { stats } = result;

    if (stats.documentsNormalized > 0 && stats.errors === 0) {
      result.success = true;
      result.message = `Successfully normalized ${stats.documentsNormalized} documents. ` +
                      `${stats.documentsCompliant} documents were already compliant. ` +
                      `Navigation companies now have consistent enterprise schema.`;

      console.log('🎉 ENTERPRISE SCHEMA NORMALIZATION COMPLETED SUCCESSFULLY:');
      console.log(`   - Documents checked: ${stats.documentsChecked}`);
      console.log(`   - Documents normalized: ${stats.documentsNormalized}`);
      console.log(`   - Documents already compliant: ${stats.documentsCompliant}`);
      console.log(`   - All documents now follow enterprise schema standards`);

    } else if (stats.documentsNormalized === 0 && stats.documentsCompliant > 0) {
      result.success = true;
      result.message = `Schema is already normalized. All ${stats.documentsCompliant} documents follow enterprise standards.`;

      console.log('✅ ENTERPRISE SCHEMA: Already normalized, no action needed');

    } else if (stats.errors > 0) {
      result.success = stats.documentsNormalized > 0; // Partial success if some normalized
      result.message = `Schema normalization completed with ${stats.errors} errors. ` +
                      `${stats.documentsNormalized} documents normalized successfully.`;

      console.log('⚠️ ENTERPRISE SCHEMA NORMALIZATION: Completed with errors');
    }

    // STEP 4: Log normalization details for transparency
    console.log('📋 Schema normalization summary:');
    result.normalization.slice(0, 5).forEach(norm => {
      console.log(`   - Document ${norm.documentId}: ${norm.action} (${norm.fieldCount.before} → ${norm.fieldCount.after} fields)`);
    });

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logDataFix(
      ctx,
      'normalize_navigation_schema',
      {
        operation: 'normalize-schema',
        documentsChecked: result.stats.documentsChecked,
        documentsNormalized: result.stats.documentsNormalized,
        documentsCompliant: result.stats.documentsCompliant,
        errors: result.stats.errors,
        executionTimeMs: duration,
        result: result.success ? 'success' : 'failed',
        metadata,
      },
      `Schema normalization by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      console.error('⚠️ Audit logging failed (non-blocking):', err);
    });

    return NextResponse.json({ ...result, executionTimeMs: duration });

  } catch (error: unknown) {
    console.error('❌ ENTERPRISE SCHEMA NORMALIZATION FAILED:', error);
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: false,
      message: `Schema normalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      normalization: [],
      stats: {
        documentsChecked: 0,
        documentsNormalized: 0,
        documentsCompliant: 0,
        errors: 1
      },
      executionTimeMs: duration
    }, { status: 500 });
  }
}

/** Navigation document data for validation */
interface NavigationDocData {
  contactId?: string;
  addedAt?: FirestoreTimestamp;
  addedBy?: string;
  fixedBy?: string;
  migrationInfo?: { migratedAt: FirestoreTimestamp; migratedBy: string; reason: string };
  [key: string]: unknown;
}

/**
 * Check if document has compliant enterprise schema
 */
function hasCompliantSchema(docData: NavigationDocData): boolean {
  const requiredFields = ['contactId', 'addedAt', 'addedBy'];

  // Check if all required fields exist
  for (const field of requiredFields) {
    if (!(field in docData)) {
      return false;
    }
  }

  // Additional checks for enterprise compliance
  return true;
}

/**
 * Detect source based on document characteristics
 */
function detectSource(docData: NavigationDocData): 'system' | 'manual' | 'migration' | 'auto-fix' {
  if (docData.fixedBy) return 'auto-fix';
  if (docData.addedBy === 'system') return 'system';
  if (docData.migrationInfo) return 'migration';
  return 'manual';
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
      endpoint: 'Enterprise Schema Normalization - Navigation Companies',
      description: 'Normalizes inconsistent navigation_companies schema to enterprise standards',
      problem: 'Documents have different field counts (2, 3, 7) - unprofessional inconsistency',
      solution: 'Unified schema with mandatory fields + enterprise metadata',
      enterpriseSchema: {
        mandatory: ['contactId', 'addedAt', 'addedBy'],
        optional: ['version', 'source', 'status', 'migrationInfo'],
        auditTrail: ['fixedAt', 'fixedBy', 'fixReason', 'previousContactId']
      },
      usage: 'POST to this endpoint to normalize all navigation companies',
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