/**
 * ADMINISTRATIVE BOUNDARY — SUGGESTION ENGINE
 * Standalone suggestion functions for municipalities, regions, postal codes,
 * and enhanced multi-source suggestions.
 * Extracted from AdministrativeBoundaryService.ts (ADR-065).
 */

import {
  GreekAdminLevel,
  MajorGreekRegions,
  MajorGreekMunicipalities,
} from '../../types/administrative-types';

import {
  fuzzyMatch,
  isInAthenMetropolitanArea,
  isInThessalonikiArea,
} from './admin-boundary-utils';

/** Categories for search suggestions */
export interface SuggestionCategories {
  history: string[];
  municipalities: string[];
  regions: string[];
  postalCodes: string[];
  contextual: string[];
}

// ============================================================================
// BASIC SUGGESTIONS
// ============================================================================

export function getMunicipalitySuggestions(partialName: string): string[] {
  return Object.values(MajorGreekMunicipalities)
    .filter((name) => name.toLowerCase().includes(partialName.toLowerCase()))
    .slice(0, 5);
}

export function getRegionSuggestions(partialName: string): string[] {
  return Object.values(MajorGreekRegions)
    .filter((name) => name.toLowerCase().includes(partialName.toLowerCase()))
    .slice(0, 5);
}

export function getGeneralSuggestions(query: string): string[] {
  const allSuggestions = [
    ...Object.values(MajorGreekMunicipalities),
    ...Object.values(MajorGreekRegions),
  ];
  return allSuggestions
    .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5);
}

// ============================================================================
// ENHANCED SUGGESTIONS
// ============================================================================

export function getEnhancedMunicipalitySuggestions(
  query: string,
  regionFilter?: string,
  limit = 5
): string[] {
  const municipalities = Object.values(MajorGreekMunicipalities);

  return municipalities
    .filter((name) => {
      const nameLower = name.toLowerCase();
      return (
        nameLower.includes(query) ||
        nameLower.startsWith(query) ||
        fuzzyMatch(nameLower, query, 0.7)
      );
    })
    .sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();

      const aExact = aLower === query;
      const bExact = bLower === query;
      if (aExact !== bExact) return aExact ? -1 : 1;

      const aStarts = aLower.startsWith(query);
      const bStarts = bLower.startsWith(query);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;

      return a.length - b.length;
    })
    .slice(0, limit);
}

export function getEnhancedRegionSuggestions(query: string, limit = 5): string[] {
  return Object.values(MajorGreekRegions)
    .filter((name) => {
      const nameLower = name.toLowerCase();
      return (
        nameLower.includes(query) ||
        nameLower.startsWith(query) ||
        fuzzyMatch(nameLower, query, 0.7)
      );
    })
    .sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();

      const aExact = aLower === query;
      const bExact = bLower === query;
      if (aExact !== bExact) return aExact ? -1 : 1;

      const aStarts = aLower.startsWith(query);
      const bStarts = bLower.startsWith(query);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;

      return a.length - b.length;
    })
    .slice(0, limit);
}

export async function getPostalCodeSuggestions(query: string, limit = 3): Promise<string[]> {
  const numericQuery = query.replace(/\D/g, '');
  if (numericQuery.length === 0) return [];

  const suggestions: string[] = [];
  const majorCityPrefixes = [
    '10', '11', '12', '15', '20', '21', '22', '23', '24', '25', '26', '54', '55', '56',
  ];

  for (const prefix of majorCityPrefixes) {
    if (prefix.startsWith(numericQuery)) {
      suggestions.push(`Τ.Κ. ${prefix}XXX`);
    }
  }

  if (numericQuery.length >= 3) {
    const baseCode = numericQuery.padEnd(5, 'X');
    suggestions.push(`Τ.Κ. ${baseCode}`);
  }

  return suggestions.slice(0, limit);
}

export async function getLocationBasedSuggestions(
  query: string,
  location: { lat: number; lng: number },
  limit = 2
): Promise<string[]> {
  const suggestions: string[] = [];

  if (isInAthenMetropolitanArea(location)) {
    if ('αθήνα'.includes(query) || 'athens'.includes(query)) {
      suggestions.push('Δήμος Αθηναίων', 'Αττική');
    }
  } else if (isInThessalonikiArea(location)) {
    if ('θεσσαλονίκη'.includes(query) || 'thessaloniki'.includes(query)) {
      suggestions.push('Δήμος Θεσσαλονίκης', 'Κεντρική Μακεδονία');
    }
  }

  return suggestions.slice(0, limit);
}

// ============================================================================
// SUGGESTION PRIORITIZATION & SCORING
// ============================================================================

