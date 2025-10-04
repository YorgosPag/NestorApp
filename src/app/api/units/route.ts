import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    console.log('🏠 Fetching units from Firestore...');

    // Get all units from the 'units' collection
    const unitsQuery = query(
      collection(db, 'units'),
      orderBy('name', 'asc')
    );
    
    const unitsSnapshot = await getDocs(unitsQuery);
    const units = unitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✅ Successfully fetched ${units.length} units from Firestore`);
    
    return NextResponse.json({
      success: true,
      units,
      count: units.length
    });

  } catch (error) {
    console.error('❌ Error fetching units:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch units',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}