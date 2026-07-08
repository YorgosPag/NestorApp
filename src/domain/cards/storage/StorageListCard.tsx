'use client';

/**
 * 📦 ENTERPRISE STORAGE LIST CARD - Domain Component
 *
 * Thin typed adapter: computes the shared view-model via useStorageCardModel
 * (ADR-585) and delegates to the DomainCard list shell (plain single-click).
 *
 * @fileoverview Storage domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see useStorageCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React from 'react';

import type { Storage } from '@/types/storage/contracts';
import type { DomainCardInteraction } from '../shared/card-model.types';
import { DomainCard } from '../shared/DomainCard';
import { useStorageCardModel } from './useStorageCardModel';

export interface StorageListCardProps extends DomainCardInteraction {
  /** Storage unit data */
  storage: Storage;
}

/**
 * 📦 StorageListCard — domain card for storage units in list views.
 */
export function StorageListCard({ storage, ...interaction }: StorageListCardProps) {
  const model = useStorageCardModel(storage, 'list');
  return <DomainCard variant="list" model={model} {...interaction} />;
}

StorageListCard.displayName = 'StorageListCard';

export default StorageListCard;
