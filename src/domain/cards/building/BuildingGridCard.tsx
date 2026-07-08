'use client';

/**
 * 🏢 ENTERPRISE BUILDING GRID CARD - Domain Component
 *
 * Thin wrapper: computes the shared view-model via useBuildingCardModel (ADR-585)
 * and renders it into the GridCard shell.
 *
 * @fileoverview Building domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see GridCard for base component
 * @see BuildingListCard for list view equivalent
 * @see useBuildingCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React from 'react';

// 🏢 DESIGN SYSTEM
import { GridCard } from '@/design-system';

// 🏢 DOMAIN TYPES
import type { Building } from '@/types/building/contracts';

// 🏢 SHARED VIEW-MODEL (ADR-585)
import { useBuildingCardModel } from './useBuildingCardModel';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface BuildingGridCardProps {
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
 * 🏢 BuildingGridCard Component
 *
 * Domain-specific card for buildings in grid views.
 *
 * @example
 * ```tsx
 * <BuildingGridCard
 *   building={building}
 *   isSelected={selectedId === building.id}
 *   onSelect={() => setSelectedId(building.id)}
 *   onToggleFavorite={() => toggleFavorite(building.id)}
 *   isFavorite={favorites.has(building.id)}
 * />
 * ```
 */
export function BuildingGridCard({
  building,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: BuildingGridCardProps) {
  const { ariaLabel, ...cardProps } = useBuildingCardModel(building);

  return (
    <GridCard
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
}

BuildingGridCard.displayName = 'BuildingGridCard';

export default BuildingGridCard;
