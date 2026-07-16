/**
 * 🏢 ENTERPRISE CARD PRIMITIVES - Type Definitions
 *
 * Single Source of Truth for all Card-related types.
 * Used by CardStats, CardIcon, ListCard, DetailCard, etc.
 *
 * @fileoverview Centralized type definitions for the Card design system.
 * @enterprise Fortune 500 compliant - Zero duplicates
 * @see ADR-013 in docs/centralized-systems/reference/adr-index.md
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { NavigationEntityType } from '@/components/navigation/config/navigation-entities';
import type { BadgeVariantProps } from '@/components/ui/badge';

// =============================================================================
// 🏢 CARD ICON TYPES
// =============================================================================

/**
 * CardIcon variant for different visual styles
 */
export type CardIconVariant = 'default' | 'outlined' | 'filled' | 'ghost';

/**
 * CardIcon size options - uses centralized icon sizing
 */
export type CardIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Props for CardIcon component
 */
export interface CardIconProps {
  /** Entity type - uses NAVIGATION_ENTITIES for icon/color */
  entityType?: NavigationEntityType;
  /** Custom icon override (when not using entityType) */
  icon?: LucideIcon;
  /** Custom color override (Tailwind class) */
  color?: string;
  /** Icon size */
  size?: CardIconSize;
  /** Visual variant */
  variant?: CardIconVariant;
  /** Additional className */
  className?: string;
  /** Background color for filled variant */
  backgroundColor?: string;
  /** Border radius for container */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  /** Aria label for accessibility */
  'aria-label'?: string;
}

// =============================================================================
// 🏢 CARD STATS TYPES
// =============================================================================

/**
 * Single stat item configuration
 */
export interface StatItem {
  /** Lucide icon for the stat */
  icon: LucideIcon;
  /** Stat label */
  label: string;
  /** Stat value (string for flexibility - formatted externally) */
  value: string;
  /** Optional color for the icon */
  iconColor?: string;
  /** Optional color for the value */
  valueColor?: string;
  /** Optional tooltip */
  tooltip?: string;
}

/**
 * Stats layout options
 */
export type StatsLayout = 'horizontal' | 'vertical' | 'grid';

/**
 * Props for CardStats component
 */
export interface CardStatsProps {
  /** Array of stat items to display */
  stats: StatItem[];
  /** Layout direction */
  layout?: StatsLayout;
  /** Number of columns (for grid layout) */
  columns?: 2 | 3 | 4;
  /** Compact mode - smaller text and spacing */
  compact?: boolean;
  /** Show dividers between stats */
  showDividers?: boolean;
  /** Additional className */
  className?: string;
}

// =============================================================================
// 🏢 CARD BADGE TYPES
// =============================================================================

/**
 * Badge variants a card may render.
 *
 * Derived from the centralized Badge component — the Badge owns the vocabulary,
 * cards merely speak it. Each card shell narrows this union to the subset it
 * supports (see `GridCardBadgeVariant` / `ListCardBadgeVariant`); because those
 * subsets are assignable to this type, no cast is needed at the render boundary.
 */
export type CardBadgeVariant = NonNullable<BadgeVariantProps['variant']>;

/**
 * Badge configuration for a card.
 *
 * @typeParam TVariant - The variant subset the owning card shell supports.
 */
export interface CardBadge<TVariant extends CardBadgeVariant = CardBadgeVariant> {
  /** Badge text */
  label: string;
  /** Visual variant */
  variant?: TVariant;
  /** Additional className */
  className?: string;
}

// =============================================================================
// 🏢 CARD ACTION TYPES
// =============================================================================

/**
 * Action configuration for a card's hover toolbar.
 */
export interface CardAction {
  /** Unique action ID */
  id: string;
  /** Action label — used as the accessible name and tooltip text */
  label: string;
  /** Action icon */
  icon: LucideIcon;
  /** Click handler */
  onClick: (event: React.MouseEvent) => void;
  /** Whether action is disabled */
  disabled?: boolean;
  /** Custom className */
  className?: string;
}

// =============================================================================
// 🏢 CARD IDENTITY PROPS
// =============================================================================

/**
 * What a card is: its icon, its name, and how densely to draw them.
 *
 * Every shell forwards this set to its header verbatim — see `pickCardIdentity`,
 * which is the one place that knows the set, so adding a field here reaches both
 * shells without either being edited.
 */
export interface CardIdentityProps {
  /** Entity type - determines icon and color from NAVIGATION_ENTITIES */
  entityType?: NavigationEntityType;

  /** Custom icon override (when not using entityType) */
  customIcon?: LucideIcon;

  /** Custom icon color override */
  customIconColor?: string;

  /** Card title */
  title: string;

  /** Card subtitle (e.g., type, category) */
  subtitle?: string;

  /** Compact mode - smaller padding and text */
  compact?: boolean;

  /** Hide the entity icon */
  hideIcon?: boolean;
}

// =============================================================================
// 🏢 CARD SHELL BASE PROPS
// =============================================================================

/**
 * Props shared by every card shell (GridCard, ListCard).
 *
 * A shell extends this with the props its own layout genuinely needs — grid and
 * list are different layouts, not one component with a `variant` flag.
 *
 * @typeParam TBadgeVariant - The badge variant subset the shell supports.
 */
export interface CardBaseProps<TBadgeVariant extends CardBadgeVariant = CardBadgeVariant>
  extends CardIdentityProps {
  // ==========================================================================
  // CONTENT
  // ==========================================================================

  /** Badges to display (max 2 recommended per Enterprise spec) */
  badges?: CardBadge<TBadgeVariant>[];

  /** Stats to display using CardStats primitive */
  stats?: StatItem[];

  /** Additional content below stats */
  children?: ReactNode;

  // ==========================================================================
  // SELECTION & INTERACTION
  // ==========================================================================

  /** Whether card is selected */
  isSelected?: boolean;

  /** Click handler */
  onClick?: () => void;

  /** Keyboard handler for accessibility */
  onKeyDown?: (event: React.KeyboardEvent) => void;

  // ==========================================================================
  // FAVORITES
  // ==========================================================================

  /** Whether item is favorite */
  isFavorite?: boolean;

  /** Favorite toggle handler */
  onToggleFavorite?: () => void;

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  /** Additional actions shown on hover */
  actions?: CardAction[];

  // ==========================================================================
  // VISUAL OPTIONS
  // ==========================================================================

  /** Hide stats section */
  hideStats?: boolean;

  /** Additional className */
  className?: string;

  // ==========================================================================
  // ACCESSIBILITY
  // ==========================================================================

  /** Aria label for accessibility */
  'aria-label'?: string;

  /** Aria description */
  'aria-describedby'?: string;

  /** Tab index */
  tabIndex?: number;
}

// =============================================================================
// 🏢 UTILITY TYPES
// =============================================================================

/**
 * Size map for consistent sizing across components
 */
export const CARD_SIZES = {
  xs: { icon: 'w-3 h-3', container: 'p-1', text: 'text-xs' },
  sm: { icon: 'w-4 h-4', container: 'p-1.5', text: 'text-sm' },
  md: { icon: 'w-5 h-5', container: 'p-2', text: 'text-base' },
  lg: { icon: 'w-6 h-6', container: 'p-2.5', text: 'text-lg' },
  xl: { icon: 'w-8 h-8', container: 'p-3', text: 'text-xl' },
} as const;

/**
 * Border radius map
 */
export const CARD_ROUNDED = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
} as const;
