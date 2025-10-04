'use client';

// Advanced Search Engine with fuzzy search, filters, and sorting
export interface SearchField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'range';
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  options?: Array<{ value: any; label: string }>;
}

export interface SearchFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'notIn';
  value: any;
  values?: any[]; // For 'between' and 'in' operators
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SearchOptions {
  query?: string;
  filters?: SearchFilter[];
  sort?: SortOption[];
  pagination?: {
    page: number;
    pageSize: number;
  };
  fuzzyThreshold?: number; // 0-1, lower = more strict
  includeScore?: boolean;
}

export interface SearchResult<T = any> {
  items: Array<T & { _score?: number; _highlights?: Record<string, string[]> }>;
  totalCount: number;
  facets?: Record<string, Array<{ value: any; count: number }>>;
  suggestions?: string[];
  executionTime: number;
}

class AdvancedSearchEngine<T = any> {
  private data: T[] = [];
  private fields: SearchField[] = [];
  private index = new Map<string, Set<number>>();
  private stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

  constructor(fields: SearchField[]) {
    this.fields = fields;
  }

  // Index data for faster searching
  indexData(data: T[]) {
    this.data = data;
    this.index.clear();

    data.forEach((item, index) => {
      this.fields.forEach(field => {
        if (field.searchable) {
          const value = this.getFieldValue(item, field.key);
          if (value != null) {
            const tokens = this.tokenize(String(value));
            tokens.forEach(token => {
              if (!this.index.has(token)) {
                this.index.set(token, new Set());
              }
              this.index.get(token)!.add(index);
            });
          }
        }
      });
    });
  }

  // Main search method
  search(options: SearchOptions): SearchResult<T> {
    const startTime = performance.now();
    
    let results = [...this.data];
    const itemScores = new Map<number, number>();
    const highlights = new Map<number, Record<string, string[]>>();

    // Text search with scoring
    if (options.query && options.query.trim()) {
      const searchResults = this.performTextSearch(options.query, options.fuzzyThreshold);
      results = searchResults.items;
      searchResults.scores.forEach((score, index) => itemScores.set(index, score));
      searchResults.highlights.forEach((highlight, index) => highlights.set(index, highlight));
    }

    // Apply filters
    if (options.filters && options.filters.length > 0) {
      results = this.applyFilters(results, options.filters);
    }

    // Calculate facets before sorting/pagination
    const facets = this.calculateFacets(results);

    // Apply sorting
    if (options.sort && options.sort.length > 0) {
      results = this.applySorting(results, options.sort, itemScores);
    }

    const totalCount = results.length;

    // Apply pagination
    if (options.pagination) {
      const { page, pageSize } = options.pagination;
      const startIndex = (page - 1) * pageSize;
      results = results.slice(startIndex, startIndex + pageSize);
    }

    // Add scores and highlights to results
    const finalResults = results.map((item, index) => {
      const originalIndex = this.data.indexOf(item);
      const result: any = { ...item };
      
      if (options.includeScore && itemScores.has(originalIndex)) {
        result._score = itemScores.get(originalIndex);
      }
      
      if (highlights.has(originalIndex)) {
        result._highlights = highlights.get(originalIndex);
      }
      
      return result;
    });

    const executionTime = performance.now() - startTime;

    return {
      items: finalResults,
      totalCount,
      facets,
      suggestions: this.generateSuggestions(options.query),
      executionTime
    };
  }

  private performTextSearch(query: string, fuzzyThreshold = 0.8) {
    const queryTokens = this.tokenize(query);
    const candidateIndices = new Set<number>();
    const scores = new Map<number, number>();
    const highlights = new Map<number, Record<string, string[]>>();

    // Find candidate items using inverted index
    queryTokens.forEach(token => {
      // Exact matches
      if (this.index.has(token)) {
        this.index.get(token)!.forEach(index => candidateIndices.add(index));
      }

      // Fuzzy matches
      for (const [indexToken, indices] of this.index) {
        if (this.calculateSimilarity(token, indexToken) >= fuzzyThreshold) {
          indices.forEach(index => candidateIndices.add(index));
        }
      }
    });

    // Score and highlight candidates
    const results: T[] = [];
    
    candidateIndices.forEach(index => {
      const item = this.data[index];
      const { score, itemHighlights } = this.scoreItem(item, queryTokens, index);
      
      if (score > 0) {
        results.push(item);
        scores.set(index, score);
        if (Object.keys(itemHighlights).length > 0) {
          highlights.set(index, itemHighlights);
        }
      }
    });

    // Sort by relevance score
    results.sort((a, b) => {
      const scoreA = scores.get(this.data.indexOf(a)) || 0;
      const scoreB = scores.get(this.data.indexOf(b)) || 0;
      return scoreB - scoreA;
    });

    return { items: results, scores, highlights };
  }

