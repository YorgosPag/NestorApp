/**
 * 🏢 ENTERPRISE GRID CARD - Type Definitions
 *
 * Centralized types for the GridCard component.
 * Designed for grid/tile views with vertical layout and visual hierarchy.
 *
 * @fileoverview Type definitions for GridCard molecule component.
 * @enterprise Fortune 500 compliant - Uses existing centralized systems
 * @see ListCard for horizontal list view equivalent
 * @see primitives/Card/types for the shared card vocabulary (CardBadge, CardAction, CardBaseProps)
 * @see NAVIGATION_ENTITIES for entity types
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import type { CardBadge, CardAction, CardBaseProps } from '../../primitives/Card/types';

// =============================================================================
// 🏢 GRID CARD BADGE TYPES
// =============================================================================

/**
 * Badge variant options - the subset of the Badge vocabulary GridCard supports.
 *
 * ⚠️ Load-bearing invariant: `GridCardBadgeVariant ⊂ ListCardBadgeVariant`.
 * Domain card models (`src/domain/cards/**`) type their badges as `GridCardBadge[]`
 * precisely so one array can feed both shells. Widening this union breaks that.
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
export type GridCardBadge = CardBadge<GridCardBadgeVariant>;

// =============================================================================
// 🏢 GRID CARD ACTION TYPES
// =============================================================================

/**
 * Action configuration for GridCard
 */
export type GridCardAction = CardAction;

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
 * GridCard adds no props of its own to the shared card contract — the grid and
 * list shells differ in layout, not in what the caller may configure.
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
export type GridCardProps = CardBaseProps<GridCardBadgeVariant>;
