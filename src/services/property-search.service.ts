import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  QueryConstraint,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore';
import type { Property } from '@/types/property';
import { COLLECTIONS } from '@/config/firestore-collections';

const db = getAdminFirestore();

// =============================================================================
// 🏢 ENTERPRISE: Multi-collection search types (local_4.log architecture)
// Units / Storage / Parking = παράλληλες οντότητες
// Search διασχίζει domains με ξεχωριστό labeling
// =============================================================================

export interface StorageUnit {
  id: string;
  name: string;
  type?: 'basement' | 'ground' | 'external';
  area?: number;
  status?: string;
  buildingId?: string;
  floor?: number;
}

export interface ParkingSpace {
  id: string;
  number: string;
  type?: string;
  status?: string;
  buildingId?: string;
  location?: string;
}

export interface UnifiedSearchResult {
  success: boolean;
  units: Property[];
  storageUnits: StorageUnit[];
  parkingSpaces: ParkingSpace[];
  totalCount: number;
  message: string;
}

/**
 * Enhanced Property Search Service for Telegram Bot
 * Provides smart property search with natural language processing
 */

export interface PropertySearchCriteria {
  // Basic filters
  type?: 'apartment' | 'maisonette' | 'store';
  status?: 'sold' | 'available' | 'reserved' | 'owner';
  building?: string;
  
  // Numeric filters
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  rooms?: number;
  bathrooms?: number;
  floor?: number | string;
  
  // Location and project
  location?: string;
  project?: string;
  buildingId?: string;
  
  // Advanced filters
  orientation?: 'north' | 'south' | 'east' | 'west';
  features?: string[];
  hasParking?: boolean;
  hasStorage?: boolean;
  
  // Search preferences
  limit?: number;
  sortBy?: 'price' | 'area' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PropertySearchResult {
  success: boolean;
  properties: Property[];
  totalCount: number;
  criteria: PropertySearchCriteria;
  message: string;
  hasMore?: boolean;
  nextCursor?: string;
}

export interface PropertySummary {
  totalProperties: number;
  availableCount: number;
  soldCount: number;
  reservedCount: number;
  averagePrice: number;
  priceRange: { min: number; max: number };
  areaRange: { min: number; max: number };
  buildingCounts: Record<string, number>;
  typeCounts: Record<string, number>;
}

/**
 * Extracts search criteria from natural language text.
 */
export function extractSearchCriteria(searchText: string): PropertySearchCriteria {
  const criteria: PropertySearchCriteria = {};
  const text = searchText.toLowerCase().trim();

  // Price extraction
  const pricePatterns = [
    { pattern: /κάτω\s+από\s+([\d.,]+)(?:\s*(?:ευρώ|€|χιλιάδες|k))?/g, type: 'max' },
    { pattern: /πάνω\s+από\s+([\d.,]+)(?:\s*(?:ευρώ|€|χιλιάδες|k))?/g, type: 'min' },
    { pattern: /μέχρι\s+([\d.,]+)(?:\s*(?:ευρώ|€|χιλιάδες|k))?/g, type: 'max' },
    { pattern: /έως\s+([\d.,]+)(?:\s*(?:ευρώ|€|χιλιάδες|k))?/g, type: 'max' },
    { pattern: /([\d.,]+)(?:\s*(?:ευρώ|€|χιλιάδες|k))/g, type: 'max' }
  ];

  for (const { pattern, type } of pricePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let price = parseFloat(match[1].replace(/[.,]/g, ''));
      if (text.includes('χιλιάδες') || text.includes('k')) {
        price *= 1000;
      }
      if (type === 'max') criteria.maxPrice = price; else criteria.minPrice = price;
      break;
    }
    if (criteria.minPrice || criteria.maxPrice) break;
  }

  // Area extraction
  const areaMatch = text.match(/(\d+)\s*(?:τ\.?μ|τετραγωνικά|μέτρα)/);
  if (areaMatch) {
      criteria.minArea = parseInt(areaMatch[1], 10);
  }

  // Rooms extraction
  const roomsMatch = text.match(/(\d+)\s*(?:δωμάτια|δωματίων|υπνοδωμάτια|rooms)/);
  if (roomsMatch) {
    criteria.rooms = parseInt(roomsMatch[1]);
  }

