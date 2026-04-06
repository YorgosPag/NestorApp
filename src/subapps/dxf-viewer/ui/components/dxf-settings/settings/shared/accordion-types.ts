/**
 * Accordion Types & Style Configuration
 *
 * Types, interfaces, and style utility functions for the AccordionSection component.
 * Extracted from AccordionSection.tsx for SRP compliance (ADR-065 Phase 4).
 *
 * @module dxf-settings/shared/accordion-types
 */

import { HOVER_BACKGROUND_EFFECTS } from '../../../../../../../components/ui/effects';
import type { useIconSizes } from '../../../../../../../hooks/useIconSizes';
import type { useBorderTokens } from '../../../../../../../hooks/useBorderTokens';
import type { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';

// ============================================================================
// TYPES
// ============================================================================

export type AccordionSize = 'sm' | 'md' | 'lg';
export type AccordionVariant = 'default' | 'ghost' | 'bordered';
export type AccordionDensity = 'comfortable' | 'compact';

export interface AccordionSectionProps {
  // Required
  title: string;
  children: React.ReactNode;

  // State (Controlled/Uncontrolled hybrid)
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;

  /** @deprecated Use `open` prop instead */
  isOpen?: boolean;
  /** @deprecated Use `onOpenChange` callback instead */
  onToggle?: () => void;

  // Styling
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  size?: AccordionSize;
  variant?: AccordionVariant;
  density?: AccordionDensity;

  // Content
  icon?: React.ReactNode;
  badge?: string | number;
  chevron?: React.ReactNode;
  chevronPosition?: 'start' | 'end';

  // Behavior
  disabled?: boolean;
  loading?: boolean;
  error?: string | boolean;
  mountWhenOpen?: boolean;

  // Callbacks
  onToggleStart?: () => void;
  onToggleEnd?: () => void;
  onFocus?: (e: React.FocusEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;

  // Accessibility
  'aria-label'?: string;
  'aria-labelledby'?: string;
  headingLevel?: 2 | 3 | 4 | 5 | 6;

  // Advanced
  reducedMotion?: boolean;
}

// ============================================================================
// STYLE FUNCTIONS
// ============================================================================

export const getSizeStyles = (iconSizes: ReturnType<typeof useIconSizes>): Record<AccordionSize, { header: string; content: string; icon: string }> => ({
  sm: {
    header: `${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`,
    content: `${PANEL_LAYOUT.CONTAINER.INNER_PADDING} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`,
    icon: iconSizes.xs
  },
  md: {
    header: `${PANEL_LAYOUT.SPACING.STANDARD} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`,
    content: `${PANEL_LAYOUT.CONTAINER.INNER_PADDING} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`,
    icon: iconSizes.sm
  },
  lg: {
    header: `${PANEL_LAYOUT.SPACING.COMFORTABLE} ${PANEL_LAYOUT.TYPOGRAPHY.BASE}`,
    content: `${PANEL_LAYOUT.CONTAINER.INNER_PADDING} ${PANEL_LAYOUT.TYPOGRAPHY.BASE}`,
    icon: iconSizes.md
  }
});

export const getVariantStyles = (
  getBorder: ReturnType<typeof useBorderTokens>['getElementBorder'],
  colors: ReturnType<typeof useSemanticColors>,
  radius: ReturnType<typeof useBorderTokens>['radius']
): Record<AccordionVariant, { container: string; header: string }> => ({
  default: {
    container: `${getBorder('card', 'default')} ${radius.lg}`,
    header: `${colors.bg.secondary} ${HOVER_BACKGROUND_EFFECTS.GRAY_DARKER}`
  },
  ghost: {
    container: 'border-0',
    header: `bg-transparent ${HOVER_BACKGROUND_EFFECTS.GRAY_DARK_ALPHA}`
  },
  bordered: {
    container: `${getBorder('card', 'focus')} ${radius.lg} ${PANEL_LAYOUT.SHADOW.LG}`,
    header: `${colors.bg.secondary} ${HOVER_BACKGROUND_EFFECTS.GRAY_DARKER}`
  }
});

export const densityStyles: Record<AccordionDensity, { gap: string }> = {
  comfortable: { gap: PANEL_LAYOUT.GAP.MD },
  compact: { gap: PANEL_LAYOUT.GAP.SM }
};
