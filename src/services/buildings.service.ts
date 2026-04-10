
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { BuildingStats } from '@/types/building';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('BuildingsService');

const UNITS_COLLECTION = COLLECTIONS.PROPERTIES;

export async function getBuildingStats(
  buildingId: string,
  companyId: string
): Promise<BuildingStats> {
  try {
    const unitsQuery = query(
      collection(db, UNITS_COLLECTION),
      where('companyId', '==', companyId),
      where('buildingId', '==', buildingId)
    );

    const unitsSnapshot = await getDocs(unitsQuery);

    let totalProperties = 0;
    let soldProperties = 0;
    let totalSoldArea = 0;

    unitsSnapshot.forEach(doc => {
      const unit = doc.data();
      totalProperties++;
      if (unit.status === 'sold') {
        soldProperties++;
        totalSoldArea += unit.area || 0;
      }
    });

    return { totalProperties, soldProperties, totalSoldArea };
  } catch (error) {
    logger.error(`Error fetching stats for building ${buildingId}`, { error });
    throw new Error(`Failed to calculate building statistics: ${getErrorMessage(error)}`);
  }
}
