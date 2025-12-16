import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

export async function GET(request: NextRequest) {
  try {
    console.log('📋 Listing all companies...');

    const contactsQuery = query(
      collection(db, COLLECTIONS.CONTACTS),
      where('type', '==', 'company'),
      where('status', '==', 'active')
    );
    const contactsSnapshot = await getDocs(contactsQuery);

    const companies = contactsSnapshot.docs.map(doc => ({
      id: doc.id,
      companyName: doc.data().companyName,
      industry: doc.data().industry,
      vatNumber: doc.data().vatNumber,
      status: doc.data().status
    }));

    console.log(`🏢 Found ${companies.length} companies:`);
    companies.forEach(company => {
      console.log(`  - ${company.companyName} (ID: ${company.id})`);
    });

    return NextResponse.json({
      success: true,
      companies,
      count: companies.length
    });

  } catch (error) {
    console.error('❌ Error listing companies:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}