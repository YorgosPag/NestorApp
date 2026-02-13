/**
 * 📚 SEARCH HISTORY SERVICE - Phase 6.1
 *
 * Enterprise service για search history management
 * Persistent storage, analytics, και intelligent suggestions
 *
 * @module services/administrative-boundaries/SearchHistoryService
 */

import type {
  SearchHistoryEntry,
  AdminSearchResult,
  SearchAnalytics
} from '../../types/administrative-types';
import { generateSearchId } from '@/services/enterprise-id.service';

// ============================================================================
// SEARCH HISTORY SERVICE
// ============================================================================

/**
 * Main Search History Service
 * Manages persistent search history με localStorage και analytics
 */
export class SearchHistoryService {

  private readonly storageKey = 'geo-canvas-search-history';
  private readonly maxHistoryEntries = 100;
  private readonly analyticsKey = 'geo-canvas-search-analytics';

  // ============================================================================
  // CORE HISTORY METHODS
  // ============================================================================

  /**
   * Add search to history
   */
  addToHistory(
    query: string,
    searchType: 'address' | 'administrative' | 'postal_code',
    results: AdminSearchResult[],
    selectedResult?: AdminSearchResult,
    location?: { lat: number; lng: number }
  ): SearchHistoryEntry {
    const entry: SearchHistoryEntry = {
      id: this.generateId(),
      query: query.trim(),
      searchType,
      timestamp: Date.now(),
      results,
      selectedResult,
      location,
      metadata: {
        source: 'manual',
        confidence: selectedResult?.confidence || 0,
        duration: 0 // Will be set by caller
      }
    };

    const history = this.getHistory();

    // Remove duplicate queries (keep most recent)
    const filtered = history.filter(h =>
      h.query.toLowerCase() !== query.toLowerCase().trim()
    );

    // Add new entry at beginning
    filtered.unshift(entry);

    // Limit history size
    const limited = filtered.slice(0, this.maxHistoryEntries);

    // Save to storage
    this.saveHistory(limited);

    // Update analytics
    this.updateAnalytics(entry);

    console.debug(`📚 Added to search history: "${query}" (${searchType})`);

    return entry;
  }

  /**
   * Get full search history
   */
  getHistory(): SearchHistoryEntry[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];