export function prioritizeSuggestions(
  suggestions: string[],
  query: string,
  categories: SuggestionCategories
): string[] {
  return suggestions.sort((a, b) => {
    const queryLower = query.toLowerCase();
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    const aExact = aLower === queryLower;
    const bExact = bLower === queryLower;
    if (aExact !== bExact) return aExact ? -1 : 1;

    const aPrefix = aLower.startsWith(queryLower);
    const bPrefix = bLower.startsWith(queryLower);
    if (aPrefix !== bPrefix) return aPrefix ? -1 : 1;

    const aHistory = categories.history.includes(a);
    const bHistory = categories.history.includes(b);
    if (aHistory !== bHistory) return aHistory ? -1 : 1;

    return a.length - b.length;
  });
}

export function calculateSuggestionConfidence(suggestions: string[], query: string): number {
  if (suggestions.length === 0) return 0;

  let totalScore = 0;
  const queryLower = query.toLowerCase();

  for (const suggestion of suggestions) {
    const sLower = suggestion.toLowerCase();

    if (sLower === queryLower) totalScore += 1.0;
    else if (sLower.startsWith(queryLower)) totalScore += 0.8;
    else if (sLower.includes(queryLower)) totalScore += 0.6;
    else totalScore += 0.3;
  }

  return totalScore / suggestions.length;
}

// ============================================================================
// ENHANCED SUGGESTION ORCHESTRATOR
// ============================================================================

export async function getEnhancedSuggestions(
  partialQuery: string,
  context?: {
    adminLevel?: GreekAdminLevel;
    region?: string;
    searchType?: 'address' | 'administrative' | 'postal_code';
    userLocation?: { lat: number; lng: number };
    includeHistory?: boolean;
    includePostalCodes?: boolean;
    limit?: number;
  }
): Promise<{
  suggestions: string[];
  categories: SuggestionCategories;
  metadata: { source: string; confidence: number; totalSources: number };
}> {
  const {
    searchType,
    userLocation,
    includeHistory = true,
    includePostalCodes = true,
    limit = 8,
    region,
  } = context || {};

  const suggestions = new Set<string>();
  const categories: SuggestionCategories = {
    history: [], municipalities: [], regions: [], postalCodes: [], contextual: [],
  };

  let totalSources = 0;
  const queryLower = partialQuery.toLowerCase().trim();

  try {
    // 1. History-based suggestions
    if (includeHistory) {
      const { searchHistoryService } = await import('./SearchHistoryService');
      const historySuggestions = searchHistoryService.getSmartSuggestions(
        partialQuery, searchType, Math.ceil(limit * 0.4)
      );
      categories.history = historySuggestions;
      historySuggestions.forEach((s) => suggestions.add(s));
      totalSources++;
    }

    // 2. Municipality suggestions
    const municipalitySugs = getEnhancedMunicipalitySuggestions(
      queryLower, region, Math.ceil(limit * 0.25)
    );
    categories.municipalities = municipalitySugs;
    municipalitySugs.forEach((s) => suggestions.add(s));
    totalSources++;

    // 3. Region suggestions
    const regionSugs = getEnhancedRegionSuggestions(queryLower, Math.ceil(limit * 0.2));
    categories.regions = regionSugs;
    regionSugs.forEach((s) => suggestions.add(s));
    totalSources++;

    // 4. Postal code suggestions
    if (includePostalCodes && (searchType === 'postal_code' || !searchType)) {
      const postalSugs = await getPostalCodeSuggestions(queryLower, Math.ceil(limit * 0.15));
      categories.postalCodes = postalSugs;
      postalSugs.forEach((s) => suggestions.add(s));
      totalSources++;
    }

    // 5. Location-based contextual suggestions
    if (userLocation) {
      const contextSugs = await getLocationBasedSuggestions(
        queryLower, userLocation, Math.ceil(limit * 0.1)
      );
      categories.contextual = contextSugs;
      contextSugs.forEach((s) => suggestions.add(s));
      totalSources++;
    }

    const finalSuggestions = prioritizeSuggestions(
      Array.from(suggestions), partialQuery, categories
    ).slice(0, limit);

    const confidence = calculateSuggestionConfidence(finalSuggestions, partialQuery);

    return {
      suggestions: finalSuggestions,
      categories,
      metadata: { source: 'enhanced-multi-source', confidence, totalSources },
    };
  } catch {
    const basicSuggestions = getGeneralSuggestions(partialQuery);
    return {
      suggestions: basicSuggestions,
      categories: {
        history: [],
        municipalities: basicSuggestions.filter((s) =>
          (Object.values(MajorGreekMunicipalities) as string[]).includes(s)
        ),
        regions: basicSuggestions.filter((s) =>
          (Object.values(MajorGreekRegions) as string[]).includes(s)
        ),
        postalCodes: [],
        contextual: [],
      },
      metadata: { source: 'fallback-basic', confidence: 0.5, totalSources: 1 },
    };
  }
}
