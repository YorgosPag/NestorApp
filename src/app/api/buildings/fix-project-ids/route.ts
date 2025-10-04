import { NextRequest, NextResponse } from 'next/server';
import { collection, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Fixing building project IDs...');

    // Update buildings to use the correct project ID (1001) for "Παλαιολόγου Πολυκατοικία"
    const updates = [
      {
        buildingId: "building_1_palaiologou",
        newProjectId: 1001
      },
      {
        buildingId: "building_2_palaiologou", 
        newProjectId: 1001
      }
    ];

    const results = [];

    for (const update of updates) {
      console.log(`🔧 Updating building ${update.buildingId} to project ${update.newProjectId}`);
      
      await updateDoc(doc(db, 'buildings', update.buildingId), {
        projectId: update.newProjectId,
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ Successfully updated building ${update.buildingId}`);
      results.push({
        buildingId: update.buildingId,
        newProjectId: update.newProjectId,
        status: 'updated'
      });
    }

    console.log('🎉 All building project IDs have been fixed!');

    return NextResponse.json({
      success: true,
      message: 'Building project IDs fixed successfully',
      results,
      summary: {
        totalUpdates: updates.length,
        projectId: 1001,
        projectName: "Παλαιολόγου Πολυκατοικία"
      }
    });

  } catch (error) {
    console.error('❌ Error fixing building project IDs:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fix building project IDs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}