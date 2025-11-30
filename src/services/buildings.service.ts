
'use server';

import { db } from '@/lib/firebase-admin';
import type { BuildingStats } from '@/types/building';

const UNITS_COLLECTION = 'units';

export async function getBuildingStats(buildingId: string): Promise<BuildingStats> {
  try {
    const unitsSnapshot = await db.collection(UNITS_COLLECTION)
      .where('buildingId', '==', buildingId)
      .get();

    let totalUnits = 0;
    let soldUnits = 0;
    let totalSoldArea = 0;

    unitsSnapshot.forEach(doc => {
      const unit = doc.data();
      totalUnits++;
      if (unit.status === 'sold') {
        soldUnits++;
        totalSoldArea += unit.area || 0;
      }
    });

    return { totalUnits, soldUnits, totalSoldArea };
  } catch (error) {
    // Error logging removed //(`Error fetching stats for building ${buildingId}:`, error);
    throw new Error('Failed to calculate building statistics');
  }
}
