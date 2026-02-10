/**
 * =============================================================================
 * 🏢 ENTERPRISE: Product Tour System - Type Definitions
 * =============================================================================
 *
 * @enterprise SAP/Microsoft/Salesforce Pattern - Guided User Onboarding
 *
 * ADR-037: CANONICAL PRODUCT TOUR COMPONENT
 * Decision: Single centralized ProductTour system for all guided experiences
 *
 * Features:
 * - Full TypeScript (ZERO any)
 * - i18n ready (all strings via translation keys)
 * - Accessibility (ARIA, keyboard navigation)
 * - Persistence (localStorage for "don't show again")
 * - Analytics hooks
 *
 * @see https://www.nngroup.com/articles/feature-adoption-onboarding/
 * @see https://www.pendo.io/glossary/product-tour/
 */

import type { ReactNode } from 'react';

// =============================================================================
// TOUR STEP TYPES
// =============================================================================

/**
 * Position of the tooltip relative to the target element
 * Following Floating UI naming convention
 */
export type TourTooltipPosition =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end';

/**
 * Target element identifier strategy
 */
export type TourTargetStrategy =
  | { type: 'id'; value: string }
  | { type: 'selector'; value: string }
  | { type: 'ref'; value: React.RefObject<HTMLElement | null> };

/**
 * Single step in a product tour
 */
export interface TourStep {
  /** Unique identifier for this step */
  id: string;

  /** Target element to highlight - can be ID, CSS selector, or React ref */
  target: TourTargetStrategy;

  /**
   * i18n key for the step title
   * @example "productTour.errorDialog.step1.title"
   */
  titleKey: string;

  /**
   * i18n key for the step description
   * @example "productTour.errorDialog.step1.description"
   */
  descriptionKey: string;

  /** Position of tooltip relative to target */
  position?: TourTooltipPosition;

  /** Optional custom content (for advanced use cases) */
  customContent?: ReactNode;

  /**
   * Optional action when step becomes active
   * Use for scrolling into view, animations, etc.
   */
  onStepEnter?: () => void;

  /** Optional action when leaving this step */
  onStepExit?: () => void;

  /**
   * If true, clicking outside won't advance to next step
   * Useful for required interactions
   */
  disableClickOutside?: boolean;

  /**
   * If true, the target element will be highlighted with a spotlight effect
   * Default: true
   */
  spotlight?: boolean;

  /**
   * Custom spotlight padding around the target element
   * Default: 8
   */
  spotlightPadding?: number;
}

// =============================================================================
// TOUR CONFIGURATION
// =============================================================================

/**
 * Complete tour configuration
 */
export interface TourConfig {
  /** Unique identifier for this tour */
  tourId: string;

  /** Array of steps in order */
  steps: TourStep[];

  /**
   * localStorage key for persistence
   * If provided, "don't show again" preference will be saved
   */
  persistenceKey?: string;

  /**
   * Whether to show "Don't show again" checkbox
   * Default: false
   */
  showDontShowAgain?: boolean;

  /**
   * Whether to show step indicators (1/5, 2/5, etc.)
   * Default: true
   */
  showStepIndicators?: boolean;

  /**
   * Whether to show skip button
   * Default: true
   */
  showSkipButton?: boolean;

  /**
   * Callback when tour completes (all steps done)
   */
  onComplete?: () => void;

  /**
   * Callback when tour is skipped
   */
  onSkip?: () => void;

  /**
   * Callback when tour is dismissed (X button)
   */
  onDismiss?: () => void;

  /**
   * Analytics callback for tracking tour events
   * @param event - Event type
   * @param data - Event data (step info, etc.)
   */
  onAnalyticsEvent?: (event: TourAnalyticsEvent, data: TourAnalyticsData) => void;
}

// =============================================================================
// ANALYTICS TYPES
// =============================================================================

/**
 * Analytics event types for tracking user engagement
 */
export type TourAnalyticsEvent =
  | 'tour_started'
  | 'tour_completed'
  | 'tour_skipped'
  | 'tour_dismissed'
  | 'step_viewed'
  | 'step_completed'
  | 'dont_show_again_checked';

/**
 * Analytics event data
 */
export interface TourAnalyticsData {
  tourId: string;
  stepId?: string;
  stepIndex?: number;
  totalSteps?: number;
  timestamp: number;
}

