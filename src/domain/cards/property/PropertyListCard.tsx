'use client';

/**
 * 🏠 ENTERPRISE PROPERTY LIST CARD - Domain Component
 *
 * Thin typed adapter: computes the shared view-model via usePropertyListModel
 * (ADR-585) and delegates to the SpotCard list shell (shift-click multi-select +
 * bidirectional hover sync, SPEC-237C).
 *
 * @fileoverview Property domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see usePropertyListModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React from 'react';

import type { Property } from '@/types/property-viewer';
import type { SpotCardInteraction } from '../shared/card-model.types';
import { SpotCard } from '../shared/SpotCard';
import { usePropertyListModel } from './usePropertyCardModel';

export interface PropertyListCardProps extends SpotCardInteraction {
  /** Property data */
  property: Property;
  /** View floor plan handler (optional, reserved) */
  onViewFloorPlan?: (id: string) => void;
}

/**
 * 🏠 PropertyListCard — domain card for properties in list views.
 */
export function PropertyListCard({ property, onViewFloorPlan: _onViewFloorPlan, ...interaction }: PropertyListCardProps) {
  const model = usePropertyListModel(property);
  return <SpotCard variant="list" model={model} {...interaction} />;
}

PropertyListCard.displayName = 'PropertyListCard';

export default PropertyListCard;
