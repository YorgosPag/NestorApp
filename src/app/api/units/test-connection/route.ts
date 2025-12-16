import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BUILDING_IDS, BuildingIdUtils } from '@/config/building-ids-config';
import { COLLECTIONS } from '@/config/firestore-collections';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing units and buildings connection...');

    // 🏢 ENTERPRISE: Get buildings for configured project ID
    const buildingsQuery = query(
      collection(db, COLLECTIONS.BUILDINGS),
      where('projectId', '==', BUILDING_IDS.PROJECT_ID)
    );
    
    const buildingsSnapshot = await getDocs(buildingsQuery);
    const buildings = buildingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`Found ${buildings.length} buildings for project ${BUILDING_IDS.PROJECT_ID}`);

    // Get first 10 units for testing
    const unitsSnapshot = await getDocs(collection(db, COLLECTIONS.UNITS));
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
      unitsWithLegacyBuilding1: allUnits.filter(u => u.buildingId === BUILDING_IDS.LEGACY_BUILDING_1).length,
      unitsWithLegacyBuilding2: allUnits.filter(u => u.buildingId === BUILDING_IDS.LEGACY_BUILDING_2).length,
      unitsWithLegacyIds: allUnits.filter(u => BuildingIdUtils.isLegacyBuildingId(u.buildingId)).length
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