
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { BuildingStats } from '@/types/building';

const UNITS_COLLECTION = 'units';

export async function getBuildingStats(buildingId: string): Promise<BuildingStats> {
  try {
    const unitsQuery = query(
      collection(db, UNITS_COLLECTION),
      where('buildingId', '==', buildingId)
    );

    const unitsSnapshot = await getDocs(unitsQuery);

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
    console.error(`❌ Error fetching stats for building ${buildingId}:`, error);
    throw new Error(`Failed to calculate building statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
