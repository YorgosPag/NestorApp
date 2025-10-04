// smart-query.ts - Intelligent Query Processing for Real Estate Bot

import { collection, query, where, getDocs, orderBy, limit, QueryConstraint } from 'firebase/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { Property } from '@/types/property';
import { extractSearchCriteria as extractCriteriaFromText, buildPropertyQuery } from '@/services/property-search.service';

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

/**
 * Executes a smart search against the database.
 */
export async function executeSmartSearch(db: Firestore, text: string): Promise<QueryResult> {
  try {
    console.log('🔍 Smart search input:', text);
    const criteria = extractCriteriaFromText(text);
    console.log('📋 Extracted criteria:', criteria);
    
    const results: Property[] = [];
    
    // Primary query execution
    const firestoreQuery = buildPropertyQuery(criteria);
    const q = query(collection(db, 'units'), ...firestoreQuery);
    const querySnapshot = await getDocs(q);
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      results.push({ id: doc.id, ...data } as Property);
    });
    console.log(`✅ Found ${results.length} results`);

    return {
      success: true,
      results,
      count: results.length,
      message: `Βρέθηκαν ${results.length} αποτελέσματα`,
      criteria
    };
  } catch (error) {
    console.error('❌ Smart search error:', error);
    return {
      success: false,
      results: [],
      count: 0,
      message: 'Σφάλμα κατά την αναζήτηση',
      criteria: {}
    };
  }
}

/**
 * Formats search results for display in Telegram.
 */
export function formatSearchResults(queryResult: QueryResult): string {
  if (!queryResult.success || queryResult.count === 0) {
    return `🔍 Δεν βρέθηκαν ακίνητα. Δοκιμάστε μια διαφορετική αναζήτηση.`;
  }

  let responseText = `🏠 <b>Βρήκα ${queryResult.count} ακίνητα:</b>\n\n`;

  queryResult.results.slice(0, 5).forEach((property, index) => {
    const statusEmoji = getStatusEmoji(property.status);
    const priceText = formatPrice(property.price);
    
    responseText += `${index + 1}. ${statusEmoji} <b>${property.code || `Unit-${property.id.slice(-4)}`}</b>\n`;
    if (property.type) responseText += `🏠 Τύπος: ${property.type}\n`;
    if (property.area) responseText += `📐 Εμβαδόν: ${property.area} τ.μ.\n`;
    if (property.price) responseText += `💰 Τιμή: ${priceText}\n`;
    if (property.building) responseText += `🏢 Κτίριο: ${property.building}\n`;
    responseText += `\n`;
  });

  if (queryResult.count > 5) {
    responseText += `📋 <i>Και ${queryResult.count - 5} ακόμα ακίνητα...</i>\n\n`;
  }
  
  responseText += `💬 <b>Στείλτε νέο μήνυμα για να βελτιώσετε την αναζήτηση!</b>`;
  return responseText;
}

function getStatusEmoji(status?: string): string {
  const emojis: Record<string, string> = {
    'available': '✅', 'reserved': '📋', 'sold': '🔒', 'owner': '👤'
  };
  return emojis[status || ''] || '🏠';
}

function formatPrice(price?: number): string {
  if (!price) return 'Κατόπιν συνεννόησης';
  return `€${new Intl.NumberFormat('el-GR').format(price)}`;
}

