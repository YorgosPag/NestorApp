/**
 * 🔍 TELEGRAM BOT SEARCH CRITERIA EXTRACTION
 *
 * Extracts search criteria from user messages.
 * Uses centralized type catalog (zero hardcoded mappings).
 *
 * @enterprise PR1 - Zero hardcoded strings centralization
 * @created 2026-01-13
 */

import type { SearchCriteria, TelegramProperty } from '../shared/types';
import { getCanonicalType } from '../catalogs/type-catalog';

// ============================================================================
// CRITERIA EXTRACTION
// ============================================================================

/**
 * Extract search criteria from user text
 * Maps synonyms to canonical property types via catalog
 */
export function extractSearchCriteria(text: string): SearchCriteria {
  const criteria: SearchCriteria = {};
  const lowerText = text.toLowerCase();

  // Extract max price
  const pricePatterns = [
    /κάτω\s+από\s+([\d.,]+)/,     // "κάτω από 100000"
    /μέχρι\s+([\d.,]+)/,          // "μέχρι 100000"
    /under\s+([\d.,]+)/,          // "under 100000"
    /max\s+([\d.,]+)/,            // "max 100000"
    /budget\s+([\d.,]+)/,         // "budget 100000"
    /([\d.,]+)\s*(?:€|ευρώ|euro)/ // "100000€" or "100000 ευρώ"
  ];

  for (const pattern of pricePatterns) {
    const priceMatch = lowerText.match(pattern);
    if (priceMatch) {
      criteria.maxPrice = parseFloat(priceMatch[1].replace(/[.,]/g, ''));
      // Handle thousands shorthand
      if (lowerText.includes('χιλιάδες') || lowerText.includes('k')) {
        criteria.maxPrice *= 1000;
      }
      break;
    }
  }

  // Extract rooms
  const roomsPatterns = [
    /(\d+)\s*(?:δωμάτια|δωματίων|δωμ)/,  // "2 δωμάτια"
    /(\d+)\s*(?:rooms|bedroom|br)/,       // "2 rooms"
    /(\d+)δ(?:\s|$)/                      // "2Δ"
  ];

  for (const pattern of roomsPatterns) {
    const roomsMatch = lowerText.match(pattern);
    if (roomsMatch) {
      criteria.rooms = parseInt(roomsMatch[1]);
      break;
    }
  }

  // Extract area
  const areaPatterns = [
    /(\d+)\s*(?:τ\.?μ\.?|τετραγωνικά|sqm|m2)/,  // "65 τ.μ."
    /(\d+)\s*(?:square\s*m)/                     // "65 square m"
  ];

  for (const pattern of areaPatterns) {
    const areaMatch = lowerText.match(pattern);
    if (areaMatch) {
      criteria.area = parseInt(areaMatch[1]);
      break;
    }
  }

  // Extract property type using catalog (no hardcoded mapping)
  const detectedType = getCanonicalType(lowerText);
  if (detectedType) {
    criteria.type = detectedType;
  }

  return criteria;
}

/**
 * Apply advanced filters to properties
 */
export function applyAdvancedFilters(
  properties: TelegramProperty[],
  criteria: SearchCriteria
): TelegramProperty[] {
  return properties.filter(property => {
    // Filter by max price
    if (criteria.maxPrice && property.price && property.price > criteria.maxPrice) {
      return false;
    }

    // Filter by rooms
    if (criteria.rooms && property.rooms && property.rooms !== criteria.rooms) {
      return false;
    }

    // Filter by area (with 10% tolerance)
    if (criteria.area && property.area) {
      const tolerance = criteria.area * 0.1;
      if (property.area < criteria.area - tolerance || property.area > criteria.area + tolerance) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Format criteria for display
 */
export function formatCriteriaDisplay(criteria: SearchCriteria): string {
  const parts: string[] = [];

  if (criteria.type) {
    parts.push(`Τύπος: ${criteria.type}`);
  }
  if (criteria.maxPrice) {
    parts.push(`Μέχρι: €${criteria.maxPrice.toLocaleString('el-GR')}`);
  }
  if (criteria.rooms) {
    parts.push(`Δωμάτια: ${criteria.rooms}`);
  }
  if (criteria.area) {
    parts.push(`Εμβαδόν: ~${criteria.area} τ.μ.`);
  }

  return parts.join(', ') || 'Γενική αναζήτηση';
}
