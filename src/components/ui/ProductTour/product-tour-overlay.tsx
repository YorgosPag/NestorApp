'use client';

/**
 * @module ProductTour/product-tour-overlay
 * @description SpotlightOverlay + TourTooltip sub-components for ProductTour.
 * Extracted from ProductTour.tsx for SRP compliance (ADR-065).
 *
 * @see ProductTour.tsx for the main component and TourRenderer
 */

import {
  useRef,
  useMemo,
  useState,
  useEffect,
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

import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';

import type { TourStep, TourTooltipPosition } from './ProductTour.types';
import { TOUR_STYLES } from './product-tour-constants';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function toFloatingPlacement(position: TourTooltipPosition): Placement {
  return position as Placement;
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
 * Spotlight overlay with cutout around target element.
 * Uses CSS clip-path (performant, GPU-accelerated).
 */
export const SpotlightOverlay: FC<SpotlightOverlayProps> = ({
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
        zIndex: TOUR_STYLES.zIndex.backdrop,
        clipPath: clipPath || undefined,
      }}
    />
  );
};

// =============================================================================
// TOUR TOOLTIP COMPONENT
// =============================================================================

export interface TourTooltipInternalProps {
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
 * Tour tooltip with arrow, positioned relative to target using @floating-ui.
 * Uses 100% centralized design system hooks.
 */
export const TourTooltip: FC<TourTooltipInternalProps> = ({
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
  const { quick, radiusClass } = useBorderTokens();
  const spacing = useSpacingTokens();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  const arrowRef = useRef<HTMLDivElement>(null);

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === totalSteps - 1;

  const { refs, floatingStyles, context, placement } = useFloating({
    placement: toFloatingPlacement(step.position || 'bottom'),
    elements: { reference: targetElement },
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(TOUR_STYLES.tooltip.offset),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      arrow({ element: arrowRef }),
    ],
  });

  const arrowData = context.middlewareData?.arrow;

  const getArrowStyles = useMemo(() => {
    const side = placement.split('-')[0];
    const staticSide = {
      top: 'bottom', right: 'left', bottom: 'top', left: 'right',
    }[side] as string;

    return {
      [staticSide]: `-${TOUR_STYLES.tooltip.arrowSize - 2}px`,
      left: arrowData?.x != null ? `${arrowData.x}px` : '',
      top: arrowData?.y != null ? `${arrowData.y}px` : '',
    };
  }, [placement, arrowData]);

  const arrowRotation = useMemo(() => {
    const side = placement.split('-')[0];
    return {
      top: 'rotate(180deg)', right: 'rotate(-90deg)',
      bottom: 'rotate(0deg)', left: 'rotate(90deg)',
    }[side] || 'rotate(0deg)';
  }, [placement]);

  const isCentered = !targetElement;

  return (
    <article
      ref={isCentered ? undefined : refs.setFloating}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`tour-step-title-${step.id}`}
      aria-describedby={`tour-step-description-${step.id}`}
      className={cn(
        'w-80 bg-popover text-popover-foreground shadow-lg',
        quick.table,
        isCentered && 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
      )}
      style={{
        ...(isCentered ? {} : floatingStyles),
        zIndex: TOUR_STYLES.zIndex.tooltip,
      }}
    >
      {/* Arrow */}
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

      {/* Header */}
      <header className={cn('flex items-center justify-between', spacing.padding.md, quick.borderB)}>
        <div className={cn('flex items-center', spacing.gap.sm)}>
          <HelpCircle className={cn(iconSizes.md, 'text-primary')} aria-hidden="true" />
          <h3 id={`tour-step-title-${step.id}`} className={typography.heading.sm}>
            {t(step.titleKey)}
          </h3>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('actions.close')} className={iconSizes.lg}>
          <X className={iconSizes.sm} aria-hidden="true" />
        </Button>
      </header>

      {/* Content */}
      <section className={spacing.padding.md}>
        {step.customContent ? step.customContent : (
          <p id={`tour-step-description-${step.id}`} className={cn(typography.body.sm, 'text-muted-foreground')}>
            {t(step.descriptionKey)}
          </p>
        )}
      </section>

      {/* Footer */}
      <footer className={cn('flex flex-col bg-muted/30', spacing.gap.sm, spacing.padding.md, quick.borderT)}>
        {showStepIndicators && (
          <nav
            className={cn('flex justify-center', spacing.gap.xs)}
            aria-label={t('productTour.stepIndicator', { current: stepIndex + 1, total: totalSteps })}
          >
            {Array.from({ length: totalSteps }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  TOUR_STYLES.stepIndicator,
                  radiusClass.full,
                  'transition-colors',
                  index === stepIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
                aria-current={index === stepIndex ? 'step' : undefined}
              />
            ))}
          </nav>
        )}

        {showDontShowAgain && (
          <div className={cn('flex items-center', spacing.gap.sm)}>
            <Checkbox
              id="tour-dont-show-again"
              checked={dontShowAgain}
              onCheckedChange={(checked) => onDontShowAgainChange(checked === true)}
            />
            <Label htmlFor="tour-dont-show-again" className={cn(typography.label.simple, 'text-muted-foreground cursor-pointer')}>
              {t('productTour.dontShowAgain')}
            </Label>
          </div>
        )}

        <nav className={cn('flex flex-col', spacing.gap.sm)}>
          {showSkipButton && !isLastStep && (
            <div className="flex justify-start">
              <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
                {t('productTour.skip')}
              </Button>
            </div>
          )}

          <div className={cn('flex items-center justify-end', spacing.gap.sm)}>
            {!isFirstStep && (
              <Button variant="outline" size="sm" onClick={onPrev} className={spacing.gap.xs}>
                <ChevronLeft className={iconSizes.sm} aria-hidden="true" />
                {t('productTour.previous')}
              </Button>
            )}

            <Button variant="default" size="sm" onClick={onNext} className={spacing.gap.xs}>
              {isLastStep ? t('productTour.finish') : (
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
