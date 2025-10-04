import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing units and buildings connection...');

    // Get buildings for project 1001 
    const buildingsQuery = query(
      collection(db, 'buildings'),
      where('projectId', '==', 1001)
    );
    
    const buildingsSnapshot = await getDocs(buildingsQuery);
    const buildings = buildingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`Found ${buildings.length} buildings for project 1001`);

    // Get first 10 units for testing
    const unitsSnapshot = await getDocs(collection(db, 'units'));
    const allUnits = unitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const sampleUnits = allUnits.slice(0, 10);

    return NextResponse.json({
      success: true,
      buildings: buildings.map(b => ({ id: b.id, name: b.name, projectId: b.projectId })),
      sampleUnits: sampleUnits.map(u => ({ 
        id: u.id, 
        name: u.name, 
        buildingId: u.buildingId, 
        building: u.building,
        project: u.project 
      })),
      totalUnits: allUnits.length,
      unitsWithBuildingId: allUnits.filter(u => u.buildingId).length,
      unitsWithBuilding1: allUnits.filter(u => u.buildingId === 'building-1').length,
      unitsWithBuilding2: allUnits.filter(u => u.buildingId === 'building-2').length
    });

  } catch (error) {
    console.error('❌ Error testing connection:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to test connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}