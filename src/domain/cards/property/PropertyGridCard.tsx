'use client';

/**
 * 🏠 ENTERPRISE PROPERTY GRID CARD - Domain Component
 *
 * Thin typed adapter: computes the shared view-model via usePropertyGridModel
 * (ADR-585) and delegates to the SpotCard grid shell (shift-click multi-select).
 *
 * @fileoverview Property domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see PropertyListCard for list view equivalent
 * @see usePropertyGridModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React from 'react';

import type { Property } from '@/types/property-viewer';
import type { SpotCardInteraction } from '../shared/card-model.types';
import { SpotCard } from '../shared/SpotCard';
import { usePropertyGridModel } from './usePropertyCardModel';

export interface PropertyGridCardProps extends SpotCardInteraction {
  /** Property data */
  property: Property;
  /** Show commercial price/sqm stats (sale + rent) — for sales pages */
  showCommercialPrices?: boolean;
}

/**
 * 🏠 PropertyGridCard — domain card for properties in grid/tile views.
 */
export function PropertyGridCard({ property, showCommercialPrices = false, ...interaction }: PropertyGridCardProps) {
  const model = usePropertyGridModel(property, showCommercialPrices);
  return <SpotCard variant="grid" model={model} {...interaction} />;
}

PropertyGridCard.displayName = 'PropertyGridCard';

export default PropertyGridCard;
