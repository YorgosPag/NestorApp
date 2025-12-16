import { NextRequest, NextResponse } from 'next/server';
import { collection, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BUILDING_IDS } from '@/config/building-ids-config';
import { COLLECTIONS } from '@/config/firestore-collections';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Fixing building project IDs...');

    // 🏢 ENTERPRISE: Update buildings to use configured project ID
    const updates = [
      {
        buildingId: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_1_ID || "building_1_default",
        newProjectId: BUILDING_IDS.PROJECT_ID
      },
      {
        buildingId: process.env.NEXT_PUBLIC_SAMPLE_BUILDING_2_ID || "building_2_default",
        newProjectId: BUILDING_IDS.PROJECT_ID
      }
    ];

    const results = [];

    for (const update of updates) {
      console.log(`🔧 Updating building ${update.buildingId} to project ${update.newProjectId}`);
      
      await updateDoc(doc(db, COLLECTIONS.BUILDINGS, update.buildingId), {
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
        projectId: BUILDING_IDS.PROJECT_ID,
        projectName: process.env.NEXT_PUBLIC_PRIMARY_PROJECT_NAME || "Main Project"
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