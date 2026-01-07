import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

/**
 * 🏢 ENTERPRISE: API για διόρθωση projectId σε units
 *
 * @method POST - Διορθώνει το projectId της μονάδας
 */

export async function POST(request: NextRequest) {
  try {
    const { unitId, newProjectId } = await request.json();

    if (!unitId || !newProjectId) {
      return NextResponse.json(
        { success: false, error: 'Missing unitId or newProjectId' },
        { status: 400 }
      );
    }

    console.log(`🔧 Updating unit ${unitId} with projectId: ${newProjectId}`);

    const unitRef = doc(db, COLLECTIONS.UNITS, unitId);
    await updateDoc(unitRef, {
      projectId: newProjectId,
      updatedAt: new Date().toISOString(),
    });

    console.log(`✅ Unit ${unitId} updated successfully`);

    return NextResponse.json({
      success: true,
      message: `Unit ${unitId} updated with projectId: ${newProjectId}`,
      unitId,
      newProjectId,
    });
  } catch (error) {
    console.error('❌ Error updating unit:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update unit',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
