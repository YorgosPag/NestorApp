import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

/**
 * 🏢 ENTERPRISE: API για διόρθωση projectId σε buildings
 *
 * @method POST - Διορθώνει το projectId του κτιρίου
 */

export async function POST(request: NextRequest) {
  try {
    const { buildingId, newProjectId } = await request.json();

    if (!buildingId || !newProjectId) {
      return NextResponse.json(
        { success: false, error: 'Missing buildingId or newProjectId' },
        { status: 400 }
      );
    }

    console.log(`🔧 Updating building ${buildingId} with projectId: ${newProjectId}`);

    const buildingRef = doc(db, COLLECTIONS.BUILDINGS, buildingId);
    await updateDoc(buildingRef, {
      projectId: newProjectId,
      updatedAt: new Date().toISOString(),
    });

    console.log(`✅ Building ${buildingId} updated successfully`);

    return NextResponse.json({
      success: true,
      message: `Building ${buildingId} updated with projectId: ${newProjectId}`,
      buildingId,
      newProjectId,
    });
  } catch (error) {
    console.error('❌ Error updating building:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update building',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