  // Property type extraction
  if (text.includes('μεζονέτα')) criteria.type = 'maisonette';
  else if (text.includes('διαμέρισμα')) criteria.type = 'apartment';
  else if (text.includes('κατάστημα')) criteria.type = 'store';

  // Status extraction
  if (text.includes('διαθέσιμ')) criteria.status = 'available';
  else if (text.includes('πωλημένα')) criteria.status = 'sold';
  else if (text.includes('κρατημένα')) criteria.status = 'reserved';

  // Features extraction
  if (text.includes('parking') || text.includes('πάρκινγκ')) criteria.hasParking = true;
  if (text.includes('αποθήκη')) criteria.hasStorage = true;
  
  return criteria;
}

/**
 * Builds a Firestore query from search criteria.
 */
export function buildPropertyQuery(criteria: PropertySearchCriteria): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  // Default to 'available' if no status is specified
  constraints.push(where('status', '==', criteria.status || 'available'));

  if (criteria.type) constraints.push(where('type', '==', criteria.type));
  if (criteria.building) constraints.push(where('building', '==', criteria.building));
  if (criteria.minPrice) constraints.push(where('price', '>=', criteria.minPrice));
  if (criteria.maxPrice) constraints.push(where('price', '<=', criteria.maxPrice));
  if (criteria.minArea) constraints.push(where('area', '>=', criteria.minArea));
  if (criteria.maxArea) constraints.push(where('area', '<=', criteria.maxArea));
  if (criteria.rooms) constraints.push(where('rooms', '==', criteria.rooms));
  if (criteria.floor) constraints.push(where('floorNumber', '==', criteria.floor));
  
  constraints.push(orderBy(criteria.sortBy || 'price', criteria.sortOrder || 'asc'));
  constraints.push(limit(criteria.limit || 10));

  return constraints;
}

/**
 * Main property search function.
 */
export async function searchProperties(searchInput: string | PropertySearchCriteria): Promise<PropertySearchResult> {
  'use server';
  try {
    const criteria = typeof searchInput === 'string' ? extractSearchCriteria(searchInput) : searchInput;
    const constraints = buildPropertyQuery(criteria);
    const q = query(collection(db, COLLECTIONS.UNITS), ...constraints);
    const snapshot = await getDocs(q);
    const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));

    return {
      success: true,
      properties,
      totalCount: properties.length,
      criteria,
      message: `Βρέθηκαν ${properties.length} ακίνητα.`
    };
  } catch (error) {
    // Error logging removed //('❌ Property search error:', error);
    return {
      success: false, properties: [], totalCount: 0, criteria: {}, message: 'Σφάλμα αναζήτησης.'
    };
  }
}

/**
 * Gets a summary of property statistics.
 */
export async function getPropertySummary(criteria?: Partial<PropertySearchCriteria>): Promise<PropertySummary> {
  'use server';
  try {
    const q = query(collection(db, COLLECTIONS.UNITS));
    const snapshot = await getDocs(q);
    const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));

    const summary: PropertySummary = {
      totalProperties: properties.length,
      availableCount: properties.filter(p => p.status === 'available').length,
      soldCount: properties.filter(p => p.status === 'sold').length,
      reservedCount: properties.filter(p => p.status === 'reserved').length,
      averagePrice: 0, priceRange: { min: 0, max: 0 }, areaRange: { min: 0, max: 0 },
      buildingCounts: {}, typeCounts: {}
    };

    if (properties.length > 0) {
      const prices = properties.map(p => p.price).filter((p): p is number => !!p && p > 0);
      summary.averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    }
    return summary;
  } catch (error) {
    // Error logging removed //('Error getting property summary:', error);
    throw error;
  }
}

// =============================================================================
// 🏢 ENTERPRISE: Unified Multi-Collection Search (local_4.log architecture)
// =============================================================================
// Search διασχίζει domains με ξεχωριστό labeling
// Units / Storage / Parking = παράλληλες οντότητες
// =============================================================================

/**
 * 🏢 ENTERPRISE: Detect which collections to search based on keywords
 */
