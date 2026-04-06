/**
 * 🏢 ENTERPRISE ACCORDION SECTION
 *
 * Production-ready, fully accessible accordion component following WAI-ARIA 1.2 patterns.
 *
 * Split into 3 files for SRP compliance (ADR-065 Phase 4):
 * - accordion-types.ts  — Types + style functions (EXEMPT: types/config)
 * - accordion-group.tsx — useAccordion hook + AccordionGroup context
 * - AccordionSection.tsx — Main component (this file)
 *
 * @version 2.0.0 (Enterprise)
 */

'use client';

import React, { useState, useCallback, useId, useRef, useEffect, useMemo, memo } from 'react';
import { useIconSizes } from '../../../../../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../../../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';

// Re-export everything from types + group for backward compatibility
export type { AccordionSize, AccordionVariant, AccordionDensity, AccordionSectionProps } from './accordion-types';
export type { UseAccordionOptions, AccordionGroupProps } from './accordion-group';
export { useAccordion, useAccordionGroup, AccordionGroup } from './accordion-group';

import type { AccordionSectionProps } from './accordion-types';
import { getSizeStyles, getVariantStyles, densityStyles } from './accordion-types';
import { useAccordionGroup } from './accordion-group';

// ===== ICONS =====

const ChevronDownIcon = memo(({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
));
ChevronDownIcon.displayName = 'ChevronDownIcon';

const LoadingSpinner = memo(({ className }: { className?: string }) => (
  <svg className={`${className} ${PANEL_LAYOUT.ANIMATE.SPIN}`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className={PANEL_LAYOUT.OPACITY['25']} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className={PANEL_LAYOUT.OPACITY['75']} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
));
LoadingSpinner.displayName = 'LoadingSpinner';

const ErrorIcon = memo(({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
));
ErrorIcon.displayName = 'ErrorIcon';

// ===== MAIN COMPONENT =====

export const AccordionSection = memo(function AccordionSection({
  title,
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  isOpen: legacyIsOpen,
  onToggle: legacyOnToggle,
  className = '',
  headerClassName = '',
  contentClassName = '',
  size = 'md',
  variant = 'default',
  density = 'comfortable',
  icon,
  badge,
  chevron,
  chevronPosition = 'end',
  disabled = false,
  loading = false,
  error,
  mountWhenOpen = false,
  onToggleStart,
  onToggleEnd,
  onFocus,
  onKeyDown: onKeyDownProp,
  'aria-label': ariaLabel,
  headingLevel = 3,
  reducedMotion = false
}: AccordionSectionProps) {
  const iconSizes = useIconSizes();
  const { getElementBorder, getStatusBorder, getDirectionalBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();

  // ===== STATE (Controlled/Uncontrolled Hybrid) =====

  const effectiveControlled = controlledOpen ?? legacyIsOpen;
  const effectiveOnChange = onOpenChange ?? (legacyOnToggle ? () => legacyOnToggle() : undefined);

  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = effectiveControlled !== undefined;
  const isOpen = isControlled ? effectiveControlled! : internalOpen;

  const setIsOpen = useCallback((newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    effectiveOnChange?.(newOpen);
  }, [isControlled, effectiveOnChange]);

  // ===== UNIQUE IDs (ARIA) =====

  const baseId = useId();
  const headerId = `accordion-header-${baseId}`;
  const contentId = `accordion-content-${baseId}`;

  // ===== REFS =====

  const buttonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // ===== ACCORDION GROUP INTEGRATION (Roving Tabindex) =====

  const groupContext = useAccordionGroup();

  useEffect(() => {
    if (groupContext) {
      groupContext.registerAccordion(headerId, buttonRef);
      return () => groupContext.unregisterAccordion(headerId);
    }
  }, [groupContext, headerId]);

  const tabIndex = useMemo(() => {
    if (!groupContext) return 0;
    return groupContext.focusedId === headerId || groupContext.focusedId === null ? 0 : -1;
  }, [groupContext, headerId]);

  // ===== DETECT REDUCED MOTION =====

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const shouldAnimate = !reducedMotion && !prefersReducedMotion;

  // ===== ANIMATION (Height Transition) =====

  useEffect(() => {
    if (!contentRef.current || !shouldAnimate) return;
    const content = contentRef.current;

    const handleTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName === 'height' && isOpen) {
        content.style.height = 'auto';
        onToggleEnd?.();
      }
    };

    content.addEventListener('transitionend', handleTransitionEnd);

    if (isOpen) {
      const height = content.scrollHeight;
      content.style.height = '0px';
      requestAnimationFrame(() => { content.style.height = `${height}px`; });
    } else {
      const height = content.scrollHeight;
      content.style.height = `${height}px`;
      requestAnimationFrame(() => { content.style.height = '0px'; });
      setTimeout(() => { onToggleEnd?.(); }, 200);
    }

    return () => { content.removeEventListener('transitionend', handleTransitionEnd); };
  }, [isOpen, shouldAnimate, onToggleEnd]);

  // ===== HANDLERS =====

  const handleToggle = useCallback(() => {
    if (disabled || loading) return;
    onToggleStart?.();
    setIsOpen(!isOpen);
  }, [disabled, loading, isOpen, setIsOpen, onToggleStart]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    onKeyDownProp?.(e);
    if (disabled || loading) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  }, [disabled, loading, handleToggle, onKeyDownProp]);

  // ===== STYLES =====

  const styles = useMemo(() => ({
    size: getSizeStyles(iconSizes)[size],
    variant: getVariantStyles(getElementBorder, colors, radius)[variant],
    density: densityStyles[density]
  }), [size, variant, density, iconSizes, getElementBorder]);

  // ===== RENDER CHEVRON =====

  const renderChevron = () => {
    if (loading) return <LoadingSpinner className={`${styles.size.icon} ${colors.text.muted}`} />;
    if (error) return <ErrorIcon className={`${styles.size.icon} ${colors.text.error}`} />;
    if (chevron) return chevron;
    return (
      <div
        className={`${PANEL_LAYOUT.FLEX_SHRINK.NONE} ${colors.text.muted} ${PANEL_LAYOUT.TRANSITION.TRANSFORM} ${PANEL_LAYOUT.DURATION['200']} ${
          isOpen && !reducedMotion ? PANEL_LAYOUT.TRANSFORM.ROTATE_180 : ''
        }`}
        style={shouldAnimate ? undefined : { transition: 'none' }}
      >
        <ChevronDownIcon className={styles.size.icon} />
      </div>
    );
  };

  const HeadingTag = `h${headingLevel}` as keyof JSX.IntrinsicElements;

  // ===== RENDER =====

  return (
    <div
      className={`${styles.variant.container} ${className}`}
      data-state={isOpen ? 'open' : 'closed'}
      data-disabled={disabled}
      data-loading={loading}
    >
      <HeadingTag className={PANEL_LAYOUT.MARGIN.NONE}>
        <button
          ref={buttonRef}
          id={headerId}
          type="button"
          tabIndex={tabIndex}
          aria-expanded={isOpen}
          aria-controls={contentId}
          aria-label={ariaLabel}
          aria-disabled={disabled}
          disabled={disabled}
          onClick={handleToggle}
          onKeyDown={(e) => {
            groupContext?.handleKeyNavigation(headerId, e);
            handleKeyDown(e);
          }}
          onFocus={(e) => {
            groupContext?.setFocusedId(headerId);
            onFocus?.(e);
          }}
          className={`w-full ${styles.size.header} flex items-center justify-between ${
            styles.variant.header
          } ${PANEL_LAYOUT.TRANSITION.COLORS} text-left focus:outline-none ${colors.interactive.focus.ring} focus:ring-offset-2 ring-offset-background ${
            disabled ? `${PANEL_LAYOUT.OPACITY['50']} ${PANEL_LAYOUT.CURSOR.NOT_ALLOWED}` : PANEL_LAYOUT.CURSOR.POINTER
          } ${headerClassName}`}
          style={shouldAnimate ? undefined : { transition: 'none' }}
        >
          <div className={`flex items-center ${styles.density.gap}`}>
            {chevronPosition === 'start' && renderChevron()}
            {icon && <div className={`${PANEL_LAYOUT.FLEX_SHRINK.NONE} ${colors.text.muted}`}>{icon}</div>}
            <span className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary}`}>{title}</span>
            {badge && (
              <span className={`${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.info} ${colors.text.inverted} ${radius.full}`}>
                {badge}
              </span>
            )}
          </div>
          {chevronPosition === 'end' && renderChevron()}
        </button>
      </HeadingTag>

      {(!mountWhenOpen || isOpen) && (
        <div
          ref={contentRef}
          id={contentId}
          role="region"
          aria-labelledby={headerId}
          aria-hidden={!isOpen}
          className={`${PANEL_LAYOUT.OVERFLOW.HIDDEN} ${
            shouldAnimate ? `${PANEL_LAYOUT.TRANSITION.ALL} ${PANEL_LAYOUT.DURATION['200']} ${PANEL_LAYOUT.EASING.IN_OUT}` : ''
          }`}
          style={{ transition: shouldAnimate ? undefined : 'none' }}
        >
          <div className={`${styles.size.content} ${colors.bg.secondary} ${getDirectionalBorder('default', 'top')} ${PANEL_LAYOUT.OVERFLOW.VISIBLE} ${contentClassName}`}>
            {error && typeof error === 'string' && (
              <div className={`${PANEL_LAYOUT.MARGIN.BOTTOM_LG} ${PANEL_LAYOUT.SPACING.MD} ${colors.bg.errorLight} ${getStatusBorder('error')} rounded ${colors.text.error} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
                {error}
              </div>
            )}
            {children}
          </div>
        </div>
      )}
    </div>
  );
});

AccordionSection.displayName = 'AccordionSection';
