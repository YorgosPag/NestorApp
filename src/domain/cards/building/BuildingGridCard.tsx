'use client';

/**
 * 🏢 ENTERPRISE BUILDING GRID CARD - Domain Component
 *
 * Thin typed adapter: computes the shared view-model via useBuildingCardModel
 * (ADR-585) and delegates rendering to the DomainCard grid shell.
 *
 * @fileoverview Building domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see BuildingListCard for list view equivalent
 * @see useBuildingCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React from 'react';

import type { Building } from '@/types/building/contracts';
import type { DomainCardInteraction } from '../shared/card-model.types';
import { DomainCard } from '../shared/DomainCard';
import { useBuildingCardModel } from './useBuildingCardModel';

export interface BuildingGridCardProps extends DomainCardInteraction {
  /** Building data */
  building: Building;
}

/**
 * 🏢 BuildingGridCard — domain card for buildings in grid/tile views.
 */
export function BuildingGridCard({ building, ...interaction }: BuildingGridCardProps) {
  const model = useBuildingCardModel(building);
  return <DomainCard variant="grid" model={model} {...interaction} />;
}

BuildingGridCard.displayName = 'BuildingGridCard';

export default BuildingGridCard;
