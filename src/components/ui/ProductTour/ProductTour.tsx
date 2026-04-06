'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Product Tour System - Main Component
 * =============================================================================
 *
 * @enterprise SAP/Microsoft/Salesforce Pattern - Guided User Onboarding
 * ADR-037: CANONICAL PRODUCT TOUR COMPONENT
 *
 * Sub-components (SpotlightOverlay, TourTooltip) extracted to
 * product-tour-overlay.tsx for SRP compliance (ADR-065).
 *
 * @see ProductTour.types.ts for type definitions
 * @see ProductTour.context.tsx for state management
 * @see product-tour-overlay.tsx for SpotlightOverlay & TourTooltip
 */

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  type FC,
} from 'react';

import { createModuleLogger } from '@/lib/telemetry';
import { useTourContext, TourProvider } from './ProductTour.context';
import type { TourStep, ProductTourProps } from './ProductTour.types';
import { TOUR_STYLES } from './product-tour-constants';
import { SpotlightOverlay, TourTooltip } from './product-tour-overlay';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get target element from TourTargetStrategy
 */
function getTargetElement(target: TourStep['target']): HTMLElement | null {
  if (typeof window === 'undefined') return null;

  switch (target.type) {
    case 'id':
      return document.getElementById(target.value);
    case 'selector':
      return document.querySelector(target.value);
    case 'ref':
      return target.value.current;
    default:
      return null;
  }
}

// =============================================================================
// TOUR RENDERER (Internal)
// =============================================================================

/**
 * Internal component that renders the active tour
 */
const TourRenderer: FC = () => {
  const {
    isActive,
    currentStepIndex,
    currentTour,
    dontShowAgain,
    nextStep,
    prevStep,
    endTour,
    setDontShowAgain,
  } = useTourContext();

  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  const currentStep = useMemo(() => {
    if (!currentTour) return null;
    return currentTour.steps[currentStepIndex] || null;
  }, [currentTour, currentStepIndex]);

  // Find and track target element
  useEffect(() => {
    if (!isActive || !currentStep) {
      setTargetElement(null);
      return;
    }

    const findTarget = () => {
      const element = getTargetElement(currentStep.target);
      setTargetElement(element);

      if (process.env.NODE_ENV === 'development') {
        createModuleLogger('ProductTour').info('Finding target', {
          stepId: currentStep.id,
          targetType: currentStep.target.type,
          targetValue: currentStep.target.type === 'ref' ? 'ref' : currentStep.target.value,
          found: !!element,
          elementId: element?.id || 'N/A',
        });
      }

      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    };

    findTarget();

    const handleResize = () => findTarget();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isActive, currentStep]);

  const handleBackdropClick = useCallback(() => {
    if (currentStep?.disableClickOutside) return;
    nextStep();
  }, [currentStep, nextStep]);

  const handleNext = useCallback(() => nextStep(), [nextStep]);
  const handlePrev = useCallback(() => prevStep(), [prevStep]);
  const handleSkip = useCallback(() => endTour('skip'), [endTour]);
  const handleClose = useCallback(() => endTour('dismiss'), [endTour]);
  const handleDontShowAgainChange = useCallback(
    (checked: boolean) => setDontShowAgain(checked),
    [setDontShowAgain]
  );

  if (!isActive || !currentTour || !currentStep) return null;

  const spotlightEnabled = currentStep.spotlight !== false;
  const spotlightPadding = currentStep.spotlightPadding ?? TOUR_STYLES.spotlight.defaultPadding;

  if (process.env.NODE_ENV === 'development' && !targetElement) {
    createModuleLogger('ProductTour').info('Rendering tour step without target (centered)', { stepId: currentStep.id });
  }

  return (
    <>
      {/* Spotlight overlay - only show if we have a target element */}
      {targetElement && (
        <SpotlightOverlay
          targetElement={spotlightEnabled ? targetElement : null}
          padding={spotlightPadding}
          visible={spotlightEnabled}
          onBackdropClick={handleBackdropClick}
        />
      )}

      {/* Backdrop without spotlight - show when no target found */}
      {!targetElement && (
        <div
          role="presentation"
          aria-hidden="true"
          onClick={handleBackdropClick}
          className="fixed inset-0 bg-black/50 transition-opacity"
          style={{ zIndex: TOUR_STYLES.zIndex.backdrop }}
        />
      )}

      {/* Tooltip */}
      <TourTooltip
        step={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={currentTour.steps.length}
        targetElement={targetElement}
        showDontShowAgain={currentTour.showDontShowAgain ?? false}
        showStepIndicators={currentTour.showStepIndicators ?? true}
        showSkipButton={currentTour.showSkipButton ?? true}
        dontShowAgain={dontShowAgain}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
        onClose={handleClose}
        onDontShowAgainChange={handleDontShowAgainChange}
      />
    </>
  );
};

// =============================================================================
// MAIN PRODUCT TOUR COMPONENT
// =============================================================================

/**
 * 🏢 ENTERPRISE: ProductTour Component
 *
 * Renders a guided tour with spotlight highlighting and positioned tooltips.
 *
 * @example
 * ```tsx
 * const tourConfig: TourConfig = {
 *   tourId: 'error-dialog-tour',
 *   steps: [
 *     {
 *       id: 'step-1',
 *       target: { type: 'id', value: 'retry-button' },
 *       titleKey: 'productTour.errorDialog.retry.title',
 *       descriptionKey: 'productTour.errorDialog.retry.description',
 *       position: 'bottom',
 *     },
 *   ],
 *   persistenceKey: 'error-dialog-tour-v1',
 *   showDontShowAgain: true,
 * };
 *
 * <ProductTour config={tourConfig} autoStart />
 * ```
 */
export const ProductTour: FC<ProductTourProps> = ({
  config,
  autoStart = false,
  children,
}) => {
  const { startTour, shouldShowTour } = useTourContext();

  useEffect(() => {
    if (autoStart && shouldShowTour(config.tourId, config.persistenceKey)) {
      const timer = setTimeout(() => { startTour(config); }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoStart, config, startTour, shouldShowTour]);

  return <>{children}</>;
};

ProductTour.displayName = 'ProductTour';

// =============================================================================
// EXPORTS
// =============================================================================

export { TourProvider, TourRenderer };
export { useTourContext } from './ProductTour.context';
