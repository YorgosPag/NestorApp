/**
 * INTERACTIVE SEARCH & FILTERING SYSTEM
 * Geo-Alert System - Phase 6: Enterprise Search & Filter Components
 *
 * Split into SRP modules (ADR-065):
 * - search-engine.ts — SearchEngine class, types, interfaces
 * - search-system-inputs.tsx — SearchInput & Filter components
 */

import React, { useState, useEffect, useMemo, ReactNode } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTheme } from '../theme/ThemeProvider';
import {
  searchSystemClasses,
  getResultItemClassName,
} from './SearchSystem.styles';
import { cn } from '@/lib/utils';

// SRP modules (ADR-065)
import { SearchEngine } from './search-engine';
import type {
  SearchableItem,
  SearchResult,
  SearchConfig,
  FilterConfig,
  ActiveFilter,
  FilterValue,
} from './search-engine';
import { SearchInput, Filter } from './search-system-inputs';

// Re-export types for consumers
export type {
  SearchMetadata,
  FilterValue,
  SearchableItem,
  SearchResult,
  SearchMatch,
  FilterConfig,
  ActiveFilter,
  SearchConfig,
} from './search-engine';
export { SearchEngine } from './search-engine';

// ============================================================================
// SEARCH RESULT COMPONENT
// ============================================================================

