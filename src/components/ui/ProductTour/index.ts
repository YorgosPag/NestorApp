/**
 * =============================================================================
 * 🏢 ENTERPRISE: Product Tour System - Public API
 * =============================================================================
 *
 * @enterprise SAP/Microsoft/Salesforce Pattern - Guided User Onboarding
 *
 * ADR-037: CANONICAL PRODUCT TOUR COMPONENT
 *
 * This is the SINGLE SOURCE OF TRUTH for all guided tour functionality.
 * All components requiring product tours MUST use this module.
 *
 * PROHIBITION: Creating alternative tour/spotlight/coach-mark implementations
 *              is STRICTLY FORBIDDEN. Extend this system instead.
 *
 * @example Basic Usage:
 * ```tsx
 * // In layout.tsx or _app.tsx
 * import { TourProvider, TourRenderer } from '@/components/ui/ProductTour';
 *
 * export default function Layout({ children }) {
 *   return (
 *     <TourProvider>
 *       {children}
 *       <TourRenderer />
 *     </TourProvider>
 *   );
 * }
 * ```
 *
 * @example Starting a tour:
 * ```tsx
 * import { useTour, createTourConfig } from '@/components/ui/ProductTour';
 *
 * function MyComponent() {
 *   const { startTour } = useTour();
 *
 *   const tourConfig = createTourConfig({
 *     tourId: 'feature-tour',
 *     steps: [
 *       {
 *         id: 'step-1',
 *         target: { type: 'id', value: 'my-button' },
 *         titleKey: 'tour.feature.step1.title',
 *         descriptionKey: 'tour.feature.step1.description',
 *       },
 *     ],
 *   });
 *
 *   return <Button onClick={() => startTour(tourConfig)}>Show Tour</Button>;
 * }
 * ```
 */

// =============================================================================
// COMPONENTS
// =============================================================================

export { ProductTour, TourProvider, TourRenderer } from './ProductTour';

// =============================================================================
// HOOKS
// =============================================================================

export { useTour, createTourConfig, createButtonStep, createSectionStep } from './useTour';
export { useTourContext } from './ProductTour.context';

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Step types
  TourStep,
  TourTooltipPosition,
  TourTargetStrategy,

  // Configuration
  TourConfig,
  ProductTourProps,

  // State & Context
  TourState,
  TourActions,
  TourContextValue,

  // Analytics
  TourAnalyticsEvent,
  TourAnalyticsData,

  // Hook return type
  UseTourReturn,

  // Internal types (for extension)
  TourTooltipProps,
  TourSpotlightProps,
  ComputedTooltipPosition,
  TargetDimensions,
} from './ProductTour.types';
