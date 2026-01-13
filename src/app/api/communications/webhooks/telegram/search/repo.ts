/**
 * 🔍 TELEGRAM BOT SEARCH REPOSITORY
 *
 * Handles property search operations for Telegram bot.
 * Uses centralized templates for all user-facing strings.
 *
 * @enterprise PR1 - Zero hardcoded strings centralization
 * @created 2026-01-13
 */

import { isFirebaseAvailable } from '../firebase/availability';
import { getFirestoreHelpers } from '../firebase/helpers-lazy';
import { safeDbOperation } from '../firebase/safe-op';
import { extractSearchCriteria, applyAdvancedFilters } from './criteria';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { SearchResult, TelegramProperty } from '../shared/types';
import {
  getTemplateResolver,
  type TelegramLocale
} from '../templates/template-resolver';

export async function searchProperties(
  searchText: string,
  locale: TelegramLocale = 'el'
): Promise<SearchResult> {
  const t = getTemplateResolver(locale);

  if (!isFirebaseAvailable()) {
    return {
      success: false,
      properties: [],
      totalCount: 0,
      criteria: {},
      message: t.getText('errors.database')
    };
  }

  const firestoreHelpers = await getFirestoreHelpers();
  if (!firestoreHelpers) {
    return {
      success: false,
      properties: [],
      totalCount: 0,
      criteria: {},
      message: t.getText('errors.database')
    };
  }

  return safeDbOperation(async () => {
    const { collection, getDocs } = firestoreHelpers;

    const criteria = extractSearchCriteria(searchText);
    console.log('📋 Extracted criteria:', criteria);

    let properties: TelegramProperty[] = [];

    try {
      // Firebase Admin SDK: use collection(path) then chain .where().orderBy().limit()
      let q = collection(COLLECTIONS.UNITS)
        .where('status', '==', 'available');

      if (criteria.type) {
        q = q.where('type', '==', criteria.type);
      }

      q = q.orderBy('price').limit(10);

      const querySnapshot = await getDocs(q);

      querySnapshot.forEach((doc) => {
        properties.push({ id: doc.id, ...doc.data() });
      });

      console.log(`✅ Firebase query returned ${properties.length} properties`);

      properties = applyAdvancedFilters(properties, criteria);

      const message = properties.length === 1
        ? t.getText('search.results.foundOne')
        : t.getText('search.results.found', { count: properties.length });

      return {
        success: true,
        properties,
        totalCount: properties.length,
        criteria,
        message
      };

    } catch (error) {
      console.error('❌ Property search error:', error);
      return {
        success: false,
        properties: [],
        totalCount: 0,
        criteria: {},
        message: t.getText('errors.searchError')
      };
    }
  }, {
    success: false,
    properties: [],
    totalCount: 0,
    criteria: {},
    message: t.getText('errors.generic')
  });
}
