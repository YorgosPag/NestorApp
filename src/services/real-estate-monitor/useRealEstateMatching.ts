/**
 * 🏡 REAL ESTATE MATCHING HOOK - Phase 2.5.2
 *
 * React hook για εύκολη χρήση του real estate polygon matching
 * Χρησιμοποιεί το κεντρικοποιημένο polygon system
 *
 * @module services/real-estate-monitor/useRealEstateMatching
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { getErrorMessage } from '@/lib/error-utils';
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
  realEstatePolygons: RealEstatePolygon[];

  // Actions
  checkProperty: (property: PropertyLocation, polygons: RealEstatePolygon[]) => PropertyMatchResult;
  checkMultipleProperties: (properties: PropertyLocation[], polygons: RealEstatePolygon[]) => Promise<void>;
  addRealEstatePolygon: (polygon: RealEstatePolygon) => void;
  removeRealEstatePolygon: (polygonId: string) => void;
  getRealEstateAlerts: () => RealEstatePolygon[];
  clearResults: () => void;
  getStatistics: () => {
    totalChecked: number;
    totalMatches: number;
    totalAlerts: number;
    averageConfidence: number;
    topPolygons: Array<{ polygonId: string; matchCount: number }>;
  };
  startPeriodicCheck: (intervalMinutes: number) => void;
  stopPeriodicCheck: () => void;

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
  const [realEstatePolygons, setRealEstatePolygons] = useState<RealEstatePolygon[]>([]);
  const periodicCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived state
  const alertableProperties = getAlertableProperties(results);
  const groupedResults = groupPropertyResultsByPolygon(results);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const startPeriodicCheck = useCallback((intervalMinutes: number) => {
    if (periodicCheckRef.current) return;
    const intervalMs = Math.max(intervalMinutes, 1) * 60 * 1000;
    periodicCheckRef.current = setInterval(() => {
      if (!autoAlert || !onAlert) return;
      const alertable = getAlertableProperties(results);
      alertable.forEach(result => onAlert(result));
    }, intervalMs);
  }, [autoAlert, onAlert, results]);

  const stopPeriodicCheck = useCallback(() => {
    if (!periodicCheckRef.current) return;
    clearInterval(periodicCheckRef.current);
    periodicCheckRef.current = null;
  }, []);

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
      const errorMessage = getErrorMessage(err, 'Unknown error occurred');
      setError(errorMessage);
      // Error logging removed //('Error checking property:', err);

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
      // Warning logging removed //('Already processing properties, skipping...');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Debug logging removed //(`🔍 Starting batch processing: ${properties.length} properties against ${polygons.length} polygons`);

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

      // Debug logging removed //(`✅ Batch processing complete: ${batchResults.length} results, ${getAlertableProperties(batchResults).length} alerts`);

    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Batch processing failed');
      setError(errorMessage);
      // Error logging removed //('Error in batch processing:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, toleranceMeters, batchSize, autoAlert, onAlert, onBatchComplete]);

  /**
   * Add real estate polygon for monitoring
   */
  const addRealEstatePolygon = useCallback((polygon: RealEstatePolygon) => {
    setRealEstatePolygons(prev => {
      // Check if polygon already exists
      const exists = prev.some(p => p.id === polygon.id);
      if (exists) {
        // Warning logging removed //('RealEstate polygon already exists:', polygon.id);
        return prev;
      }

      // Debug logging removed //('✅ Added real estate polygon for monitoring:', polygon.id);
      return [...prev, polygon];
    });
  }, []);

  /**
   * Remove real estate polygon from monitoring
   */
  const removeRealEstatePolygon = useCallback((polygonId: string) => {
    setRealEstatePolygons(prev => {
      const filtered = prev.filter(p => p.id !== polygonId);
      // Debug logging removed //('🗑️ Removed real estate polygon from monitoring:', polygonId);
      return filtered;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (periodicCheckRef.current) {
        clearInterval(periodicCheckRef.current);
        periodicCheckRef.current = null;
      }
    };
  }, []);

  /**
   * Get all real estate alert polygons
   */
  const getRealEstateAlerts = useCallback(() => {
    return realEstatePolygons.filter(p =>
      p.alertSettings?.enabled === true
    );
  }, [realEstatePolygons]);

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
      // Debug logging removed //('📊 Real Estate Matching Stats:', stats);
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
    realEstatePolygons,

    // Actions
    checkProperty,
    checkMultipleProperties,
    addRealEstatePolygon,
    removeRealEstatePolygon,
    getRealEstateAlerts,
    clearResults,
    getStatistics,
    startPeriodicCheck,
    stopPeriodicCheck,

    // Utilities
    exportResults,
    filterResultsByPolygon,
    filterResultsBySource
  };
}

