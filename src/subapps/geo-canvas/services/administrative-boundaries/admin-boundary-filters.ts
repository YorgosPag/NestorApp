/**
 * ADMINISTRATIVE BOUNDARY — FILTERS & SCORING
 * Standalone functions for advanced filtering, fuzzy scoring,
 * relevance sorting, cache TTL, and simplification stats.
 * Extracted from AdministrativeBoundaryService.ts (ADR-065).
 */

import { GreekAdminLevel } from '../../types/administrative-types';
import type {
  AdminSearchResult,
  AdvancedSearchFilters,
  BoundingBox,
} from '../../types/administrative-types';

import { calculateLevenshteinDistance } from './admin-boundary-utils';

// ============================================================================
// ADVANCED FILTERS
// ============================================================================

export function applyAdvancedFilters(
  results: AdminSearchResult[],
  filters: AdvancedSearchFilters
): AdminSearchResult[] {
  let filteredResults = [...results];

  // Filter by specific regions
  if (filters.regions && filters.regions.length > 0) {
    filteredResults = filteredResults.filter((result) =>
      filters.regions!.some((region) =>
        result.hierarchy.region?.toLowerCase().includes(region.toLowerCase())
      )
    );
  }

  // Filter by postal code ranges
  if (filters.postalCodes && filters.postalCodes.length > 0) {
    filteredResults = filteredResults.filter((result) => {
      if (result.adminLevel !== GreekAdminLevel.POSTAL_CODE) return true;
      return filters.postalCodes!.some(
        (pattern) => result.name.includes(pattern) || result.id.includes(pattern)
      );
    });
  }

  // Population/area/historical filters — pass-through (require external data)
  if (!filters.includeHistorical) {
    // Historical boundary filtering would require metadata markers
  }

  return filteredResults;
}

// ============================================================================
// SPATIAL FILTERING
// ============================================================================

export async function filterByBoundingBox(
  results: AdminSearchResult[],
  bbox: BoundingBox
): Promise<AdminSearchResult[]> {
  return results.filter((result) => {
    if (!result.bounds) return true;
    return !(
      result.bounds.east < bbox.west ||
      result.bounds.west > bbox.east ||
      result.bounds.north < bbox.south ||
      result.bounds.south > bbox.north
    );
  });
}

// ============================================================================
// FUZZY MATCHING & SCORING
// ============================================================================

export function applyFuzzyMatching(
  results: AdminSearchResult[],
  query: string
): AdminSearchResult[] {
  const queryLower = query.toLowerCase();

  return results
    .map((result) => {
      const nameLower = result.name.toLowerCase();
      let fuzzyScore = result.confidence;

      if (nameLower === queryLower) {
        fuzzyScore = Math.min(fuzzyScore * 1.5, 1.0);
      } else if (nameLower.startsWith(queryLower)) {
        fuzzyScore = Math.min(fuzzyScore * 1.3, 1.0);
      } else if (nameLower.includes(` ${queryLower}`)) {
        fuzzyScore = Math.min(fuzzyScore * 1.2, 1.0);
      } else {
        const distance = calculateLevenshteinDistance(nameLower, queryLower);
        const similarity = 1 - distance / Math.max(nameLower.length, queryLower.length);
        fuzzyScore = similarity > 0.6 ? Math.min(fuzzyScore * similarity, 1.0) : 0;
      }

      return { ...result, confidence: fuzzyScore };
    })
    .filter((result) => result.confidence > 0);
}

// ============================================================================
// RELEVANCE SORTING
// ============================================================================

export function sortByRelevance(
  results: AdminSearchResult[],
  query: string,
  filters: AdvancedSearchFilters
): AdminSearchResult[] {
  return results.sort((a, b) => {
    if (Math.abs(a.confidence - b.confidence) > 0.1) {
      return b.confidence - a.confidence;
    }

    const adminLevelPriority = {
      [GreekAdminLevel.POSTAL_CODE]: 4,
      [GreekAdminLevel.COMMUNITY]: 3,
      [GreekAdminLevel.MUNICIPAL_UNIT]: 2,
      [GreekAdminLevel.MUNICIPALITY]: 1,
      [GreekAdminLevel.REGION]: 0,
    } as Record<GreekAdminLevel, number>;

    const aPriority = adminLevelPriority[a.adminLevel] || 0;
    const bPriority = adminLevelPriority[b.adminLevel] || 0;

    if (aPriority !== bPriority) return bPriority - aPriority;

    return a.name.length - b.name.length;
  });
}

// ============================================================================
// CACHE OPTIMIZATION
// ============================================================================

export function calculateOptimalTTL(
  resultCount: number,
  searchType: 'municipality' | 'region' | 'general' | null
): number {
  let baseTTL = 30 * 60 * 1000; // 30 minutes

  if (resultCount === 0) {
    baseTTL = 10 * 60 * 1000; // 10 minutes
  } else if (resultCount === 1) {
    baseTTL = 120 * 60 * 1000; // 2 hours
  } else if (resultCount <= 5) {
    baseTTL = 60 * 60 * 1000; // 1 hour
  }

  if (searchType === 'municipality' || searchType === 'region') {
    baseTTL *= 1.5;
  }

  return baseTTL;
}

// ============================================================================
// SIMPLIFICATION STATS
// ============================================================================

export function calculateSimplificationStats(
  original: AdminSearchResult[],
  simplified: AdminSearchResult[],
  processingTime: number
) {
  let totalOriginalPoints = 0;
  let totalSimplifiedPoints = 0;
  let simplifiedCount = 0;

  for (let i = 0; i < original.length; i++) {
    const orig = original[i];
    const simp = simplified[i];

    if (orig.geometry && simp.simplification) {
      totalOriginalPoints += simp.simplification.originalPoints;
      totalSimplifiedPoints += simp.simplification.simplifiedPoints;
      simplifiedCount++;
    }
  }

  const averageReduction =
    totalOriginalPoints > 0
      ? ((totalOriginalPoints - totalSimplifiedPoints) / totalOriginalPoints) * 100
      : 0;

  return {
    totalBoundaries: original.length,
    simplifiedBoundaries: simplifiedCount,
    averageReduction: Math.round(averageReduction),
    processingTime: Math.round(processingTime),
  };
}
