
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { BuildingStats } from '@/types/building';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BuildingsService');

const UNITS_COLLECTION = COLLECTIONS.UNITS;

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
    logger.error(`Error fetching stats for building ${buildingId}`, { error });
    throw new Error(`Failed to calculate building statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
