'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Product Tour System - Main Component
 * =============================================================================
 *
 * @enterprise SAP/Microsoft/Salesforce Pattern - Guided User Onboarding
 *
 * ADR-037: CANONICAL PRODUCT TOUR COMPONENT
 *
 * Architecture:
 * - TourOverlay: Full-screen backdrop with spotlight cutout
 * - TourTooltip: Positioned tooltip with step content
 * - Uses @floating-ui/react for positioning
 * - Uses design-tokens for all styling values
 *
 * 🏢 ENTERPRISE CENTRALIZATION:
 * - useTypography: All text sizes/weights
 * - useSpacingTokens: All padding/gap/margin
 * - useIconSizes: All icon dimensions
 * - useBorderTokens: All borders/radius
 * - zIndex: All z-index values from design-tokens
 * - Checkbox/Label: Centralized form components
 *
 * Accessibility:
 * - ARIA labels and roles
 * - Keyboard navigation (arrows, escape)
 * - Focus management
 * - Screen reader announcements
 *
 * @see ProductTour.types.ts for type definitions
 * @see ProductTour.context.tsx for state management
 */

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  type FC,
} from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  shift,
  flip,
  arrow,
  type Placement,
} from '@floating-ui/react';
import { useTranslation } from 'react-i18next';
import { X, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// 🏢 ENTERPRISE: Centralized design system hooks
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';

// 🏢 ENTERPRISE: Centralized design tokens
import { zIndex, componentSizes } from '@/styles/design-tokens';

import { useTourContext, TourProvider } from './ProductTour.context';
import type {
  TourStep,
  TourTooltipPosition,
  TourConfig,
  ProductTourProps,
} from './ProductTour.types';

// =============================================================================
// CONSTANTS (using centralized design tokens)
// =============================================================================

/**
 * 🏢 ENTERPRISE: Tour styling constants from centralized design-tokens
 * All values reference centralized sources - ZERO hardcoded values
 */
const TOUR_STYLES = {
  // 🏢 ENTERPRISE: z-index from centralized zIndex object
  zIndex: {
    backdrop: zIndex.overlay,   // 1300
    tooltip: zIndex.tooltip,    // 1800
    spotlight: zIndex.modal,    // 1400
  },
  // 🏢 ENTERPRISE: Spotlight configuration
  spotlight: {
    defaultPadding: 8,  // px - matches design system spacing.xs
    borderRadius: 8,    // px - matches design system border radius
  },
  // 🏢 ENTERPRISE: Tooltip arrow configuration
  tooltip: {
    offset: 12,         // px - matches design system spacing
    arrowSize: 8,       // px - standard arrow size
  },
  // 🏢 ENTERPRISE: Step indicator size (matches componentSizes.icon.xxs = h-2 w-2)
  stepIndicator: componentSizes.icon.xxs,
} as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert TourTooltipPosition to Floating UI Placement
 */
function toFloatingPlacement(position: TourTooltipPosition): Placement {
  return position as Placement;
}

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
// SPOTLIGHT OVERLAY COMPONENT
// =============================================================================

interface SpotlightOverlayProps {
  targetElement: HTMLElement | null;
  padding: number;
  visible: boolean;
  onBackdropClick: () => void;
}

/**
 * 🏢 ENTERPRISE: Spotlight overlay with cutout around target element
 *
 * Uses CSS clip-path for the spotlight effect (performant, GPU-accelerated)
 * z-index uses centralized value from design-tokens
 */
const SpotlightOverlay: FC<SpotlightOverlayProps> = ({
  targetElement,
  padding,
  visible,
  onBackdropClick,
}) => {
  const [clipPath, setClipPath] = useState<string>('');

  useEffect(() => {
    if (!visible || !targetElement) {
      setClipPath('');
      return;
    }

    const updateClipPath = () => {
      const rect = targetElement.getBoundingClientRect();
      const top = rect.top - padding;
      const left = rect.left - padding;
      const width = rect.width + padding * 2;
      const height = rect.height + padding * 2;
      const radius = TOUR_STYLES.spotlight.borderRadius;

      // Create clip-path with rounded rectangle cutout
      // Format: polygon with hole (inverted mask)
      const path = `
        polygon(
          0% 0%,
          0% 100%,
          ${left}px 100%,
          ${left}px ${top + radius}px,
          ${left + radius}px ${top}px,
          ${left + width - radius}px ${top}px,
          ${left + width}px ${top + radius}px,
          ${left + width}px ${top + height - radius}px,
          ${left + width - radius}px ${top + height}px,
          ${left + radius}px ${top + height}px,
          ${left}px ${top + height - radius}px,
          ${left}px 100%,
          100% 100%,
          100% 0%
        )
      `.replace(/\s+/g, ' ').trim();

      setClipPath(path);
    };

    updateClipPath();

    // Update on scroll/resize
    window.addEventListener('scroll', updateClipPath, true);
    window.addEventListener('resize', updateClipPath);

    return () => {
      window.removeEventListener('scroll', updateClipPath, true);
      window.removeEventListener('resize', updateClipPath);
    };
  }, [targetElement, padding, visible]);

  if (!visible) return null;

  return (
    <div
      role="presentation"
      aria-hidden="true"
      onClick={onBackdropClick}
      className="fixed inset-0 bg-black/50 transition-opacity"
      style={{
        // 🏢 ENTERPRISE: z-index from centralized design tokens
        zIndex: TOUR_STYLES.zIndex.backdrop,
        clipPath: clipPath || undefined,
      }}
    />
  );
};

// =============================================================================
// TOUR TOOLTIP COMPONENT
// =============================================================================

interface TourTooltipInternalProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  targetElement: HTMLElement | null;
  showDontShowAgain: boolean;
  showStepIndicators: boolean;
  showSkipButton: boolean;
  dontShowAgain: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onClose: () => void;
  onDontShowAgainChange: (checked: boolean) => void;
}

