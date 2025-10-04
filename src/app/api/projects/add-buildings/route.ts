import { NextRequest, NextResponse } from 'next/server';
import { collection, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    console.log('🏗️ Adding buildings to projects in Firestore...');

    // Get buildings for project 1001 (Παλαιολόγου Πολυκατοικία)
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

    if (buildings.length === 0) {
      throw new Error('No buildings found for project 1001');
    }

    // Update project 1001 to include its buildings
    const projectDocRef = doc(db, 'projects', '1001');
    
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

    console.log('✅ Successfully added buildings to project 1001');

    return NextResponse.json({
      success: true,
      message: 'Buildings added to project successfully',
      projectId: 1001,
      buildings: buildings.map(b => ({ id: b.id, name: b.name })),
      summary: {
        projectName: "Παλαιολόγου Πολυκατοικία",
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