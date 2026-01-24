/**
 * 🏢 ENTERPRISE GRID CARD - Type Definitions
 *
 * Centralized types for the GridCard component.
 * Designed for grid/tile views with vertical layout and visual hierarchy.
 *
 * @fileoverview Type definitions for GridCard molecule component.
 * @enterprise Fortune 500 compliant - Uses existing centralized systems
 * @see ListCard for horizontal list view equivalent
 * @see NAVIGATION_ENTITIES for entity types
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { NavigationEntityType } from '@/components/navigation/config/navigation-entities';
import type { StatItem } from '../../primitives/Card/types';

// =============================================================================
// 🏢 GRID CARD BADGE TYPES (Shared with ListCard)
// =============================================================================

/**
 * Badge variant options - maps to existing badge system variants
 */
export type GridCardBadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info';

/**
 * Badge configuration for GridCard
 */
export interface GridCardBadge {
  /** Badge text */
  label: string;
  /** Visual variant */
  variant?: GridCardBadgeVariant;
  /** Additional className */
  className?: string;
}

// =============================================================================
// 🏢 GRID CARD ACTION TYPES
// =============================================================================

/**
 * Action configuration for GridCard
 */
export interface GridCardAction {
  /** Unique action ID */
  id: string;
  /** Action label for tooltip */
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
// 🏢 GRID CARD PROPS
// =============================================================================

/**
 * Props for GridCard component
 *
 * GridCard is designed for grid/tile views with:
 * - Vertical layout (icon/image at top)
 * - More visual hierarchy than ListCard
 * - Optimized for 2-4 column grids
 * - Mobile-responsive (1 column on small screens)
 *
 * @example
 * ```tsx
 * <GridCard
 *   entityType="unit"
 *   title="Διαμέρισμα Α1"
 *   subtitle="apartment"
 *   badges={[{ label: 'Προς πώληση', variant: 'warning' }]}
 *   stats={[
 *     { icon: Ruler, label: 'Εμβαδόν', value: '85 m²' },
 *     { icon: Building, label: 'Κτίριο', value: 'Κτίριο Α' },
 *   ]}
 *   isSelected={isSelected}
 *   onClick={() => setSelected(id)}
 * />
 * ```
 */
export interface GridCardProps {
  // ==========================================================================
  // IDENTITY
  // ==========================================================================

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

  // ==========================================================================
  // CONTENT
  // ==========================================================================

  /** Badges to display (max 2 recommended per Enterprise spec) */
  badges?: GridCardBadge[];

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
  actions?: GridCardAction[];

  // ==========================================================================
  // VISUAL OPTIONS
  // ==========================================================================

  /** Compact mode - smaller padding and text */
  compact?: boolean;

  /** Hide the entity icon */
  hideIcon?: boolean;

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
