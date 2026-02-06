/**
 * =============================================================================
 * FORCE UNIFORM SCHEMA - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Forces all navigation documents to have identical schema structure
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification Data fix operation (mass update)
 *
 * This endpoint:
 * - Forces uniform schema on ALL navigation documents
 * - Updates documents to have exactly the same fields
 * - Eliminates schema inconsistencies
 *
 * PROBLEM:
 * - Documents have 3, 7, 9 different field counts
 * - Total schema inconsistency
 * - Violates enterprise standards
 *
 * SOLUTION:
 * - MANDATORY uniform schema for ALL documents
 * - Zero tolerance for inconsistency
 * - Fortune 500 compliance
 *
 * @method GET - Info endpoint (read-only)
 * @method POST - Execute schema enforcement (updates ALL documents)
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:data:fix permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - Layer 3: Audit logging (logDataFix)
 *
 * @classification CRITICAL - Mass schema update operation
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, updateDoc, doc, serverTimestamp, FieldValue, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Firebase timestamp type */
type FirebaseTimestamp = Timestamp | FieldValue;

/** Navigation document data */
interface NavigationDocumentData {
  contactId?: string;
  addedAt?: FirebaseTimestamp;
  addedBy?: string;
  createdAt?: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
  version?: number;
  status?: 'active' | 'inactive';
  source?: 'system' | 'manual' | 'migration' | 'auto-fix';
  schemaVersion?: string;
  lastVerified?: FirebaseTimestamp;
  complianceLevel?: string;
  fixedBy?: string;
  fixReason?: string;
  migrationInfo?: MigrationInfo;
}

/** Migration info structure */
interface MigrationInfo {
  migratedAt: FirebaseTimestamp;
  migratedBy: string;
  reason: string;
  previousSchema: PreviousSchemaInfo;
}

/** Previous schema info */
interface PreviousSchemaInfo {
  fieldCount: number;
  fields: string[];
  timestamp: FirebaseTimestamp;
}

interface UniformSchemaResult {
  success: boolean;
  message: string;
  transformations: Array<{
    documentId: string;
    beforeFields: string[];
    afterFields: string[];
    fieldCount: {
      before: number;
      after: number;
    };
    action: 'standardized' | 'error';
  }>;
  stats: {
    documentsProcessed: number;
    documentsStandardized: number;
    errors: number;
  };
}

// 🏢 ENTERPRISE UNIFORM SCHEMA - ΑΥΤΗ ΕΙΝΑΙ Η ΜΟΝΑΔΙΚΗ ΕΠΙΤΡΕΠΟΜΕΝΗ ΔΟΜΗ
interface EnterpriseUniformNavigationSchema {
  // CORE IDENTITY (MANDATORY)
  contactId: string;                    // Company reference ID

  // AUDIT METADATA (MANDATORY)
  addedAt: FirebaseTimestamp;          // When added to navigation
  addedBy: string;                     // Who/what added it
  createdAt: FirebaseTimestamp;        // Enterprise creation timestamp
  updatedAt: FirebaseTimestamp;        // Enterprise update timestamp

  // ENTERPRISE CONTROL (MANDATORY)
  version: number;                     // Document version
  status: 'active' | 'inactive';      // Operational status
  source: 'system' | 'manual' | 'migration' | 'auto-fix'; // Origin tracking

  // ENTERPRISE METADATA (MANDATORY)
  schemaVersion: string;               // Schema version for future migrations
  lastVerified: FirebaseTimestamp;     // Last verification timestamp
  complianceLevel: 'enterprise';       // Always 'enterprise'

  // CHANGE TRACKING (CONDITIONAL - Only if document was modified)
  migrationInfo?: MigrationInfo;
}

/**
 * POST - Execute Schema Enforcement (withAuth protected)
 * Forces uniform schema on ALL navigation documents.
 *
 * @security withAuth + super_admin check + audit logging + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<UniformSchemaResult>> => {
    return handleForceUniformSchemaExecute(req, ctx);
  },
  { permissions: 'admin:data:fix' }
));

/**
 * Internal handler for POST (execute schema enforcement).
 */
