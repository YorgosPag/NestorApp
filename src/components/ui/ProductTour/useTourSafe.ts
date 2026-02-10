/**
 * =============================================================================
 * 🏢 ENTERPRISE: SAFE TOUR HOOK
 * =============================================================================
 *
 * Safe wrapper για useTour() που δεν σπάει αν λείπει TourProvider
 *
 * Pattern: Null Object Pattern (Gang of Four)
 * Enterprise: SAP/Salesforce/Microsoft - Graceful Degradation
 *
 * Use Case:
 * - Error boundaries που μπορεί να μην έχουν TourProvider
 * - Standalone components
 * - Global error pages
 *
 * Features:
 * - Returns dummy/no-op functions αν δεν υπάρχει TourProvider
 * - Δεν σπάει ποτέ
 * - Graceful degradation
 *
 * @file useTourSafe.ts
 * @created 2026-02-02
 */

import { useCallback } from 'react';
import type { UseTourReturn, TourConfig } from './ProductTour.types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useTourSafe');

/**
 * Safe wrapper για useTour() hook
 *
 * Enterprise Pattern: Null Object Pattern
 * - Αν υπάρχει TourProvider: κανονική λειτουργία
 * - Αν ΔΕΝ υπάρχει: επιστρέφει no-op functions (δεν σπάει!)
 *
 * @returns Tour utilities (safe - never throws)
 */
export function useTourSafe(): UseTourReturn {
  // Try to get context - graceful degradation
  try {
    // Dynamic import to avoid circular dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTour } = require('./useTour');
    return useTour();
  } catch (error) {
    // TourProvider not available - return no-op implementation
    // This is intentional - error boundaries should work without tours
    logger.warn(
      'TourProvider not available - using no-op implementation. ' +
      'This is expected for global-error.tsx and standalone components.'
    );

    // Null Object Pattern - safe dummy implementation
    return {
      isActive: false,
      currentStep: 0,
      totalSteps: 0,
      startTour: useCallback((config: TourConfig) => {
        // No-op - tours not available
        logger.info('startTour called but TourProvider not available', { tourId: config.tourId });
      }, []),
      shouldShowTour: useCallback((_tourId: string, _persistenceKey?: string) => {
        // Always return false - tours not available
        return false;
      }, []),
      resetTour: useCallback((persistenceKey: string) => {
        // No-op - nothing to reset
        logger.info('resetTour called but TourProvider not available', { persistenceKey });
      }, [])
    };
  }
}
