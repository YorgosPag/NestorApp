import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const { companyIds } = await request.json();

    console.log('🧭 Starting navigation companies addition via API...');
    console.log(`📝 Processing ${companyIds.length} company IDs`);

    if (!adminDb) {
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

        const docRef = await adminDb.collection('navigation_companies').add(navigationEntry);
        addedNavigationIds.push(docRef.id);

        console.log(`✅ Added to navigation: Company ${contactId} (Entry ID: ${docRef.id})`);

      } catch (navigationError) {
        console.error(`❌ Error adding company ${contactId} to navigation:`, navigationError);
        // Συνεχίζουμε με τις επόμενες εταιρείες ακόμα κι αν μία αποτύχει
      }
    }

    console.log(`✅ Successfully added ${addedNavigationIds.length}/${companyIds.length} companies to navigation`);

    return NextResponse.json({
      success: true,
      message: `Successfully added ${addedNavigationIds.length} companies to navigation`,
      addedNavigationIds,
      navigationCount: addedNavigationIds.length,
      requestedCount: companyIds.length
    });

  } catch (error) {
    console.error('❌ Error in add-companies API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to add companies to navigation'
    }, { status: 500 });
  }
}