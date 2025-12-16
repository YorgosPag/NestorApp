/**
 * Debug endpoint: Buildings-Floors Analysis
 * Αναλύει τις σχέσεις μεταξύ κτιρίων και ορόφων για την πλοήγηση
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

export async function GET() {
  try {
    console.log('🏢 BUILDINGS-FLOORS ANALYSIS STARTING...');

    // Step 1: Fetch all buildings
    console.log('📋 Step 1: Fetching buildings...');
    const buildingsSnapshot = await getDocs(collection(db, COLLECTIONS.BUILDINGS));
    const buildings = buildingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`   Found ${buildings.length} buildings`);

    // Step 2: Fetch all floors
    console.log('📋 Step 2: Fetching floors...');
    const floorsSnapshot = await getDocs(collection(db, COLLECTIONS.FLOORS));
    const floors = floorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`   Found ${floors.length} floors`);

    // Step 3: Analyze building-floor relationships
    console.log('📋 Step 3: Analyzing building-floor relationships...');
    const buildingFloorAnalysis = [];

    for (const building of buildings) {
      // Find floors for this building
      const buildingFloors = floors.filter(floor =>
        floor.buildingId === building.id ||
        floor.building === building.name ||
        floor.buildingName === building.name
      );

      buildingFloorAnalysis.push({
        building: {
          id: building.id,
          name: building.name,
          projectId: building.projectId,
          projectName: building.projectName
        },
        floors: buildingFloors.map(floor => ({
          id: floor.id,
          name: floor.name || floor.floorName,
          number: floor.floorNumber || floor.number,
          buildingId: floor.buildingId,
          building: floor.building,
          buildingName: floor.buildingName
        })),
        floorCount: buildingFloors.length,
        hasFloors: buildingFloors.length > 0
      });
    }

    // Step 4: Analyze orphan floors (floors without buildings)
    console.log('📋 Step 4: Finding orphan floors...');
    const orphanFloors = floors.filter(floor => {
      // Check if floor is connected to any building
      const hasBuilding = buildings.some(building =>
        floor.buildingId === building.id ||
        floor.building === building.name ||
        floor.buildingName === building.name
      );
      return !hasBuilding;
    });

    // Step 5: Statistics
    const stats = {
      totalBuildings: buildings.length,
      totalFloors: floors.length,
      buildingsWithFloors: buildingFloorAnalysis.filter(b => b.hasFloors).length,
      buildingsWithoutFloors: buildingFloorAnalysis.filter(b => !b.hasFloors).length,
      orphanFloors: orphanFloors.length,
      connectedFloors: floors.length - orphanFloors.length
    };

    console.log('📊 Analysis Complete:');
    console.log(`   - Total buildings: ${stats.totalBuildings}`);
    console.log(`   - Total floors: ${stats.totalFloors}`);
    console.log(`   - Buildings with floors: ${stats.buildingsWithFloors}`);
    console.log(`   - Buildings without floors: ${stats.buildingsWithoutFloors}`);
    console.log(`   - Orphan floors: ${stats.orphanFloors}`);

    return NextResponse.json({
      success: true,
      analysis: {
        buildings,
        floors,
        buildingFloorAnalysis,
        orphanFloors
      },
      stats,
      summary: `Found ${stats.totalBuildings} buildings and ${stats.totalFloors} floors. ${stats.buildingsWithFloors} buildings have floors, ${stats.orphanFloors} floors are orphaned.`
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ BUILDINGS-FLOORS ANALYSIS FAILED: ${errorMessage}`);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}