import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging unit floorplans...');

    // Get all unit floorplans from Firestore
    const floorplansQuery = query(
      collection(db, COLLECTIONS.DOCUMENTS),
      orderBy('updatedAt', 'desc')
    );
    
    const floorplansSnapshot = await getDocs(floorplansQuery);
    const floorplans = floorplansSnapshot.docs.map(doc => ({
      docId: doc.id,
      ...doc.data()
    }));

    console.log(`Found ${floorplans.length} unit floorplans`);

    return NextResponse.json({
      success: true,
      floorplans: floorplans.map(f => ({
        docId: f.docId,
        unitId: f.unitId,
        type: f.type,
        fileName: f.fileName,
        updatedAt: f.updatedAt,
        hasScene: !!f.scene
      })),
      count: floorplans.length,
      sampleFloorplan: floorplans[0] ? {
        docId: floorplans[0].docId,
        unitId: floorplans[0].unitId,
        type: floorplans[0].type,
        fileName: floorplans[0].fileName,
        sceneKeysCount: floorplans[0].scene ? Object.keys(floorplans[0].scene).length : 0
      } : null
    });

  } catch (error) {
    console.error('❌ Error debugging unit floorplans:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to debug unit floorplans',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}