  private scoreItem(item: T, queryTokens: string[], itemIndex: number) {
    let totalScore = 0;
    const itemHighlights: Record<string, string[]> = {};

    this.fields.forEach(field => {
      if (!field.searchable) return;

      const value = this.getFieldValue(item, field.key);
      if (value == null) return;

      const fieldText = String(value);
      const fieldTokens = this.tokenize(fieldText);
      
      let fieldScore = 0;
      const fieldHighlight: string[] = [];

      queryTokens.forEach(queryToken => {
        fieldTokens.forEach(fieldToken => {
          const similarity = this.calculateSimilarity(queryToken, fieldToken);
          if (similarity > 0.5) {
            fieldScore += similarity;
            
            // Add highlight
            if (similarity >= 0.8) {
              fieldHighlight.push(fieldToken);
            }
          }
        });
      });

      if (fieldScore > 0) {
        // Apply field weight (can be configured per field)
        const fieldWeight = field.key === 'title' || field.key === 'name' ? 2 : 1;
        totalScore += fieldScore * fieldWeight;
        
        if (fieldHighlight.length > 0) {
          itemHighlights[field.key] = fieldHighlight;
        }
      }
    });

    return { score: totalScore, itemHighlights };
  }

  private applyFilters(results: T[], filters: SearchFilter[]): T[] {
    return results.filter(item => {
      return filters.every(filter => this.matchesFilter(item, filter));
    });
  }

  private matchesFilter(item: T, filter: SearchFilter): boolean {
    const value = this.getFieldValue(item, filter.field);
    
    switch (filter.operator) {
      case 'equals':
        return value === filter.value;
      case 'contains':
        return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
      case 'startsWith':
        return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
      case 'endsWith':
        return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
      case 'gt':
        return Number(value) > Number(filter.value);
      case 'gte':
        return Number(value) >= Number(filter.value);
      case 'lt':
        return Number(value) < Number(filter.value);
      case 'lte':
        return Number(value) <= Number(filter.value);
      case 'between':
        if (!filter.values || filter.values.length !== 2) return false;
        const numValue = Number(value);
        return numValue >= Number(filter.values[0]) && numValue <= Number(filter.values[1]);
      case 'in':
        return filter.values?.includes(value) || false;
      case 'notIn':
        return !filter.values?.includes(value) || true;
      default:
        return true;
    }
  }

  private applySorting(results: T[], sortOptions: SortOption[], scores?: Map<number, number>): T[] {
    return results.sort((a, b) => {
      for (const sort of sortOptions) {
        let comparison = 0;
        
        if (sort.field === '_score' && scores) {
          const scoreA = scores.get(this.data.indexOf(a)) || 0;
          const scoreB = scores.get(this.data.indexOf(b)) || 0;
          comparison = scoreB - scoreA;
        } else {
          const valueA = this.getFieldValue(a, sort.field);
          const valueB = this.getFieldValue(b, sort.field);
          
          if (valueA < valueB) comparison = -1;
          else if (valueA > valueB) comparison = 1;
          else comparison = 0;
        }
        
        if (comparison !== 0) {
          return sort.direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  private calculateFacets(results: T[]): Record<string, Array<{ value: any; count: number }>> {
    const facets: Record<string, Array<{ value: any; count: number }>> = {};
    
    this.fields.forEach(field => {
      if (!field.filterable) return;
      
      const valueCounts = new Map<any, number>();
      
      results.forEach(item => {
        const value = this.getFieldValue(item, field.key);
        if (value != null) {
          valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
        }
      });
      
      facets[field.key] = Array.from(valueCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    });
    
    return facets;
  }

  private generateSuggestions(query?: string): string[] {
    if (!query) return [];
    
    const suggestions: string[] = [];
    const queryLower = query.toLowerCase();
    
    // Generate suggestions from indexed tokens
    for (const token of this.index.keys()) {
      if (token.toLowerCase().startsWith(queryLower) && token !== queryLower) {
        suggestions.push(token);
      }
    }
    
    return suggestions.slice(0, 5);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1 && !this.stopWords.has(token));
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    // Levenshtein distance
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
    
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,     // deletion
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len2][len1]) / maxLen;
  }

  private getFieldValue(item: T, fieldPath: string): any {
    const keys = fieldPath.split('.');
    let value: any = item;
    
    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = (value as any)[key];
      } else {
        return null;
      }
    }
    
    return value;
  }

  // Public utility methods
  getFields(): SearchField[] {
    return this.fields;
  }

  addField(field: SearchField) {
    this.fields.push(field);
    // Re-index if data exists
    if (this.data.length > 0) {
      this.indexData(this.data);
    }
  }

  getDataSize(): number {
    return this.data.length;
  }

  getIndexSize(): number {
    return this.index.size;
  }
}

export default AdvancedSearchEngine;