      const parsed = JSON.parse(stored) as SearchHistoryEntry[];
      return Array.isArray(parsed) ? parsed : [];

    } catch (error) {
      console.warn('Failed to load search history:', error);
      return [];
    }
  }

  /**
   * Get recent searches (last N entries)
   */
  getRecentSearches(limit = 10): SearchHistoryEntry[] {
    return this.getHistory().slice(0, limit);
  }

  /**
   * Search within history
   */
  searchHistory(query: string, limit = 5): SearchHistoryEntry[] {
    const history = this.getHistory();
    const queryLower = query.toLowerCase();

    return history
      .filter(entry =>
        entry.query.toLowerCase().includes(queryLower) ||
        entry.selectedResult?.name.toLowerCase().includes(queryLower)
      )
      .slice(0, limit);
  }

  /**
   * Get searches by type
   */
  getSearchesByType(searchType: 'address' | 'administrative' | 'postal_code'): SearchHistoryEntry[] {
    return this.getHistory().filter(entry => entry.searchType === searchType);
  }

  /**
   * Get popular queries (most searched)
   */
  getPopularQueries(limit = 5): Array<{ query: string; count: number; lastUsed: number }> {
    const history = this.getHistory();
    const queryMap = new Map<string, { count: number; lastUsed: number }>();

    // Count occurrences
    for (const entry of history) {
      const query = entry.query.toLowerCase();
      const existing = queryMap.get(query);

      if (existing) {
        existing.count++;
        existing.lastUsed = Math.max(existing.lastUsed, entry.timestamp);
      } else {
        queryMap.set(query, {
          count: 1,
          lastUsed: entry.timestamp
        });
      }
    }

    // Sort by count, then by recency
    return Array.from(queryMap.entries())
      .sort((a, b) => {
        if (b[1].count !== a[1].count) {
          return b[1].count - a[1].count; // Higher count first
        }
        return b[1].lastUsed - a[1].lastUsed; // More recent first
      })
      .slice(0, limit)
      .map(([query, data]) => ({
        query,
        count: data.count,
        lastUsed: data.lastUsed
      }));
  }

  // ============================================================================
  // SMART SUGGESTIONS
  // ============================================================================

  /**
   * Get intelligent search suggestions based on history
   */
  getSmartSuggestions(
    partialQuery: string,
    searchType?: 'address' | 'administrative' | 'postal_code',
    limit = 5
  ): string[] {
    const history = this.getHistory();
    const queryLower = partialQuery.toLowerCase().trim();

    if (!queryLower) {
      // Return recent popular queries
      return this.getPopularQueries(limit).map(p => p.query);
    }

    const suggestions = new Set<string>();

    // Filter by search type if specified
    const filteredHistory = searchType
      ? history.filter(h => h.searchType === searchType)
      : history;

    // 1. Exact prefix matches (highest priority)
    for (const entry of filteredHistory) {
      if (entry.query.toLowerCase().startsWith(queryLower)) {
        suggestions.add(entry.query);
        if (suggestions.size >= limit) break;
      }
    }

    // 2. Word-based matches (medium priority)
    if (suggestions.size < limit) {
      for (const entry of filteredHistory) {
        const words = entry.query.toLowerCase().split(/\s+/);
        if (words.some(word => word.startsWith(queryLower))) {
          suggestions.add(entry.query);
          if (suggestions.size >= limit) break;
        }
      }
    }

    // 3. Contains matches (lower priority)
    if (suggestions.size < limit) {
      for (const entry of filteredHistory) {
        if (entry.query.toLowerCase().includes(queryLower)) {
          suggestions.add(entry.query);
          if (suggestions.size >= limit) break;
        }
      }
    }

    // 4. Selected result names (lowest priority)
    if (suggestions.size < limit) {
      for (const entry of filteredHistory) {
        if (entry.selectedResult?.name.toLowerCase().includes(queryLower)) {
          suggestions.add(entry.selectedResult.name);
          if (suggestions.size >= limit) break;
        }
      }
    }

    return Array.from(suggestions).slice(0, limit);
  }

  // ============================================================================
  // HISTORY MANAGEMENT
  // ============================================================================

  /**
   * Remove entry από history
   */
  removeFromHistory(entryId: string): boolean {
    const history = this.getHistory();
    const filtered = history.filter(entry => entry.id !== entryId);

    if (filtered.length !== history.length) {
      this.saveHistory(filtered);
      console.debug(`📚 Removed entry ${entryId} from search history`);
      return true;
    }

    return false;
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.analyticsKey);
    console.debug('📚 Search history cleared');
  }

  /**
   * Clear old entries (older than specified days)
   */
  clearOldEntries(olderThanDays = 30): number {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const history = this.getHistory();
    const filtered = history.filter(entry => entry.timestamp > cutoffTime);

    const removedCount = history.length - filtered.length;

    if (removedCount > 0) {
      this.saveHistory(filtered);
      console.debug(`📚 Removed ${removedCount} old entries from search history`);
    }

    return removedCount;
  }

  // ============================================================================
  // ANALYTICS METHODS
  // ============================================================================

  /**
   * Get search analytics
   */
  getAnalytics(): SearchAnalytics {
    try {
      const stored = localStorage.getItem(this.analyticsKey);
      if (!stored) return this.createEmptyAnalytics();

      const analytics = JSON.parse(stored) as SearchAnalytics;
      return this.validateAnalytics(analytics);

    } catch (error) {
      console.warn('Failed to load search analytics:', error);
      return this.createEmptyAnalytics();
    }
  }

  /**
   * Export history για backup/analysis
   */
  exportHistory(): {
    history: SearchHistoryEntry[];
    analytics: SearchAnalytics;
    exportedAt: number;
    version: string;
  } {
    return {
      history: this.getHistory(),
      analytics: this.getAnalytics(),
      exportedAt: Date.now(),
      version: '1.0'
    };
  }

  /**
   * Import history από backup
   */
  importHistory(data: {
    history?: SearchHistoryEntry[];
    analytics?: SearchAnalytics;
  }): { imported: number; skipped: number } {
    let imported = 0;
    let skipped = 0;

    if (data.history && Array.isArray(data.history)) {
      const existingHistory = this.getHistory();
      const existingIds = new Set(existingHistory.map(h => h.id));

      const newEntries = data.history.filter(entry => {
        if (!entry.id || existingIds.has(entry.id)) {
          skipped++;
          return false;
        }
        imported++;
        return true;
      });

      if (newEntries.length > 0) {
        const combined = [...existingHistory, ...newEntries]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, this.maxHistoryEntries);

        this.saveHistory(combined);
      }
    }

    if (data.analytics) {
      // Merge analytics (simplified - just replace for now)
      localStorage.setItem(this.analyticsKey, JSON.stringify(data.analytics));
    }

    console.debug(`📚 Imported ${imported} entries, skipped ${skipped}`);

    return { imported, skipped };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Save history to localStorage
   */
  private saveHistory(history: SearchHistoryEntry[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }

  /**
   * Update analytics με new search
   */
  private updateAnalytics(entry: SearchHistoryEntry): void {
    const analytics = this.getAnalytics();

    analytics.totalSearches++;

    if (entry.selectedResult) {
      analytics.successfulSearches++;
    }

    // Update popular queries
    const existingQuery = analytics.popularQueries.find(
      q => q.query.toLowerCase() === entry.query.toLowerCase()
    );

    if (existingQuery) {
      existingQuery.count++;
      existingQuery.successRate = existingQuery.count / analytics.totalSearches;
    } else {
      analytics.popularQueries.push({
        query: entry.query,
        count: 1,
        successRate: entry.selectedResult ? 1 : 0
      });
    }

    // Keep only top 20 popular queries
    analytics.popularQueries.sort((a, b) => b.count - a.count);
    analytics.popularQueries = analytics.popularQueries.slice(0, 20);

    // Update temporal patterns (simplified)
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sunday
    const month = now.getMonth(); // 0 = January

    analytics.temporalPatterns.hourly[hour]++;
    analytics.temporalPatterns.daily[day]++;
    analytics.temporalPatterns.monthly[month]++;

    // Calculate average response time
    if (entry.metadata?.duration) {
      const totalTime = analytics.averageResponseTime * (analytics.totalSearches - 1);
      analytics.averageResponseTime = (totalTime + entry.metadata.duration) / analytics.totalSearches;
    }

    // Save updated analytics
    try {
      localStorage.setItem(this.analyticsKey, JSON.stringify(analytics));
    } catch (error) {
      console.error('Failed to save search analytics:', error);
    }
  }

  /**
   * Create empty analytics structure
   */
  private createEmptyAnalytics(): SearchAnalytics {
    return {
      totalSearches: 0,
      successfulSearches: 0,
      averageResponseTime: 0,
      popularQueries: [],
      spatialDistribution: {},
      temporalPatterns: {
        hourly: new Array(24).fill(0),
        daily: new Array(7).fill(0),
        monthly: new Array(12).fill(0)
      }
    };
  }

  /**
   * Validate analytics structure
   */
  private validateAnalytics(analytics: SearchAnalytics): SearchAnalytics {
    const valid = this.createEmptyAnalytics();

    // Copy valid fields
    valid.totalSearches = typeof analytics.totalSearches === 'number' ? analytics.totalSearches : 0;
    valid.successfulSearches = typeof analytics.successfulSearches === 'number' ? analytics.successfulSearches : 0;
    valid.averageResponseTime = typeof analytics.averageResponseTime === 'number' ? analytics.averageResponseTime : 0;

    if (Array.isArray(analytics.popularQueries)) {
      valid.popularQueries = analytics.popularQueries;
    }

    if (analytics.spatialDistribution && typeof analytics.spatialDistribution === 'object') {
      valid.spatialDistribution = analytics.spatialDistribution;
    }

    if (analytics.temporalPatterns) {
      valid.temporalPatterns = {
        hourly: Array.isArray(analytics.temporalPatterns.hourly) && analytics.temporalPatterns.hourly.length === 24
          ? analytics.temporalPatterns.hourly
          : new Array(24).fill(0),
        daily: Array.isArray(analytics.temporalPatterns.daily) && analytics.temporalPatterns.daily.length === 7
          ? analytics.temporalPatterns.daily
          : new Array(7).fill(0),
        monthly: Array.isArray(analytics.temporalPatterns.monthly) && analytics.temporalPatterns.monthly.length === 12
          ? analytics.temporalPatterns.monthly
          : new Array(12).fill(0)
      };
    }

    return valid;
  }

  /**
   * Generate unique ID για history entry
   * 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
   */
  private generateId(): string {
    return generateSearchId();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton Search History Service instance
 */
export const searchHistoryService = new SearchHistoryService();

export default searchHistoryService;