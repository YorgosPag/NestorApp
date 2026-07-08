'use client';

/**
 * 🅿️ ENTERPRISE PARKING GRID CARD - Domain Component
 *
 * Thin typed adapter: computes the shared view-model via useParkingCardModel
 * (ADR-585) and delegates to the SpotCard grid shell (shift-click multi-select).
 *
 * @fileoverview Parking domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ParkingListCard for list view equivalent
 * @see useParkingCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React from 'react';

import type { SpotCardInteraction } from '../shared/card-model.types';
import { SpotCard } from '../shared/SpotCard';
import type { ParkingSpotAdapter } from './parking-types';
import { useParkingCardModel } from './useParkingCardModel';

export interface ParkingGridCardProps extends SpotCardInteraction {
  /** Parking spot data - supports both @/types/parking and @/hooks schemas */
  parking: ParkingSpotAdapter;
}

/**
 * 🅿️ ParkingGridCard — domain card for parking spots in grid/tile views.
 */
export function ParkingGridCard({ parking, ...interaction }: ParkingGridCardProps) {
  const model = useParkingCardModel(parking, 'grid');
  return <SpotCard variant="grid" model={model} {...interaction} />;
}

ParkingGridCard.displayName = 'ParkingGridCard';

export default ParkingGridCard;
