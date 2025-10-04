import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    console.log('🔗 Connecting units to Παλαιολόγου buildings...');

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

    // Get all units that might belong to this project
    const unitsQuery = query(collection(db, 'units'));
    const unitsSnapshot = await getDocs(unitsQuery);
    const units = unitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`Found ${units.length} total units in database`);

    // Find units that should be connected to Παλαιολόγου buildings
    // We'll look for units with old building IDs or that need to be reassigned
    const unitsToConnect = units.filter(unit => 
      unit.buildingId === 'building-1' || // Old building Alpha ID
      unit.buildingId === 'building-2' || // Old building Beta ID
      !unit.buildingId || 
      unit.buildingId === '' ||
      (unit.name && unit.name.toLowerCase().includes('παλαιολόγου')) ||
      (unit.unitName && unit.unitName.toLowerCase().includes('παλαιολόγου'))
    );

    console.log(`Found ${unitsToConnect.length} units to potentially connect`);

    // Connect units to buildings based on their current buildingId
    const buildingA = buildings.find(b => b.name.includes('ΚΤΙΡΙΟ Α'));
    const buildingB = buildings.find(b => b.name.includes('ΚΤΙΡΙΟ Β'));

    const results = [];
    
    for (const unit of unitsToConnect) {
      // Map old building IDs to new Παλαιολόγου building IDs
      let targetBuilding;
      if (unit.buildingId === 'building-1') {
        targetBuilding = buildingA; // building-1 -> ΚΤΙΡΙΟ Α
      } else if (unit.buildingId === 'building-2') {
        targetBuilding = buildingB; // building-2 -> ΚΤΙΡΙΟ Β  
      } else {
        // For units without buildingId, alternate between buildings
        targetBuilding = results.length % 2 === 0 ? buildingA : buildingB;
      }
      
      if (targetBuilding) {
        console.log(`Connecting unit ${unit.id} to building ${targetBuilding.id}`);
        
        await updateDoc(doc(db, 'units', unit.id), {
          buildingId: targetBuilding.id,
          projectId: 1001,
          updatedAt: new Date().toISOString()
        });

        results.push({
          unitId: unit.id,
          unitName: unit.name || unit.unitName,
          buildingId: targetBuilding.id,
          buildingName: targetBuilding.name,
          status: 'connected'
        });
      }
    }

    console.log('🎉 Unit connections completed!');

    return NextResponse.json({
      success: true,
      message: 'Units connected to buildings successfully',
      results,
      summary: {
        totalUnitsConnected: results.length,
        buildings: buildings.map(b => ({ id: b.id, name: b.name }))
      }
    });

  } catch (error) {
    console.error('❌ Error connecting units to buildings:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to connect units to buildings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}