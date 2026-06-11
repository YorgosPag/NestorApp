'use client';

/**
 * ADR-441 Slice 3 — Always-on host για το associative grid hosting (renders `null`).
 *
 * Mounted στο `DxfViewerTopBar` (δίπλα στα FoundationPersistenceHost /
 * GridGuidePersistenceHost). Wires τον `useHostingReconciler` με τον τρέχοντα
 * level manager ώστε τα hosted foundation strips να ακολουθούν live όταν
 * μετακινείται ένας άξονας του κανάβου (Revit associative grid).
 *
 * Zero high-frequency React subscriptions (ADR-040, CHECK 6B/6C): η συνδρομή στον
 * κάναβο είναι imperative μέσα στο hook, RAF-throttled.
 *
 * @see ../hooks/data/useHostingReconciler.ts
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md
 */

import React from 'react';
import type { useLevels } from '../systems/levels';
import { useHostingReconciler } from '../hooks/data/useHostingReconciler';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface HostingReconcilerHostProps {
  readonly levelManager: LevelManagerLike;
}

export function HostingReconcilerHost({
  levelManager,
}: HostingReconcilerHostProps): React.ReactElement | null {
  useHostingReconciler({ levelManager });
  return null;
}
