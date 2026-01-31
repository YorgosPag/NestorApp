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

import type { LucideIcon } from 'lucide-react';
import type { NavigationEntityType } from '@/components/navigation/config/navigation-entities';

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
// 🏢 LIST CARD TYPES (for future ListCard component)
// =============================================================================

/**
 * Selection state for list cards
 */
export interface ListCardSelectionState {
  isSelected: boolean;
  onSelect?: (selected: boolean) => void;
}

/**
 * Status badge configuration
 */
export interface ListCardBadge {
  label: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  className?: string;
}

/**
 * Common props for all list card implementations
 */
export interface ListCardBaseProps {
  /** Card title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Entity type for icon */
  entityType?: NavigationEntityType;
  /** Stats to display */
  stats?: StatItem[];
  /** Status badges */
  badges?: ListCardBadge[];
  /** Selection state */
  selection?: ListCardSelectionState;
  /** Click handler */
  onClick?: () => void;
  /** Additional className */
  className?: string;
  /** Compact mode */
  compact?: boolean;
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
