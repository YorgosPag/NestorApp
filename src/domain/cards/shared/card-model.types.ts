/**
 * 🏢 ENTERPRISE DOMAIN CARD — Shared View-Model Contract (ADR-585)
 *
 * Single source of truth for the props that a domain entity contributes to
 * BOTH its GridCard and its ListCard. The per-entity `useXxxCardModel()` hooks
 * compute this once; the thin Grid/List wrappers spread it into the matching
 * design-system shell (`<GridCard>` / `<ListCard>`), adding only view-specific
 * concerns (layout shell, memoization, extra children).
 *
 * Badge variant note: `GridCardBadgeVariant ⊂ ListCardBadgeVariant`
 * (ListCard additionally allows `'muted'`), so typing shared badges with
 * `GridCardBadge` keeps them assignable to both shells.
 *
 * @see ADR-585 Domain card view-model hook SSoT
 * @see ADR-013 Enterprise card system (atomic design)
 */

import type { LucideIcon } from 'lucide-react';
import type { NavigationEntityType } from '@/components/navigation/config/navigation-entities';
import type { StatItem } from '@/design-system';
import type { GridCardBadge } from '@/design-system/components/GridCard/GridCard.types';

/**
 * The shared, view-agnostic props a domain card model contributes to both the
 * Grid and List shell. `subtitle` is optional because some entities (e.g.
 * Project) derive it differently per view — those wrappers override it locally.
 */
export interface CardViewModel {
  /** Entity type — resolves icon/color from NAVIGATION_ENTITIES (mutually exclusive with customIcon) */
  entityType?: NavigationEntityType;
  /** Custom icon override (when the entity does not map 1:1 to a NavigationEntityType) */
  customIcon?: LucideIcon;
  /** Custom icon color override */
  customIconColor?: string;
  /** Card title */
  title: string;
  /** Card subtitle — omit here when it is computed per-view in the wrapper */
  subtitle?: string;
  /** Status/type badges (GridCardBadgeVariant ⊂ ListCardBadgeVariant → assignable to both shells) */
  badges: GridCardBadge[];
  /** Metric rows */
  stats: StatItem[];
  /** Accessible label */
  ariaLabel: string;
}

/**
 * The interaction/selection props every domain card wrapper accepts and forwards
 * verbatim to the shell. Shared so each `XxxGridCardProps` / `XxxListCardProps`
 * only declares its single entity field on top of these.
 */
export interface DomainCardInteraction {
  /** Whether card is selected */
  isSelected?: boolean;
  /** Whether item is favorite */
  isFavorite?: boolean;
  /** Click handler */
  onSelect?: () => void;
  /** Favorite toggle handler */
  onToggleFavorite?: () => void;
  /** Compact mode */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Interaction contract for "spatial spot" cards (parking / storage / property)
 * that support **shift-click multi-select** and keyboard activation. `onSelect`
 * receives whether Shift/Meta was held. Optional hover-sync props are List-only
 * (e.g. Property ↔ canvas bidirectional highlight, SPEC-237C).
 */
export interface SpotCardInteraction {
  /** Whether card is selected */
  isSelected?: boolean;
  /** Whether item is favorite */
  isFavorite?: boolean;
  /** Click handler — receives true when Shift/Meta held (multi-select) */
  onSelect?: (isShiftClick?: boolean) => void;
  /** Favorite toggle handler */
  onToggleFavorite?: () => void;
  /** Compact mode */
  compact?: boolean;
  /** Additional className */
  className?: string;
  /** External hover highlight (List-only, bidirectional sync) */
  isHovered?: boolean;
  /** Mouse enter handler (List-only hover sync) */
  onMouseEnter?: () => void;
  /** Mouse leave handler (List-only hover sync) */
  onMouseLeave?: () => void;
}
