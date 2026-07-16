/**
 * 🏢 ENTERPRISE LIST CARD - Type Definitions
 *
 * Centralized types for the ListCard component.
 * Extends primitives/Card/types.ts for list-specific functionality.
 *
 * @fileoverview Type definitions for ListCard molecule component.
 * @enterprise Fortune 500 compliant - Uses existing centralized systems
 * @see GridCard for vertical grid/tile view equivalent
 * @see primitives/Card/types for the shared card vocabulary (CardBadge, CardAction, CardBaseProps)
 * @see NAVIGATION_ENTITIES for entity types
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import type { CardBadge, CardAction, CardBaseProps } from '../../primitives/Card/types';

// =============================================================================
// 🏢 LIST CARD BADGE TYPES
// =============================================================================

/**
 * Badge variant options - the subset of the Badge vocabulary ListCard supports.
 *
 * ⚠️ Load-bearing invariant: `GridCardBadgeVariant ⊂ ListCardBadgeVariant`.
 * Domain card models (`src/domain/cards/**`) type their badges as `GridCardBadge[]`
 * precisely so one array can feed both shells. Narrowing this union breaks that.
 */
export type ListCardBadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
  | 'muted';

/**
 * Badge configuration for ListCard
 */
export type ListCardBadge = CardBadge<ListCardBadgeVariant>;

// =============================================================================
// 🏢 LIST CARD ACTION TYPES
// =============================================================================

/**
 * Action configuration for ListCard
 */
export type ListCardAction = CardAction;

// =============================================================================
// 🏢 LIST CARD PROPS
// =============================================================================

/**
 * Props for ListCard component
 *
 * Extends the shared card contract with the props the horizontal list layout
 * genuinely needs: external hover sync, inline badges, and the hover variants
 * required by embedded contexts (command palettes, search dialogs).
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
export interface ListCardProps extends CardBaseProps<ListCardBadgeVariant> {
  // ==========================================================================
  // SELECTION & INTERACTION
  // ==========================================================================

  /** 🏢 ENTERPRISE: Mouse enter handler for keyboard navigation (ADR-029 Global Search) */
  onMouseEnter?: () => void;

  /** Mouse leave handler — bidirectional hover sync (ADR-237/SPEC-237C) */
  onMouseLeave?: () => void;

  /** External hover highlight — bidirectional sync from canvas (ADR-237/SPEC-237C) */
  isHovered?: boolean;

  // ==========================================================================
  // VISUAL OPTIONS
  // ==========================================================================

  /**
   * 🏢 PR1.2: Show badges inline with title (same row)
   * When true: Title + Badge on same line
   * When false: Badge on separate row (default)
   */
  inlineBadges?: boolean;

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

  // ==========================================================================
  // ACCESSIBILITY
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Role for ARIA semantics (ADR-029 Global Search)
   * - 'button' (default): Standard clickable card
   * - 'option': For listbox items (e.g., search results)
   */
  role?: 'button' | 'option';
}
