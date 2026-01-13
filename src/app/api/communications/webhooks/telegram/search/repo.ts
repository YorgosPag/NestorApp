// /home/user/studio/src/app/api/communications/webhooks/telegram/search/repo.ts

import { isFirebaseAvailable } from '../firebase/availability';
import { getFirestoreHelpers } from '../firebase/helpers-lazy';
import { safeDbOperation } from '../firebase/safe-op';
import { extractSearchCriteria, applyAdvancedFilters } from './criteria';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { SearchResult, TelegramProperty } from '../shared/types';
import type { Query, DocumentData, QuerySnapshot } from 'firebase/firestore';

export async function searchProperties(searchText: string): Promise<SearchResult> {
  if (!isFirebaseAvailable()) {
    return {
      success: false,
      properties: [],
      totalCount: 0,
      criteria: {},
      message: 'Database not available'
    };
  }

  const firestoreHelpers = await getFirestoreHelpers();
  if (!firestoreHelpers) {
    return {
      success: false,
      properties: [],
      totalCount: 0,
      criteria: {},
      message: 'Database helpers not available'
    };
  }

  return safeDbOperation(async (database) => {
    const { collection, query, where, orderBy, firestoreLimit, getDocs } = firestoreHelpers;

    const criteria = extractSearchCriteria(searchText);
    console.log('📋 Extracted criteria:', criteria);

    let properties: TelegramProperty[] = [];

    try {
      let q: Query<DocumentData> = collection(database, COLLECTIONS.UNITS);
      q = query(q, where('status', '==', 'available'));
      if (criteria.type) {
        q = query(q, where('type', '==', criteria.type));
      }
      q = query(q, orderBy('price'), firestoreLimit(10));

      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach((doc) => {
        properties.push({ id: doc.id, ...doc.data() });
      });

      console.log(`✅ Firebase query returned ${properties.length} properties`);

      properties = applyAdvancedFilters(properties, criteria);

      return {
        success: true,
        properties,
        totalCount: properties.length,
        criteria,
        message: `Βρέθηκαν ${properties.length} ακίνητα`
      };

    } catch (error) {
      console.error('❌ Property search error:', error);
      return {
        success: false, properties: [], totalCount: 0, criteria: {}, message: 'Σφάλμα κατά την αναζήτηση'
      };
    }
  }, {
    success: false, properties: [], totalCount: 0, criteria: {}, message: 'Database operation failed'
  });
}