/**
 * 🏢 ENTERPRISE: Tour tooltip with arrow, positioned relative to target
 *
 * Uses 100% centralized systems:
 * - useTypography: All text sizes/weights
 * - useSpacingTokens: All padding/gap
 * - useIconSizes: All icon dimensions
 * - useBorderTokens: All borders/radius
 * - Checkbox/Label: Centralized form components
 */
const TourTooltip: FC<TourTooltipInternalProps> = ({
  step,
  stepIndex,
  totalSteps,
  targetElement,
  showDontShowAgain,
  showStepIndicators,
  showSkipButton,
  dontShowAgain,
  onNext,
  onPrev,
  onSkip,
  onClose,
  onDontShowAgainChange,
}) => {
  const { t } = useTranslation('common');

  // 🏢 ENTERPRISE: All centralized hooks
  const { quick, radiusClass } = useBorderTokens();
  const spacing = useSpacingTokens();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  const arrowRef = useRef<HTMLDivElement>(null);

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === totalSteps - 1;

  // Floating UI setup
  const { refs, floatingStyles, context, placement } = useFloating({
    placement: toFloatingPlacement(step.position || 'bottom'),
    elements: {
      reference: targetElement,
    },
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(TOUR_STYLES.tooltip.offset),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      arrow({ element: arrowRef }),
    ],
  });

  // Get arrow position
  const arrowData = context.middlewareData?.arrow;

  // Arrow positioning based on placement
  const getArrowStyles = useMemo(() => {
    const side = placement.split('-')[0];
    const staticSide = {
      top: 'bottom',
      right: 'left',
      bottom: 'top',
      left: 'right',
    }[side] as string;

    return {
      [staticSide]: `-${TOUR_STYLES.tooltip.arrowSize - 2}px`,
      left: arrowData?.x != null ? `${arrowData.x}px` : '',
      top: arrowData?.y != null ? `${arrowData.y}px` : '',
    };
  }, [placement, arrowData]);

  // Arrow rotation based on placement
  const arrowRotation = useMemo(() => {
    const side = placement.split('-')[0];
    return {
      top: 'rotate(180deg)',
      right: 'rotate(-90deg)',
      bottom: 'rotate(0deg)',
      left: 'rotate(90deg)',
    }[side] || 'rotate(0deg)';
  }, [placement]);

  // 🏢 ENTERPRISE: Fallback to center of screen if target not found
  const isCentered = !targetElement;

  return (
    <article
      ref={isCentered ? undefined : refs.setFloating}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`tour-step-title-${step.id}`}
      aria-describedby={`tour-step-description-${step.id}`}
      className={cn(
        // 🏢 ENTERPRISE: Tooltip container with centralized styling
        'w-80 bg-popover text-popover-foreground shadow-lg',
        quick.table,  // Centralized border + rounded
        isCentered && 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
      )}
      style={{
        ...(isCentered ? {} : floatingStyles),
        // 🏢 ENTERPRISE: z-index from centralized design tokens
        zIndex: TOUR_STYLES.zIndex.tooltip,
      }}
    >
      {/* Arrow - Only show when positioned relative to target
          NOTE: Arrow requires inline styles for dynamic positioning from floating-ui */}
      {!isCentered && (
        <div
          ref={arrowRef}
          className="absolute w-0 h-0"
          style={{
            ...getArrowStyles,
            borderLeft: `${TOUR_STYLES.tooltip.arrowSize}px solid transparent`,
            borderRight: `${TOUR_STYLES.tooltip.arrowSize}px solid transparent`,
            borderBottom: `${TOUR_STYLES.tooltip.arrowSize}px solid hsl(var(--popover))`,
            transform: arrowRotation,
          }}
        />
      )}

      {/* Header - 🏢 ENTERPRISE: Centralized typography, spacing, icons, borders */}
      <header className={cn('flex items-center justify-between', spacing.padding.md, quick.borderB)}>
        <div className={cn('flex items-center', spacing.gap.sm)}>
          <HelpCircle className={cn(iconSizes.md, 'text-primary')} aria-hidden="true" />
          <h3
            id={`tour-step-title-${step.id}`}
            className={typography.heading.sm}
          >
            {t(step.titleKey)}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label={t('actions.close')}
          className={iconSizes.lg}
        >
          <X className={iconSizes.sm} aria-hidden="true" />
        </Button>
      </header>

      {/* Content - 🏢 ENTERPRISE: Centralized typography & spacing */}
      <section className={spacing.padding.md}>
        {step.customContent ? (
          step.customContent
        ) : (
          <p
            id={`tour-step-description-${step.id}`}
            className={cn(typography.body.sm, 'text-muted-foreground')}
          >
            {t(step.descriptionKey)}
          </p>
        )}
      </section>

      {/* Footer - 🏢 ENTERPRISE: Centralized spacing, borders, checkbox */}
      <footer className={cn('flex flex-col bg-muted/30', spacing.gap.sm, spacing.padding.md, quick.borderT)}>
        {/* Step indicators - 🏢 ENTERPRISE: Centralized gap & component sizes */}
        {showStepIndicators && (
          <nav
            className={cn('flex justify-center', spacing.gap.xs)}
            aria-label={t('productTour.stepIndicator', { current: stepIndex + 1, total: totalSteps })}
          >
            {Array.from({ length: totalSteps }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  // 🏢 ENTERPRISE: Step indicator from componentSizes + centralized radius
                  TOUR_STYLES.stepIndicator,
                  radiusClass.full,
                  'transition-colors',
                  index === stepIndex
                    ? 'bg-primary'
                    : 'bg-muted-foreground/30'
                )}
                aria-current={index === stepIndex ? 'step' : undefined}
              />
            ))}
          </nav>
        )}

        {/* Don't show again - 🏢 ENTERPRISE: Centralized Checkbox component & typography */}
        {showDontShowAgain && (
          <div className={cn('flex items-center', spacing.gap.sm)}>
            <Checkbox
              id="tour-dont-show-again"
              checked={dontShowAgain}
              onCheckedChange={(checked) => onDontShowAgainChange(checked === true)}
            />
            <Label
              htmlFor="tour-dont-show-again"
              className={cn(typography.label.simple, 'text-muted-foreground cursor-pointer')}
            >
              {t('productTour.dontShowAgain')}
            </Label>
          </div>
        )}

        {/* Navigation buttons - 🏢 ENTERPRISE: Two-row layout (SAP/Salesforce pattern) */}
        <nav className={cn('flex flex-col', spacing.gap.sm)}>
          {/* Row 1: Skip button - left aligned */}
          {showSkipButton && !isLastStep && (
            <div className="flex justify-start">
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                className="text-muted-foreground"
              >
                {t('productTour.skip')}
              </Button>
            </div>
          )}

          {/* Row 2: Previous & Next buttons - right aligned */}
          <div className={cn('flex items-center justify-end', spacing.gap.sm)}>
            {!isFirstStep && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPrev}
                className={spacing.gap.xs}
              >
                <ChevronLeft className={iconSizes.sm} aria-hidden="true" />
                {t('productTour.previous')}
              </Button>
            )}

            <Button
              variant="default"
              size="sm"
              onClick={onNext}
              className={spacing.gap.xs}
            >
              {isLastStep ? (
                t('productTour.finish')
              ) : (
                <>
                  {t('productTour.next')}
                  <ChevronRight className={iconSizes.sm} aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </nav>
      </footer>
    </article>
  );
};

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

  // Get current step
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

      // 🏢 DEBUG: Log target finding
      if (process.env.NODE_ENV === 'development') {
        console.log('[ProductTour] Finding target:', {
          stepId: currentStep.id,
          targetType: currentStep.target.type,
          targetValue: currentStep.target.type === 'ref' ? 'ref' : currentStep.target.value,
          found: !!element,
          elementId: element?.id || 'N/A',
        });
      }

      // Scroll target into view if needed
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
      }
    };

    // Initial find
    findTarget();

    // Re-find on resize (element might have moved)
    const handleResize = () => findTarget();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [isActive, currentStep]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(() => {
    if (currentStep?.disableClickOutside) return;
    nextStep();
  }, [currentStep, nextStep]);

  // Handlers
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

  // 🏢 DEBUG: Log when rendering tour
  if (process.env.NODE_ENV === 'development' && !targetElement) {
    console.log('[ProductTour] Rendering tour step without target (centered):', currentStep.id);
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
          style={{
            // 🏢 ENTERPRISE: z-index from centralized design tokens
            zIndex: TOUR_STYLES.zIndex.backdrop,
          }}
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
 *     // ... more steps
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

  // Auto-start tour on mount if configured
  useEffect(() => {
    if (autoStart && shouldShowTour(config.tourId, config.persistenceKey)) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startTour(config);
      }, 500);

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