function detectSearchCollections(searchText: string): {
  searchUnits: boolean;
  searchStorage: boolean;
  searchParking: boolean;
} {
  const text = searchText.toLowerCase();

  // Storage keywords
  const storageKeywords = ['αποθήκη', 'αποθηκη', 'storage', 'υπόγειο', 'υπογειο'];
  const searchStorage = storageKeywords.some(kw => text.includes(kw));

  // Parking keywords
  const parkingKeywords = ['πάρκινγκ', 'παρκινγκ', 'parking', 'θέση', 'θεση', 'στάθμευση', 'σταθμευση'];
  const searchParking = parkingKeywords.some(kw => text.includes(kw));

  // Unit keywords (default if no specific keywords or explicit unit search)
  const unitKeywords = ['διαμέρισμα', 'διαμερισμα', 'μεζονέτα', 'μεζονετα', 'κατάστημα', 'καταστημα', 'μονάδα', 'μοναδα', 'unit'];
  const searchUnits = unitKeywords.some(kw => text.includes(kw)) || (!searchStorage && !searchParking);

  return { searchUnits, searchStorage, searchParking };
}

/**
 * 🏢 ENTERPRISE: Unified search across Units, Storage, and Parking collections
 * Implements local_4.log architecture: parallel categories with separate labeling
 */
export async function unifiedPropertySearch(searchText: string): Promise<UnifiedSearchResult> {
  'use server';
  try {
    const { searchUnits, searchStorage, searchParking } = detectSearchCollections(searchText);
    const searchTerm = searchText.toLowerCase().trim();

    const results: UnifiedSearchResult = {
      success: true,
      units: [],
      storageUnits: [],
      parkingSpaces: [],
      totalCount: 0,
      message: ''
    };

    // 🏠 Search Units collection
    if (searchUnits) {
      const unitsQuery = query(collection(db, COLLECTIONS.UNITS), limit(20));
      const unitsSnapshot = await getDocs(unitsQuery);
      results.units = unitsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Property))
        .filter(unit => {
          const name = (unit.code || '').toLowerCase();
          const type = (unit.type || '').toLowerCase();
          return name.includes(searchTerm) || type.includes(searchTerm) || searchTerm.length < 3;
        });
    }

    // 📦 Search Storage collection
    if (searchStorage) {
      const storageQuery = query(collection(db, COLLECTIONS.STORAGE), limit(20));
      const storageSnapshot = await getDocs(storageQuery);
      results.storageUnits = storageSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as StorageUnit))
        .filter(storage => {
          const name = (storage.name || '').toLowerCase();
          return name.includes(searchTerm) || searchTerm.length < 3;
        });
    }

    // 🚗 Search Parking collection
    if (searchParking) {
      const parkingQuery = query(collection(db, COLLECTIONS.PARKING_SPACES), limit(20));
      const parkingSnapshot = await getDocs(parkingQuery);
      results.parkingSpaces = parkingSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as ParkingSpace))
        .filter(parking => {
          const number = (parking.number || '').toLowerCase();
          const location = (parking.location || '').toLowerCase();
          return number.includes(searchTerm) || location.includes(searchTerm) || searchTerm.length < 3;
        });
    }

    // Calculate totals and build message
    results.totalCount = results.units.length + results.storageUnits.length + results.parkingSpaces.length;

    // 🏢 ENTERPRISE: Build grouped message per local_4.log
    const messageParts: string[] = [];
    if (results.units.length > 0) {
      messageParts.push(`🏠 Μονάδες (${results.units.length})`);
    }
    if (results.storageUnits.length > 0) {
      messageParts.push(`📦 Αποθήκες (${results.storageUnits.length})`);
    }
    if (results.parkingSpaces.length > 0) {
      messageParts.push(`🚗 Θέσεις Στάθμευσης (${results.parkingSpaces.length})`);
    }

    results.message = results.totalCount > 0
      ? `Βρέθηκαν:\n${messageParts.join('\n')}`
      : 'Δεν βρέθηκαν αποτελέσματα.';

    return results;
  } catch (error) {
    return {
      success: false,
      units: [],
      storageUnits: [],
      parkingSpaces: [],
      totalCount: 0,
      message: 'Σφάλμα αναζήτησης.'
    };
  }
}
