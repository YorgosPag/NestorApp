/**
 * 🏢 ENTERPRISE LIST CARD - Type Definitions
 *
 * Centralized types for the ListCard component.
 * Extends primitives/Card/types.ts for list-specific functionality.
 *
 * @fileoverview Type definitions for ListCard molecule component.
 * @enterprise Fortune 500 compliant - Uses existing centralized systems
 * @see NAVIGATION_ENTITIES for entity types
 * @see @/core/badges for badge types
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { NavigationEntityType } from '@/components/navigation/config/navigation-entities';
import type { StatItem } from '../../primitives/Card/types';

// =============================================================================
// 🏢 LIST CARD BADGE TYPES
// =============================================================================

/**
 * Badge variant options - maps to existing badge system variants
 */
export type ListCardBadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info';

/**
 * Badge configuration for ListCard
 */
export interface ListCardBadge {
  /** Badge text */
  label: string;
  /** Visual variant */
  variant?: ListCardBadgeVariant;
  /** Additional className */
  className?: string;
}

// =============================================================================
// 🏢 LIST CARD ACTION TYPES
// =============================================================================

/**
 * Action configuration for ListCard
 */
export interface ListCardAction {
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
// 🏢 LIST CARD PROPS
// =============================================================================

/**
 * Props for ListCard component
 *
 * @example
 * ```tsx
 * <ListCard
 *   entityType="parking"
 *   title="P-001"
 *   subtitle="Θέση Στάθμευσης"
 *   badges={[{ label: 'Διαθέσιμη', variant: 'success' }]}
 *   stats={[
 *     { icon: Ruler, label: 'Εμβαδόν', value: '15 m²' },
 *     { icon: Euro, label: 'Τιμή', value: '€25,000' },
 *   ]}
 *   isSelected={isSelected}
 *   onClick={() => setSelected(id)}
 * />
 * ```
 */
export interface ListCardProps {
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

  /** Card subtitle */
  subtitle?: string;

  // ==========================================================================
  // CONTENT
  // ==========================================================================

  /** Badges to display (max 2 recommended per Enterprise spec) */
  badges?: ListCardBadge[];

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

  /** 🏢 ENTERPRISE: Mouse enter handler for keyboard navigation (ADR-029 Global Search) */
  onMouseEnter?: () => void;

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
  actions?: ListCardAction[];

  // ==========================================================================
  // VISUAL OPTIONS
  // ==========================================================================

  /** Compact mode - smaller padding and text */
  compact?: boolean;

  /** Hide the entity icon */
  hideIcon?: boolean;

  /** Hide stats section */
  hideStats?: boolean;

  /**
   * 🏢 PR1.2: Show badges inline with title (same row)
   * When true: Title + Badge on same line
   * When false: Badge on separate row (default)
   */
  inlineBadges?: boolean;

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

  /**
   * 🏢 ENTERPRISE: Role for ARIA semantics (ADR-029 Global Search)
   * - 'button' (default): Standard clickable card
   * - 'option': For listbox items (e.g., search results)
   */
  role?: 'button' | 'option';

  /**
   * 🏢 ENTERPRISE: Allow hover effects to extend beyond card boundaries
   * When true, removes overflow-hidden to allow scale/shadow hover effects
   * to be fully visible. Use in contexts like search dialogs where cards
   * need visual feedback that extends beyond their bounds.
   *
   * @default false
   * @see ADR-029 Global Search - Card hover effects
   */
  allowOverflow?: boolean;

  /**
   * 🏢 ENTERPRISE: Hover effect variant
   *
   * Different contexts require different hover behaviors:
   * - 'standard': Scale + shadow (default, for standalone cards like ParkingsList)
   * - 'subtle': Background color only (for command palettes, dropdowns, search dialogs)
   * - 'none': No hover effect (for embedded cards in other interactive elements)
   *
   * Pattern used by: VS Code Command Palette, Salesforce Global Search,
   * SAP Fiori Command Palette, Microsoft Fluent ComboBox
   *
   * @default 'standard'
   * @see ADR-029 Global Search - Enterprise hover patterns
   */
  hoverVariant?: 'standard' | 'subtle' | 'none';
}
