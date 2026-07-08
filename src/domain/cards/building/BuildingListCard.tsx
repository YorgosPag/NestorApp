'use client';

/**
 * 🏢 ENTERPRISE BUILDING LIST CARD - Domain Component
 *
 * Thin wrapper: computes the shared view-model via useBuildingCardModel (ADR-585)
 * and renders it into the ListCard shell. Retains the custom React.memo
 * comparator for list-scroll perf.
 *
 * @fileoverview Building domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ListCard for base component
 * @see useBuildingCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React from 'react';

// 🏢 DESIGN SYSTEM
import { ListCard } from '@/design-system';

// 🏢 DOMAIN TYPES
import type { Building } from '@/types/building/contracts';

// 🏢 SHARED VIEW-MODEL (ADR-585)
import { useBuildingCardModel } from './useBuildingCardModel';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface BuildingListCardProps {
  /** Building data */
  building: Building;
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

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 🏢 BuildingListCard Component
 *
 * Domain-specific card for buildings in list views.
 *
 * @example
 * ```tsx
 * <BuildingListCard
 *   building={building}
 *   isSelected={selectedId === building.id}
 *   onSelect={() => setSelectedId(building.id)}
 *   onToggleFavorite={() => toggleFavorite(building.id)}
 *   isFavorite={favorites.has(building.id)}
 * />
 * ```
 */
export const BuildingListCard = React.memo(function BuildingListCard({
  building,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: BuildingListCardProps) {
  const { ariaLabel, ...cardProps } = useBuildingCardModel(building);

  return (
    <ListCard
      {...cardProps}
      isSelected={isSelected}
      onClick={onSelect}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={ariaLabel}
    />
  );
}, (prev, next) => {
  // [PERF] Custom comparator: skip re-render when visual output is identical.
  // onSelect/onToggleFavorite are arrow fns in .map() — always new refs — so we
  // intentionally exclude them. They capture stable data via closure.
  return (
    prev.building === next.building &&
    prev.isSelected === next.isSelected &&
    prev.isFavorite === next.isFavorite &&
    prev.compact === next.compact &&
    prev.className === next.className
  );
});

BuildingListCard.displayName = 'BuildingListCard';

export default BuildingListCard;
