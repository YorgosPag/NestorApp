/**
 * 🔍 TELEGRAM BOT SMART QUERY PROCESSING
 *
 * Intelligent query processing for real estate bot.
 * Uses centralized templates and catalogs.
 *
 * @enterprise PR1 - Zero hardcoded strings centralization
 * @created 2026-01-13
 */

import type { Property } from '@/types/property';
import { extractSearchCriteria as extractCriteriaFromText } from '@/services/property-search.service';
import { COLLECTIONS } from '@/config/firestore-collections';
import { isFirebaseAvailable } from './firebase/availability';
import { getFirestoreHelpers } from './firebase/helpers-lazy';
import {
  getTemplateResolver,
  formatCurrency,
  type TelegramLocale
} from './templates/template-resolver';
import { getPropertyTypeLabel, getPropertyTypeEmoji } from './search/format';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Search Criteria Interface
 */
export interface SearchCriteria {
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  rooms?: number;
  floor?: number;
  status?: string;
  building?: string;
  project?: string;
  location?: string;
  features?: string[];
}

/**
 * Query Result Interface
 */
export interface QueryResult {
  success: boolean;
  results: Property[];
  count: number;
  message: string;
  criteria: SearchCriteria;
}

// ============================================================================
// QUERY EXECUTION
// ============================================================================

/**
 * Executes a smart search against the database.
 * Uses Firebase Admin SDK via helpers-lazy.
 */
export async function executeSmartSearch(
  text: string,
  locale: TelegramLocale = 'el'
): Promise<QueryResult> {
  const t = getTemplateResolver(locale);

  // 🏢 ENTERPRISE: Check Firebase availability
  if (!isFirebaseAvailable()) {
    return {
      success: false,
      results: [],
      count: 0,
      message: t.getText('errors.database'),
      criteria: {}
    };
  }

  const firestoreHelpers = await getFirestoreHelpers();
  if (!firestoreHelpers) {
    return {
      success: false,
      results: [],
      count: 0,
      message: t.getText('errors.database'),
      criteria: {}
    };
  }

  try {
    console.log('🔍 Smart search input:', text);
    const criteria = extractCriteriaFromText(text);
    console.log('📋 Extracted criteria:', criteria);

    const results: Property[] = [];
    const { collection, getDocs } = firestoreHelpers;

    // 🏢 ENTERPRISE: Use Firebase Admin SDK pattern
    let q = collection(COLLECTIONS.UNITS)
      .where('status', '==', 'available');

    if (criteria.type) {
      q = q.where('type', '==', criteria.type);
    }

    q = q.orderBy('price').limit(10);

    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      results.push({ id: doc.id, ...data } as Property);
    });
    console.log(`✅ Found ${results.length} results`);

    const countText = results.length === 1
      ? t.getText('search.results.foundOne')
      : t.getText('search.results.found', { count: results.length });

    return {
      success: true,
      results,
      count: results.length,
      message: countText,
      criteria: criteria as SearchCriteria
    };
  } catch (error) {
    console.error('❌ Smart search error:', error);
    return {
      success: false,
      results: [],
      count: 0,
      message: t.getText('errors.generic'),
      criteria: {}
    };
  }
}

// ============================================================================
// RESULT FORMATTING
// ============================================================================

/**
 * Formats search results for display in Telegram.
 */
export function formatSearchResults(
  queryResult: QueryResult,
  locale: TelegramLocale = 'el'
): string {
  const t = getTemplateResolver(locale);

  if (!queryResult.success || queryResult.count === 0) {
    return `🔍 ${t.getText('search.noResults.title')}

💡 ${t.getText('search.noResults.suggestion')}`;
  }

  const countText = queryResult.count === 1
    ? t.getText('search.results.foundOne')
    : t.getText('search.results.found', { count: queryResult.count });

  let responseText = `🏠 <b>${countText}</b>\n\n`;

  queryResult.results.slice(0, 5).forEach((property, index) => {
    const statusEmoji = getStatusEmoji(property.status);
    const typeLabel = getPropertyTypeLabel(property.type, locale);

    responseText += `${index + 1}. ${statusEmoji} <b>${property.code || `Unit-${property.id.slice(-4)}`}</b>\n`;

    if (property.type) {
      responseText += `🏠 ${t.getText('property.type')}: ${typeLabel}\n`;
    }
    if (property.area) {
      responseText += `📐 ${t.getText('property.area')}: ${property.area} ${t.getText('formatting.areaUnit')}\n`;
    }
    if (property.price) {
      responseText += `💰 ${t.getText('property.price')}: ${formatCurrency(property.price, locale)}\n`;
    }
    if (property.building) {
      responseText += `🏢 ${property.building}\n`;
    }
    responseText += `\n`;
  });

  if (queryResult.count > 5) {
    responseText += `📋 <i>${t.getText('search.results.showing', { shown: 5, total: queryResult.count })}</i>\n\n`;
  }

  responseText += `💬 <b>${t.getText('contact.callToAction')}</b>`;
  return responseText;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getStatusEmoji(status?: string): string {
  const emojis: Record<string, string> = {
    'available': '✅',
    'reserved': '📋',
    'sold': '🔒',
    'owner': '👤',
    'for-sale': '✅',
    'for-rent': '🔵'
  };
  return emojis[status || ''] || '🏠';
}
