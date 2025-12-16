/**
 * 🚨 RADICAL ENTERPRISE SOLUTION: TOTAL SCHEMA CLEANUP
 *
 * ΤΕΛΙΚΗ ΛΥΣΗ - ΜΗΔΕΝΙΚΗ ΑΝΟΧΗ ΣΕ LEGACY FIELDS
 *
 * ΠΡΟΒΛΗΜΑ:
 * - updateDoc δεν διαγράφει παλιά fields
 * - Documents κρατάνε legacy data (fixedBy, fixReason, κλπ)
 * - Συνεχίζει να υπάρχει ασυνέπεια
 *
 * RADICAL SOLUTION:
 * - DELETE και RECREATE κάθε document
 * - ΜΟΝΟ τα enterprise standard fields
 * - ΚΑΜΙΑ tolerance για legacy data
 *
 * @author Claude Radical Enterprise Cleanup System
 * @date 2025-12-17
 * @priority MAXIMUM - TOTAL SCHEMA CLEANUP
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, deleteDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

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
  addedAt: any;
  addedBy: string;
  status: 'active';

  // ENTERPRISE METADATA (4)
  version: number;
  schemaVersion: string;
  createdAt: any;
  updatedAt: any;

  // COMPLIANCE TRACKING (2)
  complianceLevel: 'enterprise';
  lastCleaned: any;
}

export async function POST(request: NextRequest): Promise<NextResponse<RadicalCleanupResult>> {
  try {
    console.log('🚨 RADICAL ENTERPRISE CLEANUP: STARTING TOTAL SCHEMA CLEANUP...');
    console.log('💥 WARNING: This will DELETE and RECREATE all navigation documents');
    console.log('🎯 Target: EXACTLY 10 fields per document - NO EXCEPTIONS');

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
    console.log('📊 Step 1: Loading ALL navigation documents for radical cleanup...');
    const navigationSnapshot = await getDocs(collection(db, COLLECTIONS.NAVIGATION));

    console.log(`   Found ${navigationSnapshot.docs.length} documents to RECREATE`);
    result.stats.documentsProcessed = navigationSnapshot.docs.length;

    if (navigationSnapshot.docs.length === 0) {
      result.success = true;
      result.message = 'No documents found to clean up.';
      return NextResponse.json(result);
    }

    // STEP 2: RADICAL CLEANUP - DELETE και RECREATE
    console.log('💥 Step 2: RADICAL CLEANUP - DELETE and RECREATE all documents...');

    for (const navDoc of navigationSnapshot.docs) {
      try {
        const docId = navDoc.id;
        const currentData = navDoc.data();
        const originalContactId = currentData.contactId;
        const beforeFieldCount = Object.keys(currentData).length;

        console.log(`   💥 RECREATING document ${docId}:`);
        console.log(`      Original contactId: ${originalContactId}`);
        console.log(`      Before: ${beforeFieldCount} fields (will be deleted)`);

        // STEP 2A: DELETE the entire document
        await deleteDoc(doc(db, COLLECTIONS.NAVIGATION, docId));
        console.log(`   🗑️  Document ${docId} DELETED`);

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

        console.log(`   ✅ Document ${docId} RECREATED: ${beforeFieldCount} → ${afterFieldCount} fields`);
        console.log(`      New fields: [${Object.keys(pureSchema).join(', ')}]`);

      } catch (error) {
        console.error(`   ❌ FAILED to recreate document ${navDoc.id}:`, error);
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
    console.log('✅ Step 3: FINAL VALIDATION - Checking schema uniformity...');
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

    console.log(`   📊 Field counts: [${allFieldCounts.join(', ')}]`);
    console.log(`   🔢 Unique counts: [${uniqueFieldCounts.join(', ')}]`);
    console.log(`   ${isUniformCount ? '✅' : '❌'} Count uniformity: ${isUniformCount ? 'ACHIEVED' : 'FAILED'}`);
    console.log(`   ${allIdentical ? '✅' : '❌'} Field name uniformity: ${allIdentical ? 'ACHIEVED' : 'FAILED'}`);

    // STEP 4: Generate final result
    const { stats } = result;
    const isFullyCompliant = isUniformCount && allIdentical && uniqueFieldCounts[0] === 10;

    if (stats.documentsRecreated > 0 && stats.errors === 0 && isFullyCompliant) {
      result.success = true;
      result.message = `🎉 RADICAL CLEANUP SUCCESS: ALL ${stats.documentsRecreated} documents RECREATED with IDENTICAL schema. ` +
                      `Every document has exactly ${uniqueFieldCounts[0]} fields. TOTAL schema uniformity achieved!`;

      console.log('🎉 RADICAL ENTERPRISE CLEANUP: TOTAL SUCCESS');
      console.log(`   - Documents recreated: ${stats.documentsRecreated}`);
      console.log(`   - Uniform field count: ${uniqueFieldCounts[0]}`);
      console.log(`   - Field name uniformity: ✅`);
      console.log(`   - Legacy data eliminated: 100%`);
      console.log('   - Status: PURE ENTERPRISE SCHEMA ✅');

    } else if (!isFullyCompliant) {
      result.success = false;
      result.message = `❌ RADICAL CLEANUP FAILED: Schema still not uniform. Field counts: [${uniqueFieldCounts.join(', ')}]. ` +
                      `Field uniformity: ${allIdentical ? 'OK' : 'FAILED'}`;

    } else if (stats.errors > 0) {
      result.success = false;
      result.message = `❌ RADICAL CLEANUP FAILED: ${stats.errors} documents failed to recreate.`;
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ RADICAL ENTERPRISE CLEANUP FAILED:', error);

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

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: 'Radical Enterprise Cleanup - Navigation Companies',
    description: 'DELETES and RECREATES all documents with pure enterprise schema',
    problem: 'updateDoc preserves legacy fields causing persistent inconsistency',
    solution: 'DELETE existing + CREATE new = guaranteed schema uniformity',
    warning: '🚨 DESTRUCTIVE OPERATION - Deletes all existing documents',
    pureSchema: {
      totalFields: 10,
      coreFields: ['contactId', 'addedAt', 'addedBy', 'status'],
      metadataFields: ['version', 'schemaVersion', 'createdAt', 'updatedAt'],
      complianceFields: ['complianceLevel', 'lastCleaned']
    },
    guarantee: 'ALL documents will have EXACTLY the same fields',
    usage: 'POST to execute radical schema cleanup',
    methods: ['POST'],
    author: 'Claude Radical Enterprise Cleanup System'
  });
}