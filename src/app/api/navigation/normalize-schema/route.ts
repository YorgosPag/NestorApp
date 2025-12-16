/**
 * 🏢 ENTERPRISE SCHEMA NORMALIZATION: Navigation Companies Collection
 *
 * Διορθώνει την inconsistent δομή δεδομένων στη navigation_companies
 *
 * ΜΠΑΚΑΛΙΚΟ ΓΕΙΤΟΝΙΑΣ PROBLEM:
 * - Κάποια documents έχουν 7 πεδία
 * - Κάποια documents έχουν 3 πεδία
 * - Κάποια documents έχουν 2 πεδία
 * - Ασυνεπής δομή → Unprofessional code
 *
 * ENTERPRISE SOLUTION:
 * - Unified schema για όλα τα documents
 * - Mandatory fields: addedAt, addedBy, contactId
 * - Optional enterprise fields: source, migrationInfo, version
 * - Complete audit trail for all changes
 *
 * @author Claude Enterprise Schema Normalization System
 * @date 2025-12-17
 * @priority HIGH - Data consistency is critical
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

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
  addedAt: any;                        // Firestore Timestamp - when added to navigation
  addedBy: string;                     // System/user identifier who added

  // ENTERPRISE METADATA (Optional but recommended)
  version?: number;                    // Document version for change tracking
  source?: 'system' | 'manual' | 'migration' | 'auto-fix'; // How it was created
  status?: 'active' | 'inactive';     // Navigation status

  // AUDIT TRAIL (For documents that have been modified)
  fixedAt?: any;                       // When last fixed/updated
  fixedBy?: string;                    // System that performed fix
  fixReason?: string;                  // Reason for fix
  previousContactId?: string;          // Previous contactId if changed
  migrationInfo?: {                    // Migration metadata
    migratedAt: any;
    migratedBy: string;
    reason: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<SchemaNormalizationResult>> {
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

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ ENTERPRISE SCHEMA NORMALIZATION FAILED:', error);

    return NextResponse.json({
      success: false,
      message: `Schema normalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      normalization: [],
      stats: {
        documentsChecked: 0,
        documentsNormalized: 0,
        documentsCompliant: 0,
        errors: 1
      }
    }, { status: 500 });
  }
}

/**
 * Check if document has compliant enterprise schema
 */
function hasCompliantSchema(docData: any): boolean {
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
function detectSource(docData: any): 'system' | 'manual' | 'migration' | 'auto-fix' {
  if (docData.fixedBy) return 'auto-fix';
  if (docData.addedBy === 'system') return 'system';
  if (docData.migrationInfo) return 'migration';
  return 'manual';
}

export async function GET(): Promise<NextResponse> {
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
    author: 'Claude Enterprise Schema Normalization System'
  });
}