// =============================================================================
// CONTEXT & STATE TYPES
// =============================================================================

/**
 * Tour state managed by context
 */
export interface TourState {
  /** Whether tour is currently active */
  isActive: boolean;

  /** Current step index (0-based) */
  currentStepIndex: number;

  /** Current tour configuration (if active) */
  currentTour: TourConfig | null;

  /** Whether "don't show again" is checked */
  dontShowAgain: boolean;

  /** Loading state for async operations */
  isLoading: boolean;
}

/**
 * Tour actions available through context
 */
export interface TourActions {
  /** Start a tour */
  startTour: (config: TourConfig) => void;

  /** Go to next step */
  nextStep: () => void;

  /** Go to previous step */
  prevStep: () => void;

  /** Jump to specific step */
  goToStep: (index: number) => void;

  /** End tour (complete or dismiss) */
  endTour: (reason: 'complete' | 'skip' | 'dismiss') => void;

  /** Toggle "don't show again" */
  setDontShowAgain: (value: boolean) => void;

  /** Check if a specific tour should be shown (considering persistence) */
  shouldShowTour: (tourId: string, persistenceKey?: string) => boolean;

  /** Reset persistence for a tour (show it again) */
  resetTourPersistence: (persistenceKey: string) => void;
}

/**
 * Complete tour context value
 */
export interface TourContextValue extends TourState, TourActions {}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

/**
 * Props for the main ProductTour component
 */
export interface ProductTourProps {
  /** Tour configuration */
  config: TourConfig;

  /** Whether to start immediately on mount */
  autoStart?: boolean;

  /** Children to render (tour provider wraps these) */
  children?: ReactNode;
}

/**
 * Props for the TourTooltip component
 */
export interface TourTooltipProps {
  /** Current step to display */
  step: TourStep;

  /** Current step index */
  stepIndex: number;

  /** Total number of steps */
  totalSteps: number;

  /** Whether this is the last step */
  isLastStep: boolean;

  /** Whether this is the first step */
  isFirstStep: boolean;

  /** Show "don't show again" checkbox */
  showDontShowAgain?: boolean;

  /** Show step indicators */
  showStepIndicators?: boolean;

  /** Show skip button */
  showSkipButton?: boolean;

  /** Callback for next button */
  onNext: () => void;

  /** Callback for previous button */
  onPrev: () => void;

  /** Callback for skip button */
  onSkip: () => void;

  /** Callback for close button */
  onClose: () => void;

  /** Callback for "don't show again" toggle */
  onDontShowAgainChange: (checked: boolean) => void;

  /** Current "don't show again" value */
  dontShowAgain: boolean;
}

/**
 * Props for the spotlight overlay
 */
export interface TourSpotlightProps {
  /** Target element to highlight */
  targetElement: HTMLElement | null;

  /** Padding around the spotlight */
  padding?: number;

  /** Whether spotlight is visible */
  visible: boolean;

  /** Click handler for backdrop (to dismiss or advance) */
  onBackdropClick?: () => void;
}

// =============================================================================
// HOOK TYPES
// =============================================================================

/**
 * Return type for useTour hook
 */
export interface UseTourReturn {
  /** Start a tour with the given configuration */
  startTour: (config: TourConfig) => void;

  /** Check if a tour should be shown (not dismissed by user) */
  shouldShowTour: (tourId: string, persistenceKey?: string) => boolean;

  /** Reset a tour so it shows again */
  resetTour: (persistenceKey: string) => void;

  /** Current tour state */
  isActive: boolean;

  /** Current step index */
  currentStep: number;

  /** Total steps in current tour */
  totalSteps: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Computed position for tooltip rendering
 */
export interface ComputedTooltipPosition {
  x: number;
  y: number;
  placement: TourTooltipPosition;
  arrowX?: number;
  arrowY?: number;
}

/**
 * Target element dimensions for spotlight calculation
 */
export interface TargetDimensions {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

/**
 * CSS custom properties for tour styling
 * All values come from design-tokens.json
 */
export interface TourCSSVariables {
  '--tour-z-index': string;
  '--tour-backdrop-color': string;
  '--tour-spotlight-radius': string;
  '--tour-tooltip-bg': string;
  '--tour-tooltip-shadow': string;
}
