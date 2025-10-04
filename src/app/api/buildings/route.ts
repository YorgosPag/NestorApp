import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    console.log('🏗️ Fetching buildings from Firestore...');

    // Get all buildings from Firestore
    const buildingsQuery = query(
      collection(db, 'buildings'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(buildingsQuery);
    
    const buildings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✅ Successfully fetched ${buildings.length} buildings from Firestore`);

    return NextResponse.json({
      success: true,
      buildings,
      count: buildings.length
    });

  } catch (error) {
    console.error('❌ Error fetching buildings:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch buildings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}