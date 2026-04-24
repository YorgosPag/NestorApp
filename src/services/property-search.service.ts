import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { Property } from '@/types/property';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';

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


