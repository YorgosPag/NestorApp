/**
 * SEARCH ENGINE — Fuzzy search & filtering logic
 *
 * Pure search engine class with text matching, fuzzy search,
 * and filter application. No React dependency.
 * Extracted from SearchSystem (ADR-065).
 *
 * @module ui/design-system/search/search-engine
 * @see SearchSystem.tsx
 */

import { highlightSearchTerm } from '@/lib/obligations-utils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type SearchMetadata = Record<string, unknown>;
export type FilterValue = string | string[] | number | boolean | { min: number; max: number } | null;

export interface SearchableItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  category?: string;
  tags?: string[];
  metadata?: SearchMetadata;
  searchableText?: string;
}

export interface SearchResult {
  item: SearchableItem;
  score: number;
  matches: SearchMatch[];
  highlightedTitle: string;
  highlightedDescription: string;
}

export interface SearchMatch {
  field: string;
  value: string;
  start: number;
  end: number;
}

export interface FilterConfig {
  id: string;
  label: string;
  type: 'select' | 'multiselect' | 'range' | 'date' | 'boolean' | 'text';
  options?: Array<{ value: string; label: string; count?: number }>;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  defaultValue?: FilterValue;
}

export interface ActiveFilter {
  id: string;
  type: string;
  value: FilterValue;
  label: string;
}

export interface SearchConfig {
  placeholder?: string;
  debounceMs?: number;
  minQueryLength?: number;
  maxResults?: number;
  fuzzyThreshold?: number;
  showSuggestions?: boolean;
  showCategories?: boolean;
  showFilters?: boolean;
  showResultCount?: boolean;
  caseSensitive?: boolean;
  enableKeyboardNavigation?: boolean;
}

// ============================================================================
// SEARCH ENGINE
// ============================================================================

export class SearchEngine {
  private items: SearchableItem[] = [];
  private fuzzyThreshold: number = 0.3;

  constructor(items: SearchableItem[] = [], fuzzyThreshold: number = 0.3) {
    this.items = items;
    this.fuzzyThreshold = fuzzyThreshold;
  }

  public updateItems(items: SearchableItem[]): void {
    this.items = items;
  }

  public search(
    query: string,
    filters: ActiveFilter[] = [],
    maxResults: number = 50
  ): SearchResult[] {
    if (!query.trim() && filters.length === 0) {
      return this.items.slice(0, maxResults).map(item => ({
        item,
        score: 1,
        matches: [],
        highlightedTitle: item.title,
        highlightedDescription: item.description || ''
      }));
    }

    let results = this.items;

    if (filters.length > 0) {
      results = this.applyFilters(results, filters);
    }

    if (query.trim()) {
      const searchResults = this.performTextSearch(results, query);
      return searchResults.slice(0, maxResults);
    }

    return results.slice(0, maxResults).map(item => ({
      item,
      score: 1,
      matches: [],
      highlightedTitle: item.title,
      highlightedDescription: item.description || ''
    }));
  }

  private performTextSearch(items: SearchableItem[], query: string): SearchResult[] {
    const normalizedQuery = query.toLowerCase().trim();
    const queryWords = normalizedQuery.split(/\s+/);

    const results: SearchResult[] = [];

    for (const item of items) {
      const searchText = this.buildSearchableText(item).toLowerCase();
      const titleLower = item.title.toLowerCase();
      const descriptionLower = (item.description || '').toLowerCase();

      let score = 0;
      const matches: SearchMatch[] = [];

      if (titleLower === normalizedQuery) {
        score += 100;
      } else if (titleLower.includes(normalizedQuery)) {
        score += 50;
        matches.push({
          field: 'title',
          value: item.title,
          start: titleLower.indexOf(normalizedQuery),
          end: titleLower.indexOf(normalizedQuery) + normalizedQuery.length
        });
      }

      if (descriptionLower.includes(normalizedQuery)) {
        score += 25;
        matches.push({
          field: 'description',
          value: item.description || '',
          start: descriptionLower.indexOf(normalizedQuery),
          end: descriptionLower.indexOf(normalizedQuery) + normalizedQuery.length
        });
      }

      for (const word of queryWords) {
        if (word.length < 2) continue;
        if (titleLower.includes(word)) score += 20;
        if (descriptionLower.includes(word)) score += 10;
        if (item.tags?.some(tag => tag.toLowerCase().includes(word))) score += 15;
        if (item.category?.toLowerCase().includes(word)) score += 15;
      }

      if (score === 0) {
        const fuzzyScore = this.calculateFuzzyScore(searchText, normalizedQuery);
        if (fuzzyScore > this.fuzzyThreshold) {
          score = fuzzyScore * 10;
        }
      }

      if (score > 0) {
        results.push({
          item,
          score,
          matches,
          highlightedTitle: highlightSearchTerm(item.title, normalizedQuery, ""),
          highlightedDescription: highlightSearchTerm(item.description || '', normalizedQuery, "")
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private buildSearchableText(item: SearchableItem): string {
    const parts = [
      item.title, item.subtitle, item.description, item.category,
      ...(item.tags || []), item.searchableText
    ].filter(Boolean);
    return parts.join(' ');
  }

  private calculateFuzzyScore(text: string, query: string): number {
    if (text.length === 0 || query.length === 0) return 0;

    const matrix: number[][] = [];
    const textLen = text.length;
    const queryLen = query.length;

    for (let i = 0; i <= textLen; i++) {
      matrix[i] = [];
      matrix[i][0] = i;
    }
    for (let j = 0; j <= queryLen; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= textLen; i++) {
      for (let j = 1; j <= queryLen; j++) {
        const cost = text[i - 1] === query[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[textLen][queryLen];
    const maxLen = Math.max(textLen, queryLen);
    return 1 - distance / maxLen;
  }

  private applyFilters(items: SearchableItem[], filters: ActiveFilter[]): SearchableItem[] {
    return items.filter(item => {
      return filters.every(filter => {
        switch (filter.type) {
          case 'select':
            return item.category === filter.value;

          case 'multiselect':
            if (!Array.isArray(filter.value)) return true;
            return filter.value.some(value =>
              item.tags?.includes(value) || item.category === value
            );

          case 'range': {
            if (filter.value === null || typeof filter.value !== 'object' || !('min' in filter.value) || !('max' in filter.value)) {
              return true;
            }
            const rangeValue = filter.value as { min: number; max: number };
            const numValue = Number(item.metadata?.[filter.id]);
            return numValue >= rangeValue.min && numValue <= rangeValue.max;
          }

          case 'date': {
            if (filter.value === null || typeof filter.value !== 'string') return true;
            const itemDate = new Date(item.metadata?.[filter.id] as string | number);
            const filterDate = new Date(filter.value);
            return itemDate >= filterDate;
          }

          case 'boolean':
            return Boolean(item.metadata?.[filter.id]) === filter.value;

          case 'text': {
            if (filter.value === null || typeof filter.value !== 'string') return true;
            const searchText = this.buildSearchableText(item).toLowerCase();
            return searchText.includes(filter.value.toLowerCase());
          }

          default:
            return true;
        }
      });
    });
  }
}
