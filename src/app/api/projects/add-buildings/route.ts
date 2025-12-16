import { NextRequest, NextResponse } from 'next/server';
import { collection, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BUILDING_IDS } from '@/config/building-ids-config';

export async function POST(request: NextRequest) {
  try {
    console.log('🏗️ Adding buildings to projects in Firestore...');

    // 🏢 ENTERPRISE: Get buildings for configured project ID
    const buildingsQuery = query(
      collection(db, 'buildings'),
      where('projectId', '==', BUILDING_IDS.PROJECT_ID)
    );
    
    const buildingsSnapshot = await getDocs(buildingsQuery);
    const buildings = buildingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`Found ${buildings.length} buildings for project ${BUILDING_IDS.PROJECT_ID}`);

    if (buildings.length === 0) {
      throw new Error(`No buildings found for project ${BUILDING_IDS.PROJECT_ID}`);
    }

    // 🏢 ENTERPRISE: Update configured project to include its buildings
    const projectDocRef = doc(db, 'projects', BUILDING_IDS.PROJECT_ID.toString());
    
    await updateDoc(projectDocRef, {
      buildings: buildings.map(building => ({
        id: building.id,
        name: building.name,
        description: building.description,
        status: building.status,
        floors: building.buildingFloors || building.floors || [],
        totalArea: building.totalArea,
        units: building.units
      })),
      updatedAt: new Date().toISOString()
    });

    console.log(`✅ Successfully added buildings to project ${BUILDING_IDS.PROJECT_ID}`);

    return NextResponse.json({
      success: true,
      message: 'Buildings added to project successfully',
      projectId: BUILDING_IDS.PROJECT_ID,
      buildings: buildings.map(b => ({ id: b.id, name: b.name })),
      summary: {
        projectName: process.env.NEXT_PUBLIC_PRIMARY_PROJECT_NAME || "Main Project",
        buildingsCount: buildings.length
      }
    });

  } catch (error) {
    console.error('❌ Error adding buildings to project:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to add buildings to project',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}