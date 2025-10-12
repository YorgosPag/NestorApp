/**
 * 🏡 REAL ESTATE MATCHING HOOK - Phase 2.5.2
 *
 * React hook για εύκολη χρήση του real estate polygon matching
 * Χρησιμοποιεί το κεντρικοποιημένο polygon system
 *
 * @module services/real-estate-monitor/useRealEstateMatching
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  checkPropertyInRealEstatePolygons,
  checkMultiplePropertiesInRealEstatePolygons,
  getAlertableProperties,
  groupPropertyResultsByPolygon,
  type RealEstatePolygon,
  type PropertyLocation,
  type PropertyMatchResult
} from '@geo-alert/core';

// ============================================================================
// HOOK TYPES
// ============================================================================

interface UseRealEstateMatchingOptions {
  toleranceMeters?: number;
  batchSize?: number;
  autoAlert?: boolean;         // Automatically trigger alerts for matches
  onAlert?: (result: PropertyMatchResult) => void;
  onBatchComplete?: (results: PropertyMatchResult[]) => void;
}

interface UseRealEstateMatchingReturn {
  // State
  isProcessing: boolean;
  results: PropertyMatchResult[];
  alertableProperties: PropertyMatchResult[];
  groupedResults: Map<string, PropertyMatchResult[]>;
  error: string | null;

  // Actions
  checkProperty: (property: PropertyLocation, polygons: RealEstatePolygon[]) => PropertyMatchResult;
  checkMultipleProperties: (properties: PropertyLocation[], polygons: RealEstatePolygon[]) => Promise<void>;
  clearResults: () => void;
  getStatistics: () => {
    totalChecked: number;
    totalMatches: number;
    totalAlerts: number;
    averageConfidence: number;
    topPolygons: Array<{ polygonId: string; matchCount: number }>;
  };

  // Utilities
  exportResults: (format: 'json' | 'csv') => string;
  filterResultsByPolygon: (polygonId: string) => PropertyMatchResult[];
  filterResultsBySource: (source: PropertyLocation['source']) => PropertyMatchResult[];
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useRealEstateMatching(
  options: UseRealEstateMatchingOptions = {}
): UseRealEstateMatchingReturn {

  const {
    toleranceMeters = 100,
    batchSize = 50,
    autoAlert = false,
    onAlert,
    onBatchComplete
  } = options;

  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<PropertyMatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Derived state
  const alertableProperties = getAlertableProperties(results);
  const groupedResults = groupPropertyResultsByPolygon(results);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Check single property against polygons
   */
  const checkProperty = useCallback((
    property: PropertyLocation,
    polygons: RealEstatePolygon[]
  ): PropertyMatchResult => {
    try {
      setError(null);
      const result = checkPropertyInRealEstatePolygons(property, polygons, toleranceMeters);

      // Add to results
      setResults(prev => [...prev, result]);

      // Auto alert if enabled
      if (autoAlert && result.shouldAlert && onAlert) {
        onAlert(result);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error checking property:', err);

      // Return empty result
      return {
        property,
        matchedPolygons: [],
        shouldAlert: false
      };
    }
  }, [toleranceMeters, autoAlert, onAlert]);

  /**
   * Check multiple properties against polygons
   */
  const checkMultipleProperties = useCallback(async (
    properties: PropertyLocation[],
    polygons: RealEstatePolygon[]
  ): Promise<void> => {
    if (isProcessing) {
      console.warn('Already processing properties, skipping...');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      console.log(`🔍 Starting batch processing: ${properties.length} properties against ${polygons.length} polygons`);

      const batchResults = await checkMultiplePropertiesInRealEstatePolygons(
        properties,
        polygons,
        { toleranceMeters, batchSize }
      );

      // Add results
      setResults(prev => [...prev, ...batchResults]);

      // Trigger alerts for alertable properties
      if (autoAlert && onAlert) {
        const alertable = getAlertableProperties(batchResults);
        alertable.forEach(result => onAlert(result));
      }

      // Batch complete callback
      if (onBatchComplete) {
        onBatchComplete(batchResults);
      }

      console.log(`✅ Batch processing complete: ${batchResults.length} results, ${getAlertableProperties(batchResults).length} alerts`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Batch processing failed';
      setError(errorMessage);
      console.error('Error in batch processing:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, toleranceMeters, batchSize, autoAlert, onAlert, onBatchComplete]);

  /**
   * Clear all results
   */
  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  // ============================================================================
  // STATISTICS & UTILITIES
  // ============================================================================

  /**
   * Get processing statistics
   */
  const getStatistics = useCallback(() => {
    const totalChecked = results.length;
    const totalMatches = results.filter(r => r.matchedPolygons.length > 0).length;
    const totalAlerts = alertableProperties.length;

    // Calculate average confidence
    const confidenceSum = results.reduce((sum, result) => {
      const avgConfidence = result.matchedPolygons.length > 0
        ? result.matchedPolygons.reduce((s, m) => s + m.confidence, 0) / result.matchedPolygons.length
        : 0;
      return sum + avgConfidence;
    }, 0);
    const averageConfidence = totalChecked > 0 ? confidenceSum / totalChecked : 0;

    // Top polygons by match count
    const polygonCounts = new Map<string, number>();
    results.forEach(result => {
      result.matchedPolygons.forEach(match => {
        const polygonId = match.polygon.id;
        polygonCounts.set(polygonId, (polygonCounts.get(polygonId) || 0) + 1);
      });
    });

    const topPolygons = Array.from(polygonCounts.entries())
      .map(([polygonId, matchCount]) => ({ polygonId, matchCount }))
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 5);

    return {
      totalChecked,
      totalMatches,
      totalAlerts,
      averageConfidence,
      topPolygons
    };
  }, [results, alertableProperties]);

  /**
   * Export results in different formats
   */
  const exportResults = useCallback((format: 'json' | 'csv'): string => {
    if (format === 'json') {
      return JSON.stringify(results, null, 2);
    }

    // CSV format
    const headers = [
      'PropertyID', 'Address', 'Lat', 'Lng', 'Price', 'Size', 'Type', 'Source',
      'MatchedPolygons', 'ShouldAlert', 'AlertReason', 'ScrapedAt'
    ];

    const rows = results.map(result => [
      result.property.id,
      result.property.address,
      result.property.coordinates.lat,
      result.property.coordinates.lng,
      result.property.price || '',
      result.property.size || '',
      result.property.type || '',
      result.property.source,
      result.matchedPolygons.length,
      result.shouldAlert,
      result.alertReason || '',
      result.property.scrapedAt.toISOString()
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }, [results]);

  /**
   * Filter results by polygon
   */
  const filterResultsByPolygon = useCallback((polygonId: string): PropertyMatchResult[] => {
    return results.filter(result =>
      result.matchedPolygons.some(match => match.polygon.id === polygonId)
    );
  }, [results]);

  /**
   * Filter results by source
   */
  const filterResultsBySource = useCallback((source: PropertyLocation['source']): PropertyMatchResult[] => {
    return results.filter(result => result.property.source === source);
  }, [results]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Log statistics on results change (development)
  useEffect(() => {
    if (results.length > 0) {
      const stats = getStatistics();
      console.log('📊 Real Estate Matching Stats:', stats);
    }
  }, [results, getStatistics]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    isProcessing,
    results,
    alertableProperties,
    groupedResults,
    error,

    // Actions
    checkProperty,
    checkMultipleProperties,
    clearResults,
    getStatistics,

    // Utilities
    exportResults,
    filterResultsByPolygon,
    filterResultsBySource
  };
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Hook για real-time property monitoring
 */
export function useRealTimePropertyMonitoring(
  polygons: RealEstatePolygon[],
  options: UseRealEstateMatchingOptions = {}
) {
  const matching = useRealEstateMatching({
    ...options,
    autoAlert: true
  });

  const monitorProperty = useCallback((property: PropertyLocation) => {
    return matching.checkProperty(property, polygons);
  }, [matching.checkProperty, polygons]);

  const monitorProperties = useCallback((properties: PropertyLocation[]) => {
    return matching.checkMultipleProperties(properties, polygons);
  }, [matching.checkMultipleProperties, polygons]);

  return {
    ...matching,
    monitorProperty,
    monitorProperties
  };
}

/**
 * Hook για περιοδικό έλεγχο νέων ακινήτων
 */
export function usePeriodicPropertyCheck(
  getProperties: () => Promise<PropertyLocation[]>,
  polygons: RealEstatePolygon[],
  intervalMinutes = 30,
  options: UseRealEstateMatchingOptions = {}
) {
  const matching = useRealEstateMatching(options);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    setIsMonitoring(true);
    console.log(`🔄 Starting periodic property monitoring (every ${intervalMinutes} minutes)`);

    const interval = setInterval(async () => {
      try {
        const properties = await getProperties();
        console.log(`🏠 Checking ${properties.length} properties...`);

        await matching.checkMultipleProperties(properties, polygons);
        setLastCheck(new Date());
      } catch (error) {
        console.error('Periodic check failed:', error);
      }
    }, intervalMinutes * 60 * 1000);

    // Cleanup function
    return () => {
      clearInterval(interval);
      setIsMonitoring(false);
    };
  }, [isMonitoring, intervalMinutes, getProperties, polygons, matching]);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  return {
    ...matching,
    isMonitoring,
    lastCheck,
    startMonitoring,
    stopMonitoring
  };
}