async function handleForceUniformSchemaExecute(request: NextRequest, ctx: AuthContext): Promise<NextResponse<UniformSchemaResult>> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [POST /api/navigation/force-uniform-schema] BLOCKED: Non-super_admin attempted schema enforcement`,
      { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole }
    );

    const errorResult: UniformSchemaResult = {
      success: false,
      message: 'Forbidden: This CRITICAL mass update operation requires super_admin role',
      transformations: [],
      stats: {
        documentsProcessed: 0,
        documentsStandardized: 0,
        errors: 1
      }
    };

    return NextResponse.json(errorResult, { status: 403 });
  }

  try {
    console.log('🚨 ENTERPRISE FORCE UNIFORM SCHEMA: STARTING TOTAL STANDARDIZATION...');
    console.log('📋 TARGET: ALL documents will have EXACTLY the same fields');
    console.log('⚠️  NO EXCEPTIONS - Fortune 500 compliance MANDATORY');

    const result: UniformSchemaResult = {
      success: false,
      message: '',
      transformations: [],
      stats: {
        documentsProcessed: 0,
        documentsStandardized: 0,
        errors: 0
      }
    };

    // STEP 1: Get ALL navigation documents
    console.log('📊 Step 1: Loading ALL navigation_companies documents...');
    const navigationSnapshot = await getDocs(collection(db, COLLECTIONS.NAVIGATION));

    console.log(`   Found ${navigationSnapshot.docs.length} documents to standardize`);
    result.stats.documentsProcessed = navigationSnapshot.docs.length;

    if (navigationSnapshot.docs.length === 0) {
      result.success = true;
      result.message = 'No documents found to standardize.';
      return NextResponse.json(result);
    }

    // STEP 2: FORCE STANDARDIZATION - NO EXCEPTIONS
    console.log('🔧 Step 2: FORCING uniform schema on ALL documents...');
    console.log('⚠️  WARNING: This will OVERWRITE existing structures');

    for (const navDoc of navigationSnapshot.docs) {
      try {
        const docId = navDoc.id;
        const currentData = navDoc.data() as NavigationDocumentData;
        const beforeFields = Object.keys(currentData);

        console.log(`   🔄 STANDARDIZING document ${docId}:`);
        console.log(`      Before: ${beforeFields.length} fields [${beforeFields.join(', ')}]`);

        // 🏢 CREATE ENTERPRISE UNIFORM SCHEMA - FORCED STANDARDIZATION
        // Type inference για Firestore compatibility
        const uniformSchema = {
          // PRESERVE CORE DATA (required)
          contactId: currentData.contactId || 'MISSING_CONTACT_ID',

          // STANDARDIZE AUDIT METADATA
          addedAt: currentData.addedAt || serverTimestamp(),
          addedBy: currentData.addedBy || 'legacy-system',
          createdAt: currentData.createdAt || currentData.addedAt || serverTimestamp(),
          updatedAt: serverTimestamp(),

          // FORCE ENTERPRISE CONTROL
          version: getNextVersion(currentData),
          status: currentData.status || 'active',
          source: detectAndStandardizeSource(currentData),

          // MANDATORY ENTERPRISE METADATA
          schemaVersion: '1.0.0',
          lastVerified: serverTimestamp(),
          complianceLevel: 'enterprise',

          // ADD MIGRATION INFO (tracking the transformation)
          migrationInfo: {
            migratedAt: serverTimestamp(),
            migratedBy: 'enterprise-force-uniform-schema-system',
            reason: 'FORCE uniform schema - eliminating field count inconsistency',
            previousSchema: {
              fieldCount: beforeFields.length,
              fields: beforeFields,
              timestamp: serverTimestamp()
            }
          }
        };

        // EXECUTE FORCED UPDATE - COMPLETE SCHEMA REPLACEMENT
        await updateDoc(doc(db, COLLECTIONS.NAVIGATION, docId), uniformSchema);

        const afterFields = Object.keys(uniformSchema);

        result.stats.documentsStandardized++;
        result.transformations.push({
          documentId: docId,
          beforeFields,
          afterFields,
          fieldCount: {
            before: beforeFields.length,
            after: afterFields.length
          },
          action: 'standardized'
        });

        console.log(`   ✅ Document ${docId} STANDARDIZED: ${beforeFields.length} → ${afterFields.length} fields`);
        console.log(`      After: [${afterFields.join(', ')}]`);

      } catch (error) {
        console.error(`   ❌ FAILED to standardize document ${navDoc.id}:`, error);
        result.stats.errors++;
        result.transformations.push({
          documentId: navDoc.id,
          beforeFields: Object.keys(navDoc.data()),
          afterFields: [],
          fieldCount: {
            before: Object.keys(navDoc.data()).length,
            after: 0
          },
          action: 'error'
        });
      }
    }

    // STEP 3: VALIDATION - Ensure ALL documents now have IDENTICAL schema
    console.log('✅ Step 3: VALIDATING uniform schema compliance...');
    const validationSnapshot = await getDocs(collection(db, COLLECTIONS.NAVIGATION));

    let allFieldCounts: number[] = [];
    for (const doc of validationSnapshot.docs) {
      const fieldCount = Object.keys(doc.data()).length;
      allFieldCounts.push(fieldCount);
    }

    const uniqueFieldCounts = [...new Set(allFieldCounts)];
    const isUniform = uniqueFieldCounts.length === 1;

    console.log(`   📊 Field count analysis: [${allFieldCounts.join(', ')}]`);
    console.log(`   🎯 Unique field counts: [${uniqueFieldCounts.join(', ')}]`);
    console.log(`   ${isUniform ? '✅' : '❌'} Schema uniformity: ${isUniform ? 'ACHIEVED' : 'FAILED'}`);

    // STEP 4: Generate final result
    const { stats } = result;

    if (stats.documentsStandardized > 0 && stats.errors === 0 && isUniform) {
      result.success = true;
      result.message = `🎉 ENTERPRISE SUCCESS: ALL ${stats.documentsStandardized} documents now have IDENTICAL schema structure. ` +
                      `Field count uniformity: ${uniqueFieldCounts[0]} fields per document. Zero tolerance for inconsistency achieved!`;

      console.log('🎉 ENTERPRISE FORCE UNIFORM SCHEMA: TOTAL SUCCESS');
      console.log(`   - All documents standardized: ${stats.documentsStandardized}`);
      console.log(`   - Uniform field count: ${uniqueFieldCounts[0]}`);
      console.log(`   - Inconsistency eliminated: 100%`);
      console.log('   - Status: ENTERPRISE COMPLIANT ✅');

    } else if (!isUniform) {
      result.success = false;
      result.message = `❌ STANDARDIZATION FAILED: Documents still have inconsistent schemas. Field counts: [${uniqueFieldCounts.join(', ')}]. This violates enterprise standards.`;

    } else if (stats.errors > 0) {
      result.success = false;
      result.message = `❌ STANDARDIZATION FAILED: ${stats.errors} documents failed to standardize.`;
    }

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logDataFix(
      ctx,
      'force_uniform_schema_navigation',
      {
        operation: 'force-uniform-schema',
        documentsProcessed: result.stats.documentsProcessed,
        documentsStandardized: result.stats.documentsStandardized,
        errors: result.stats.errors,
        uniqueFieldCounts: uniqueFieldCounts,
        schemaUniformity: isUniform ? 'achieved' : 'failed',
        executionTimeMs: duration,
        result: result.success ? 'success' : 'failed',
        metadata,
      },
      `Schema enforcement by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      console.error('⚠️ Audit logging failed (non-blocking):', err);
    });

    return NextResponse.json({ ...result, executionTimeMs: duration });

  } catch (error: unknown) {
    console.error('❌ ENTERPRISE FORCE UNIFORM SCHEMA FAILED:', error);
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: false,
      message: `Force uniform schema failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      transformations: [],
      stats: {
        documentsProcessed: 0,
        documentsStandardized: 0,
        errors: 1
      },
      executionTimeMs: duration
    }, { status: 500 });
  }
}

/**
 * Calculate next version number
 */
function getNextVersion(currentData: NavigationDocumentData): number {
  if (currentData.version && typeof currentData.version === 'number') {
    return currentData.version + 1;
  }
  return 1;
}

/**
 * Detect and standardize source field
 */
function detectAndStandardizeSource(currentData: NavigationDocumentData): 'system' | 'manual' | 'migration' | 'auto-fix' {
  if (currentData.source) return currentData.source;
  if (currentData.fixedBy || currentData.fixReason) return 'auto-fix';
  if (currentData.migrationInfo) return 'migration';
  if (currentData.addedBy === 'system') return 'system';
  return 'manual';
}

/**
 * GET - Info Endpoint (withAuth protected)
 * Returns endpoint information.
 *
 * @security withAuth + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export const GET = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return NextResponse.json({
      endpoint: 'Enterprise Force Uniform Schema - Navigation Companies',
      description: 'FORCES ALL documents to have IDENTICAL schema structure',
      problem: 'Documents have 3, 7, 9 different field counts - TOTAL inconsistency',
      solution: 'MANDATORY uniform schema - ALL documents get EXACTLY the same fields',
      enterpriseStandard: 'Zero tolerance for schema inconsistency',
      enforcement: 'FORCED standardization - no exceptions',
      targetSchema: {
        mandatoryFields: 10,
        fieldNames: ['contactId', 'addedAt', 'addedBy', 'createdAt', 'updatedAt', 'version', 'status', 'source', 'schemaVersion', 'lastVerified', 'complianceLevel'],
        conditionalFields: ['migrationInfo']
      },
      usage: 'POST to enforce uniform schema on ALL navigation companies',
      warning: 'This OVERWRITES existing document structures - CRITICAL OPERATION',
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