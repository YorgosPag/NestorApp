/**
 * INTERACTIVE SEARCH & FILTERING SYSTEM
 * Geo-Alert System - Phase 6: Enterprise Search & Filter Components
 *
 * Comprehensive search system με fuzzy search, advanced filtering,
 * real-time suggestions, και keyboard navigation. Enterprise-grade implementation.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { highlightSearchTerm } from '@/lib/obligations-utils'; // ✅ Using centralized function
import { Search, Clock } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTheme } from '../theme/ThemeProvider';
import { layoutUtilities } from '@/styles/design-tokens';
import {
  searchSystemStyles,
  getFilterStateStyle,
  getSearchResultHoverHandlers,
  getDynamicSuggestionStyle,
  getDynamicInputStyle,
  getDynamicResultItemStyle,
  // ✅ ENTERPRISE: Import className builders (NO MORE INLINE STYLES)
  searchSystemClasses,
  getSearchInputClassName,
  getSuggestionItemClassName,
  getResultItemClassName
} from './SearchSystem.styles';
import { cn } from '@/lib/utils';

// ============================================================================
// SEARCH TYPES και INTERFACES
// ============================================================================

export interface SearchableItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, any>;
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
  defaultValue?: any;
}

export interface ActiveFilter {
  id: string;
  type: string;
  value: any;
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

    // Apply filters first
    if (filters.length > 0) {
      results = this.applyFilters(results, filters);
    }

    // Apply text search
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

      // Exact title match gets highest score
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

      // Description matches
      if (descriptionLower.includes(normalizedQuery)) {
        score += 25;
        matches.push({
          field: 'description',
          value: item.description || '',
          start: descriptionLower.indexOf(normalizedQuery),
          end: descriptionLower.indexOf(normalizedQuery) + normalizedQuery.length
        });
      }

      // Word-by-word matching
      for (const word of queryWords) {
        if (word.length < 2) continue;

        if (titleLower.includes(word)) {
          score += 20;
        }
        if (descriptionLower.includes(word)) {
          score += 10;
        }
        if (item.tags?.some(tag => tag.toLowerCase().includes(word))) {
          score += 15;
        }
        if (item.category?.toLowerCase().includes(word)) {
          score += 15;
        }
      }

      // Fuzzy matching για typos
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
      item.title,
      item.subtitle,
      item.description,
      item.category,
      ...(item.tags || []),
      item.searchableText
    ].filter(Boolean);

    return parts.join(' ');
  }

  private calculateFuzzyScore(text: string, query: string): number {
    if (text.length === 0 || query.length === 0) return 0;

    const matrix: number[][] = [];
    const textLen = text.length;
    const queryLen = query.length;

    // Initialize matrix
    for (let i = 0; i <= textLen; i++) {
      matrix[i] = [];
      matrix[i][0] = i;
    }
    for (let j = 0; j <= queryLen; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
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

          case 'range':
            const numValue = Number(item.metadata?.[filter.id]);
            return numValue >= filter.value.min && numValue <= filter.value.max;

          case 'date':
            const itemDate = new Date(item.metadata?.[filter.id]);
            const filterDate = new Date(filter.value);
            return itemDate >= filterDate;

          case 'boolean':
            return Boolean(item.metadata?.[filter.id]) === filter.value;

          case 'text':
            const searchText = this.buildSearchableText(item).toLowerCase();
            return searchText.includes(filter.value.toLowerCase());

          default:
            return true;
        }
      });
    });
  }
}

// ============================================================================
// SEARCH INPUT COMPONENT
// ============================================================================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  suggestions?: string[];
  showSuggestions?: boolean;
  loading?: boolean;
  className?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder = 'Search...',
  suggestions = [],
  showSuggestions = true,
  loading = false,
  className = ''
}) => {
  const { isDark } = useTheme();
  const [focused, setFocused] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = () => {
    setFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    // Delay blur για να μπορεί να κάνει click στα suggestions
    setTimeout(() => {
      setFocused(false);
      setSelectedSuggestion(-1);
      onBlur?.();
    }, 200);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedSuggestion(prev =>
          prev < suggestions.length - 1 ? prev + 1 : -1
        );
        break;

      case 'ArrowUp':
        event.preventDefault();
        setSelectedSuggestion(prev =>
          prev > -1 ? prev - 1 : suggestions.length - 1
        );
        break;

      case 'Enter':
        event.preventDefault();
        if (selectedSuggestion >= 0) {
          onChange(suggestions[selectedSuggestion]);
          setSelectedSuggestion(-1);
          inputRef.current?.blur();
        }
        break;

      case 'Escape':
        setSelectedSuggestion(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Using centralized styling από SearchSystem.styles.ts

  return (
    <div className={cn(searchSystemClasses.searchInput.container, 'search-input', className)}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={getSearchInputClassName(focused)}
      />

      {/* Search Icon */}
      <div className={searchSystemClasses.searchInput.icon}>
        {loading ? <Clock className={iconSizes.sm} /> : <Search className={iconSizes.sm} />}
      </div>

      {/* Suggestions */}
      {focused && showSuggestions && suggestions.length > 0 && (
        <div className={searchSystemClasses.searchInput.suggestionsContainer}>
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => {
                onChange(suggestion);
                setSelectedSuggestion(-1);
                inputRef.current?.blur();
              }}
              className={getSuggestionItemClassName(selectedSuggestion === index)}
              onMouseEnter={() => setSelectedSuggestion(index)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// FILTER COMPONENT
// ============================================================================

interface FilterProps {
  config: FilterConfig;
  value: any;
  onChange: (value: any) => void;
  className?: string;
}

const Filter: React.FC<FilterProps> = ({
  config,
  value,
  onChange,
  className = ''
}) => {
  const { isDark } = useTheme();

  const renderFilter = () => {
    switch (config.type) {
      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value || null)}
            className={searchSystemClasses.filter.select}
          >
            <option value="">All {config.label}</option>
            {config.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label} {option.count && `(${option.count})`}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className={searchSystemClasses.filter.container}>
            {config.options?.map(option => (
              <label
                key={option.value}
                className={searchSystemClasses.filter.multiselectLabel}
              >
                <input
                  type="checkbox"
                  className={searchSystemClasses.filter.checkbox}
                  checked={Array.isArray(value) ? value.includes(option.value) : false}
                  onChange={(e) => {
                    const currentValue = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      onChange([...currentValue, option.value]);
                    } else {
                      onChange(currentValue.filter(v => v !== option.value));
                    }
                  }}
                />
                {option.label} {option.count && `(${option.count})`}
              </label>
            ))}
          </div>
        );

      case 'range':
        return (
          <div className={searchSystemClasses.filter.rangeContainer}>
            <input
              type="number"
              min={config.min}
              max={config.max}
              step={config.step}
              value={value?.min || config.min || 0}
              onChange={(e) => onChange({
                ...value,
                min: Number(e.target.value)
              })}
              className={searchSystemClasses.filter.rangeInput}
            />
            <span className={searchSystemClasses.filter.rangeLabel}>to</span>
            <input
              type="number"
              min={config.min}
              max={config.max}
              step={config.step}
              value={value?.max || config.max || 100}
              onChange={(e) => onChange({
                ...value,
                max: Number(e.target.value)
              })}
              className={searchSystemClasses.filter.rangeInput}
            />
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value || null)}
            className={searchSystemClasses.filter.input}
          />
        );

      case 'boolean':
        return (
          <label className={searchSystemClasses.filter.label}>
            <input
              type="checkbox"
              className={searchSystemClasses.filter.checkbox}
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
            />
            {config.label}
          </label>
        );

      case 'text':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder={config.placeholder}
            className={searchSystemClasses.filter.input}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn(searchSystemClasses.filter.container, 'filter', className)}>
      {config.type !== 'boolean' && (
        <label className={searchSystemClasses.filter.label}>
          {config.label}
        </label>
      )}
      {renderFilter()}
    </div>
  );
};

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
  const { isDark } = useTheme();

  const handleClick = () => {
    onClick?.(result);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(getResultItemClassName(!!onClick), 'search-result-item', className)}
      {...(onClick ? getSearchResultHoverHandlers() : {})}
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
            <span
              key={tag}
              className={searchSystemClasses.results.tag}
            >
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
  const { isDark } = useTheme();
  const iconSizes = useIconSizes();

  // Configuration dengan defaults
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

  // State
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Search engine instance
  const searchEngine = useMemo(() => {
    return new SearchEngine(items, searchConfig.fuzzyThreshold);
  }, [items, searchConfig.fuzzyThreshold]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, searchConfig.debounceMs);

    return () => clearTimeout(timer);
  }, [query, searchConfig.debounceMs]);

  // Update search engine items
  useEffect(() => {
    searchEngine.updateItems(items);
  }, [items, searchEngine]);

  // Generate suggestions
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

  // Perform search
  const searchResults = useMemo(() => {
    if (debouncedQuery.length < searchConfig.minQueryLength && activeFilters.length === 0) {
      return [];
    }

    return searchEngine.search(debouncedQuery, activeFilters, searchConfig.maxResults);
  }, [debouncedQuery, activeFilters, searchEngine, searchConfig.minQueryLength, searchConfig.maxResults]);

  // Filter change handler
  const handleFilterChange = (filterId: string, value: any) => {
    const newFilterValues = { ...filterValues, [filterId]: value };
    setFilterValues(newFilterValues);

    // Convert to active filters
    const newActiveFilters: ActiveFilter[] = [];

    for (const filter of filters) {
      const filterValue = newFilterValues[filter.id];
      if (filterValue !== undefined && filterValue !== null && filterValue !== '' &&
          !(Array.isArray(filterValue) && filterValue.length === 0)) {

        let label = filter.label;
        if (filter.type === 'range' && filterValue.min !== undefined && filterValue.max !== undefined) {
          label = `${filter.label}: ${filterValue.min} - ${filterValue.max}`;
        } else if (filter.type === 'multiselect' && Array.isArray(filterValue)) {
          label = `${filter.label}: ${filterValue.length} selected`;
        } else {
          label = `${filter.label}: ${filterValue}`;
        }

        newActiveFilters.push({
          id: filter.id,
          type: filter.type,
          value: filterValue,
          label
        });
      }
    }

    setActiveFilters(newActiveFilters);
    onFiltersChange?.(newActiveFilters);
  };

  // Clear filters
  const clearFilters = () => {
    setFilterValues({});
    setActiveFilters([]);
    onFiltersChange?.([]);
  };

  return (
    <div className={cn(searchSystemClasses.layout.main, 'search-system', className)}>
      {/* Search Input */}
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

      {/* Filters */}
      {searchConfig.showFilters && filters.length > 0 && (
        <div className={searchSystemClasses.layout.filtersSection}>
          <div className={searchSystemClasses.filter.header}>
            <h4 className={searchSystemClasses.filter.headerTitle}>
              Filters
            </h4>
            {activeFilters.length > 0 && (
              <button
                onClick={clearFilters}
                className={searchSystemClasses.filter.clearButton}
              >
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

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className={searchSystemClasses.layout.activeFiltersContainer}>
          {activeFilters.map(filter => (
            <span
              key={filter.id}
              className={searchSystemClasses.layout.activeFilterBadge}
            >
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

      {/* Result Count */}
      {searchConfig.showResultCount && (query || activeFilters.length > 0) && (
        <div className={searchSystemClasses.layout.resultCount}>
          {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
        </div>
      )}

      {/* Search Results */}
      <div className="search-results">
        {searchResults.map((result, index) => (
          renderResult ? (
            <div key={result.item.id}>{renderResult(result)}</div>
          ) : (
            <SearchResultItem
              key={result.item.id}
              result={result}
              onClick={onResultClick}
            />
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