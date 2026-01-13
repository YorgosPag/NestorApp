// /home/user/studio/src/app/api/communications/webhooks/telegram/stats/repo.ts

import { isFirebaseAvailable } from "../firebase/availability";
import { getFirestoreHelpers } from "../firebase/helpers-lazy";
import { safeDbOperation } from "../firebase/safe-op";
import { COLLECTIONS } from '@/config/firestore-collections';

interface PropertySummary {
    totalProperties: number;
    availableCount: number;
    soldCount: number;
    reservedCount: number;
    averagePrice: number;
}

export async function getPropertySummary(): Promise<PropertySummary> {
  if (!isFirebaseAvailable()) {
    return { totalProperties: 0, availableCount: 0, soldCount: 0, reservedCount: 0, averagePrice: 0 };
  }

  const firestoreHelpers = await getFirestoreHelpers();
  if (!firestoreHelpers) {
    return { totalProperties: 0, availableCount: 0, soldCount: 0, reservedCount: 0, averagePrice: 0 };
  }

  return safeDbOperation(async () => {
    const { collection, getDocs } = firestoreHelpers;

    // Firebase Admin SDK: collection() returns a CollectionReference directly
    const unitsCollection = collection(COLLECTIONS.UNITS);
    const querySnapshot = await getDocs(unitsCollection);

    interface PropertyDoc {
      id: string;
      status?: string;
      price?: number;
      [key: string]: unknown;
    }

    const properties: PropertyDoc[] = [];
    querySnapshot.forEach((doc) => {
      properties.push({ id: doc.id, ...doc.data() } as PropertyDoc);
    });

    const summary = {
      totalProperties: properties.length,
      availableCount: properties.filter(p => p.status === 'available').length,
      soldCount: properties.filter(p => p.status === 'sold').length,
      reservedCount: properties.filter(p => p.status === 'reserved').length,
      averagePrice: 0
    };

    if (properties.length > 0) {
      const prices = properties.map(p => p.price).filter((p): p is number => !!p && p > 0);
      if (prices.length > 0) {
        summary.averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      }
    }

    return summary;
  }, { totalProperties: 0, availableCount: 0, soldCount: 0, reservedCount: 0, averagePrice: 0 });
}
