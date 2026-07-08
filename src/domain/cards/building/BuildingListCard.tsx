'use client';

/**
 * 🏢 ENTERPRISE BUILDING LIST CARD - Domain Component
 *
 * Thin typed adapter: computes the shared view-model via useBuildingCardModel
 * (ADR-585) and delegates rendering to the DomainCard list shell. Retains the
 * custom React.memo comparator for list-scroll perf.
 *
 * @fileoverview Building domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see useBuildingCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React from 'react';

import type { Building } from '@/types/building/contracts';
import type { DomainCardInteraction } from '../shared/card-model.types';
import { DomainCard } from '../shared/DomainCard';
import { useBuildingCardModel } from './useBuildingCardModel';

export interface BuildingListCardProps extends DomainCardInteraction {
  /** Building data */
  building: Building;
}

/**
 * 🏢 BuildingListCard — domain card for buildings in list views.
 */
export const BuildingListCard = React.memo(function BuildingListCard({
  building,
  ...interaction
}: BuildingListCardProps) {
  const model = useBuildingCardModel(building);
  return <DomainCard variant="list" model={model} {...interaction} />;
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