interface SearchResultItemProps {
  result: SearchResult;
  onClick?: (result: SearchResult) => void;
  className?: string;
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  onClick,
  className = ''
}) => {
  const handleClick = () => {
    onClick?.(result);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(getResultItemClassName(!!onClick), 'search-result-item', className)}
    >
      <div
        className={searchSystemClasses.results.itemTitle}
        dangerouslySetInnerHTML={{ __html: result.highlightedTitle }}
      />

      {result.item.subtitle && (
        <div className={searchSystemClasses.results.itemDescription}>
          {result.item.subtitle}
        </div>
      )}

      {result.highlightedDescription && (
        <div
          className={searchSystemClasses.results.itemDescription}
          dangerouslySetInnerHTML={{ __html: result.highlightedDescription }}
        />
      )}

      {result.item.category && (
        <div className={searchSystemClasses.results.itemCategory}>
          {result.item.category}
        </div>
      )}

      {result.item.tags && result.item.tags.length > 0 && (
        <div className={searchSystemClasses.results.itemTags}>
          {result.item.tags.map(tag => (
            <span key={tag} className={searchSystemClasses.results.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN SEARCH SYSTEM COMPONENT
// ============================================================================

export interface SearchSystemProps {
  items: SearchableItem[];
  config?: Partial<SearchConfig>;
  filters?: FilterConfig[];
  onResultClick?: (result: SearchResult) => void;
  onFiltersChange?: (filters: ActiveFilter[]) => void;
  renderResult?: (result: SearchResult) => ReactNode;
  className?: string;
}

export const SearchSystem: React.FC<SearchSystemProps> = ({
  items,
  config = {},
  filters = [],
  onResultClick,
  onFiltersChange,
  renderResult,
  className = ''
}) => {
  const searchConfig: SearchConfig = {
    placeholder: 'Search...',
    debounceMs: 300,
    minQueryLength: 0,
    maxResults: 50,
    fuzzyThreshold: 0.3,
    showSuggestions: true,
    showCategories: true,
    showFilters: true,
    showResultCount: true,
    caseSensitive: false,
    enableKeyboardNavigation: true,
    ...config
  };

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, FilterValue>>({});
  const [loading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const searchEngine = useMemo(() => {
    return new SearchEngine(items, searchConfig.fuzzyThreshold);
  }, [items, searchConfig.fuzzyThreshold]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, searchConfig.debounceMs);
    return () => clearTimeout(timer);
  }, [query, searchConfig.debounceMs]);

  useEffect(() => {
    searchEngine.updateItems(items);
  }, [items, searchEngine]);

  useEffect(() => {
    if (query.length > 0 && searchConfig.showSuggestions) {
      const allTitles = items.map(item => item.title);
      const allTags = items.flatMap(item => item.tags || []);
      const allCategories = items.map(item => item.category).filter(Boolean) as string[];

      const allSuggestions = [...new Set([...allTitles, ...allTags, ...allCategories])];
      const matchingSuggestions = allSuggestions
        .filter(suggestion =>
          suggestion.toLowerCase().includes(query.toLowerCase()) &&
          suggestion.toLowerCase() !== query.toLowerCase()
        )
        .slice(0, 5);
      setSuggestions(matchingSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [query, items, searchConfig.showSuggestions]);

  const searchResults = useMemo(() => {
    const minQueryLength = searchConfig.minQueryLength ?? 0;
    if (debouncedQuery.length < minQueryLength && activeFilters.length === 0) {
      return [];
    }
    return searchEngine.search(debouncedQuery, activeFilters, searchConfig.maxResults);
  }, [debouncedQuery, activeFilters, searchEngine, searchConfig.minQueryLength, searchConfig.maxResults]);

  const handleFilterChange = (filterId: string, value: FilterValue) => {
    const newFilterValues = { ...filterValues, [filterId]: value };
    setFilterValues(newFilterValues);

    const newActiveFilters: ActiveFilter[] = [];
    for (const filter of filters) {
      const filterValue = newFilterValues[filter.id];
      if (filterValue !== undefined && filterValue !== null && filterValue !== '' &&
          !(Array.isArray(filterValue) && filterValue.length === 0)) {
        let label = filter.label;
        if (filter.type === 'range' && filterValue !== null && typeof filterValue === 'object' && 'min' in filterValue && 'max' in filterValue) {
          const rangeFilterVal = filterValue as { min: number; max: number };
          label = `${filter.label}: ${rangeFilterVal.min} - ${rangeFilterVal.max}`;
        } else if (filter.type === 'multiselect' && Array.isArray(filterValue)) {
          label = `${filter.label}: ${filterValue.length} selected`;
        } else if (typeof filterValue === 'string' || typeof filterValue === 'number' || typeof filterValue === 'boolean') {
          label = `${filter.label}: ${filterValue}`;
        }
        newActiveFilters.push({ id: filter.id, type: filter.type, value: filterValue, label });
      }
    }
    setActiveFilters(newActiveFilters);
    onFiltersChange?.(newActiveFilters);
  };

  const clearFilters = () => {
    setFilterValues({});
    setActiveFilters([]);
    onFiltersChange?.([]);
  };

  return (
    <div className={cn(searchSystemClasses.layout.main, 'search-system', className)}>
      <div className={searchSystemClasses.layout.searchInputSection}>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={searchConfig.placeholder}
          suggestions={suggestions}
          showSuggestions={searchConfig.showSuggestions}
          loading={loading}
        />
      </div>

      {searchConfig.showFilters && filters.length > 0 && (
        <div className={searchSystemClasses.layout.filtersSection}>
          <div className={searchSystemClasses.filter.header}>
            <h4 className={searchSystemClasses.filter.headerTitle}>Filters</h4>
            {activeFilters.length > 0 && (
              <button onClick={clearFilters} className={searchSystemClasses.filter.clearButton}>
                Clear All
              </button>
            )}
          </div>
          <div className={searchSystemClasses.filter.filtersGrid}>
            {filters.map(filter => (
              <Filter
                key={filter.id}
                config={filter}
                value={filterValues[filter.id]}
                onChange={(value) => handleFilterChange(filter.id, value)}
              />
            ))}
          </div>
        </div>
      )}

      {activeFilters.length > 0 && (
        <div className={searchSystemClasses.layout.activeFiltersContainer}>
          {activeFilters.map(filter => (
            <span key={filter.id} className={searchSystemClasses.layout.activeFilterBadge}>
              {filter.label}
              <button
                onClick={() => handleFilterChange(filter.id, null)}
                className={searchSystemClasses.layout.activeFilterCloseButton}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {searchConfig.showResultCount && (query || activeFilters.length > 0) && (
        <div className={searchSystemClasses.layout.resultCount}>
          {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
        </div>
      )}

      <div className="search-results">
        {searchResults.map((result) => (
          renderResult ? (
            <div key={result.item.id}>{renderResult(result)}</div>
          ) : (
            <SearchResultItem key={result.item.id} result={result} onClick={onResultClick} />
          )
        ))}

        {query && searchResults.length === 0 && (
          <div className={searchSystemClasses.layout.emptyState}>
            <div className={searchSystemClasses.layout.emptyStateIcon}>🔍</div>
            <div className={searchSystemClasses.layout.emptyStateTitle}>No results found</div>
            <div className={searchSystemClasses.layout.emptyStateSubtitle}>Try adjusting your search or filters</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchSystem;
