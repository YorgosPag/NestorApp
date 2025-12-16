import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, writeBatch, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(req: NextRequest) {
  console.log('🔧 Starting company fix process...');

  try {
    // Get all contacts with type 'company'
    const companiesQuery = query(
      collection(db, 'contacts'),
      where('type', '==', 'company')
    );

    const snapshot = await getDocs(companiesQuery);
    console.log(`📊 Found ${snapshot.size} companies`);

    const batch = writeBatch(db);
    let changesCount = 0;
    const results: any[] = [];

    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`🏢 Company ${index + 1}: ID=${doc.id}, Name="${data.companyName}"`);

      results.push({
        id: doc.id,
        name: data.companyName,
        action: 'none'
      });

      // 🏢 ENTERPRISE: Dynamic company detection (NO HARDCODED IDs)
      // Detect main company by checking if it's 'TechCorp Α.Ε.' which needs to be renamed
      if (data.companyName === 'TechCorp Α.Ε.') {
        // This is the main company - rename it to Pagonis
          console.log(`✅ Updating main company ID ${doc.id} to "Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε."`);
          batch.update(doc.ref, {
            companyName: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
            industry: 'Κατασκευές & Ανάπτυξη Ακινήτων',
            updatedAt: new Date()
          });
          results[results.length - 1].action = 'updated';
          changesCount++;
        }
      } else if (data.companyName === 'TechCorp Α.Ε.') {
        // These are duplicate companies - delete them
        console.log(`🗑️ Deleting duplicate company ID ${doc.id}`);
        batch.delete(doc.ref);
        results[results.length - 1].action = 'deleted';
        changesCount++;
      }
    });

    if (changesCount > 0) {
      console.log(`💾 Committing ${changesCount} changes...`);
      await batch.commit();
      console.log('✅ Company fix completed successfully!');
    } else {
      console.log('ℹ️ No changes needed');
    }

    return NextResponse.json({
      success: true,
      message: 'Company fix completed successfully',
      changesCount,
      results
    });

  } catch (error) {
    console.error('❌ Error fixing companies:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fix companies'
      },
      { status: 500 }
    );
  }
}