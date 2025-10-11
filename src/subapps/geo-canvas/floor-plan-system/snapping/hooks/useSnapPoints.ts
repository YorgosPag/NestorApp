/**
 * 📍 USE SNAP POINTS HOOK
 *
 * React hook για extraction και caching snap points από DXF
 *
 * @module floor-plan-system/snapping/hooks/useSnapPoints
 */

import { useMemo } from 'react';
import type { ParserResult } from '@/subapps/dxf-viewer/types/parser.types';
import { extractEndpoints, deduplicateSnapPoints } from '../engine';
import type { SnapPoint } from '../types';

/**
 * Hook return type
 */
export interface UseSnapPointsReturn {
  /** All snap points */
  snapPoints: SnapPoint[];
  /** Number of snap points */
  count: number;
  /** Are snap points ready? */
  isReady: boolean;
}

/**
 * useSnapPoints Hook
 *
 * Extracts και caches snap points από DXF ParserResult
 *
 * @param parserResult - DXF parser result
 * @param enabled - Is snap enabled? (default: true)
 * @returns Snap points collection
 */
export function useSnapPoints(
  parserResult: ParserResult | null,
  enabled: boolean = true
): UseSnapPointsReturn {
  // Extract snap points (memoized)
  const snapPoints = useMemo(() => {
    if (!enabled || !parserResult) {
      return [];
    }

    console.log('🔧 useSnapPoints: Extracting snap points from DXF...');

    // Extract endpoints
    const endpoints = extractEndpoints(parserResult);
    console.log(`📍 useSnapPoints: Extracted ${endpoints.length} endpoints`);

    // Deduplicate
    const unique = deduplicateSnapPoints(endpoints);
    console.log(`📍 useSnapPoints: ${unique.length} unique points after deduplication`);

    return unique;
  }, [parserResult, enabled]);

  return {
    snapPoints,
    count: snapPoints.length,
    isReady: snapPoints.length > 0
  };
}
