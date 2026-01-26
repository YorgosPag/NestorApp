/**
 * =============================================================================
 * 🏢 ENTERPRISE: Product Tour System - Custom Hook
 * =============================================================================
 *
 * @enterprise SAP/Microsoft/Salesforce Pattern - Easy Tour Integration
 *
 * This hook provides a simplified interface for starting and managing tours.
 * Use it in components that need to trigger tours programmatically.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { startTour, shouldShowTour } = useTour();
 *
 *   const handleHelpClick = () => {
 *     if (shouldShowTour('my-tour', 'my-tour-v1')) {
 *       startTour(myTourConfig);
 *     }
 *   };
 *
 *   return <Button onClick={handleHelpClick}>Help</Button>;
 * }
 * ```
 */

import { useCallback, useMemo } from 'react';
import { useTourContext } from './ProductTour.context';
import type { TourConfig, UseTourReturn } from './ProductTour.types';

/**
 * 🏢 ENTERPRISE: Simplified hook for tour operations
 *
 * Provides a clean API for:
 * - Starting tours
 * - Checking if tours should be shown
 * - Resetting tour persistence
 * - Accessing current tour state
 *
 * @returns Tour utilities and current state
 */
export function useTour(): UseTourReturn {
  const context = useTourContext();

  const {
    isActive,
    currentStepIndex,
    currentTour,
    startTour: contextStartTour,
    shouldShowTour: contextShouldShow,
    resetTourPersistence,
  } = context;

  /**
   * Start a tour with the given configuration
   */
  const startTour = useCallback(
    (config: TourConfig) => {
      contextStartTour(config);
    },
    [contextStartTour]
  );

  /**
   * Check if a tour should be shown (considering user's "don't show again" preference)
   */
  const shouldShowTour = useCallback(
    (tourId: string, persistenceKey?: string): boolean => {
      return contextShouldShow(tourId, persistenceKey);
    },
    [contextShouldShow]
  );

  /**
   * Reset a tour's persistence so it shows again
   */
  const resetTour = useCallback(
    (persistenceKey: string) => {
      resetTourPersistence(persistenceKey);
    },
    [resetTourPersistence]
  );

  /**
   * Total steps in current tour
   */
  const totalSteps = useMemo(() => {
    return currentTour?.steps.length ?? 0;
  }, [currentTour]);

  return {
    startTour,
    shouldShowTour,
    resetTour,
    isActive,
    currentStep: currentStepIndex,
    totalSteps,
  };
}

// =============================================================================
// FACTORY FUNCTION FOR TOUR CONFIGS
// =============================================================================

/**
 * 🏢 ENTERPRISE: Factory function to create tour configurations
 *
 * Ensures type safety and provides sensible defaults.
 *
 * @example
 * ```tsx
 * const myTour = createTourConfig({
 *   tourId: 'welcome-tour',
 *   steps: [
 *     {
 *       id: 'step-1',
 *       target: { type: 'id', value: 'main-nav' },
 *       titleKey: 'tour.welcome.nav.title',
 *       descriptionKey: 'tour.welcome.nav.description',
 *     },
 *   ],
 * });
 * ```
 */
export function createTourConfig(config: TourConfig): TourConfig {
  return {
    // Defaults
    showDontShowAgain: false,
    showStepIndicators: true,
    showSkipButton: true,

    // User config (overrides defaults)
    ...config,

    // Ensure steps have default values
    steps: config.steps.map((step) => ({
      position: 'bottom',
      spotlight: true,
      spotlightPadding: 8,
      disableClickOutside: false,
      ...step,
    })),
  };
}

// =============================================================================
// PREDEFINED TOUR STEP FACTORIES
// =============================================================================

/**
 * 🏢 ENTERPRISE: Create a tour step for a button element
 */
export function createButtonStep(
  id: string,
  buttonId: string,
  titleKey: string,
  descriptionKey: string,
  position: 'top' | 'bottom' | 'left' | 'right' = 'bottom'
) {
  return {
    id,
    target: { type: 'id' as const, value: buttonId },
    titleKey,
    descriptionKey,
    position,
    spotlight: true,
    spotlightPadding: 8,
  };
}

/**
 * 🏢 ENTERPRISE: Create a tour step for a section element
 */
export function createSectionStep(
  id: string,
  selector: string,
  titleKey: string,
  descriptionKey: string,
  position: 'top' | 'bottom' | 'left' | 'right' = 'bottom'
) {
  return {
    id,
    target: { type: 'selector' as const, value: selector },
    titleKey,
    descriptionKey,
    position,
    spotlight: true,
    spotlightPadding: 16, // Larger padding for sections
  };
}
