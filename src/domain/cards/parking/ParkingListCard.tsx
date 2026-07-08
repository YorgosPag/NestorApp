'use client';

/**
 * 🅿️ ENTERPRISE PARKING LIST CARD - Domain Component
 *
 * Thin typed adapter: computes the shared view-model via useParkingCardModel
 * (ADR-585) and delegates to the DomainCard list shell (plain single-click, as
 * before — List parking cards do not use shift-multi-select).
 *
 * @fileoverview Parking domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see useParkingCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React from 'react';

import type { DomainCardInteraction } from '../shared/card-model.types';
import { DomainCard } from '../shared/DomainCard';
import type { ParkingSpotAdapter } from './parking-types';
import { useParkingCardModel } from './useParkingCardModel';

export interface ParkingListCardProps extends DomainCardInteraction {
  /** Parking spot data - supports both @/types/parking and @/hooks schemas */
  parking: ParkingSpotAdapter;
}

/**
 * 🅿️ ParkingListCard — domain card for parking spots in list views.
 */
export function ParkingListCard({ parking, ...interaction }: ParkingListCardProps) {
  const model = useParkingCardModel(parking, 'list');
  return <DomainCard variant="list" model={model} {...interaction} />;
}

ParkingListCard.displayName = 'ParkingListCard';

export default ParkingListCard;
