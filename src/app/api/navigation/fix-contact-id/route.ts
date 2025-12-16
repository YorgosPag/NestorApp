/**
 * 🏢 ENTERPRISE CRITICAL FIX: Wrong ContactId in Navigation Companies
 *
 * Διορθώνει το λάθος contactId "pagonis" → "pzNUy8ksddGCtcQMqumR"
 * στη navigation_companies συλλογή για την εταιρεία ΠΑΓΩΝΗΣ
 *
 * PROBLEM IDENTIFIED:
 * - navigation_companies έχει contactId: "pagonis"
 * - Σωστό contactId: "pzNUy8ksddGCtcQMqumR"
 * - Projects δεν εμφανίζονται γιατί το ID δεν ταιριάζει
 *
 * ENTERPRISE SOLUTION:
 * - Safe update του navigation_companies document
 * - Comprehensive validation και error handling
 * - Full audit trail για transparency
 *
 * @author Claude Enterprise Fix System
 * @date 2025-12-17
 * @priority CRITICAL
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, query, getDocs, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

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

export async function POST(request: NextRequest): Promise<NextResponse<ContactIdFixResult>> {
  try {
    console.log('🛠️ ENTERPRISE CRITICAL FIX: Starting contactId correction...');

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
    console.log('📊 Step 1: Searching for wrong contactId entries...');
    const navigationQuery = query(
      collection(db, COLLECTIONS.NAVIGATION),
      where('contactId', '==', 'pagonis')
    );
    const navigationSnapshot = await getDocs(navigationQuery);

    console.log(`   Found ${navigationSnapshot.docs.length} documents with contactId "pagonis"`);
    result.stats.documentsChecked = navigationSnapshot.docs.length;

    if (navigationSnapshot.docs.length === 0) {
      result.success = true;
      result.message = 'No documents found with incorrect contactId "pagonis". Navigation is already correct.';
      return NextResponse.json(result);
    }

    // STEP 2: Verify that the target company exists
    console.log('🔍 Step 2: Verifying target company exists...');
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

    console.log(`   ✅ Target company "${companyName}" verified in contacts`);

    // STEP 3: Fix each navigation document
    console.log('🔧 Step 3: Fixing navigation documents...');

    for (const navDoc of navigationSnapshot.docs) {
      try {
        const docId = navDoc.id;
        const docData = navDoc.data();

        console.log(`   🔄 Fixing document ${docId}: "${docData.contactId}" → "${targetContactId}"`);

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

        console.log(`   ✅ Successfully fixed document ${docId}`);

      } catch (error) {
        console.error(`   ❌ Failed to fix document ${navDoc.id}:`, error);
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

      console.log('🎉 ENTERPRISE CRITICAL FIX COMPLETED SUCCESSFULLY:');
      console.log(`   - Documents checked: ${stats.documentsChecked}`);
      console.log(`   - Documents fixed: ${stats.documentsFixed}`);
      console.log(`   - Company: ${companyName}`);
      console.log(`   - ContactId: "pagonis" → "${targetContactId}"`);

    } else if (stats.documentsFixed > 0 && stats.errors > 0) {
      result.success = true; // Partial success
      result.message = `Partially completed fix: ${stats.documentsFixed} fixed, ${stats.errors} errors. ` +
                      `Some projects may now appear for "${companyName}".`;

      console.log('⚠️ ENTERPRISE CRITICAL FIX: Partial success');

    } else {
      result.success = false;
      result.message = `Failed to fix navigation documents. ${stats.errors} errors occurred.`;

      console.log('❌ ENTERPRISE CRITICAL FIX: Failed');
    }

    // STEP 5: Log sample fixes for transparency
    if (result.fixes.length > 0) {
      console.log('📋 Fix details:');
      result.fixes.forEach(fix => {
        console.log(`   - Document ${fix.documentId}: ${fix.action} (${fix.oldContactId} → ${fix.newContactId})`);
      });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ ENTERPRISE CRITICAL FIX FAILED:', error);

    return NextResponse.json({
      success: false,
      message: `Critical fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      fixes: [],
      stats: {
        documentsChecked: 0,
        documentsFixed: 0,
        errors: 1
      }
    }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: 'Enterprise Critical Fix - Contact ID Correction',
    description: 'Fixes wrong contactId "pagonis" → "pzNUy8ksddGCtcQMqumR" in navigation_companies',
    problem: 'ΠΑΓΩΝΗΣ company projects not showing due to wrong contactId in navigation',
    solution: 'Update navigation_companies documents with correct contactId',
    usage: 'POST to this endpoint to execute the fix',
    priority: 'CRITICAL',
    methods: ['POST'],
    author: 'Claude Enterprise Fix System'
  });
}