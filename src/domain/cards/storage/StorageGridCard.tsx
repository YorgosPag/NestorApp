'use client';

/**
 * 📦 ENTERPRISE STORAGE GRID CARD - Domain Component
 *
 * Thin typed adapter: computes the shared view-model via useStorageCardModel
 * (ADR-585) and delegates to the SpotCard grid shell (shift-click multi-select).
 *
 * @fileoverview Storage domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see StorageListCard for list view equivalent
 * @see useStorageCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React from 'react';

import type { Storage } from '@/types/storage/contracts';
import type { SpotCardInteraction } from '../shared/card-model.types';
import { SpotCard } from '../shared/SpotCard';
import { useStorageCardModel } from './useStorageCardModel';

export interface StorageGridCardProps extends SpotCardInteraction {
  /** Storage unit data */
  storage: Storage;
}

/**
 * 📦 StorageGridCard — domain card for storage units in grid/tile views.
 */
export function StorageGridCard({ storage, ...interaction }: StorageGridCardProps) {
  const model = useStorageCardModel(storage, 'grid');
  return <SpotCard variant="grid" model={model} {...interaction} />;
}

StorageGridCard.displayName = 'StorageGridCard';

export default StorageGridCard;
