'use client';

/**
 * ADR-375 Phase B.2 — Level ↔ BimRenderSettings store sync.
 *
 * Watches (currentLevelId, levels) from the LevelsSystem context and calls
 * `useBimRenderSettingsStore.loadForLevel()` whenever the active level changes
 * or its bimRenderSettings field updates (Firestore real-time push).
 *
 * Mount once near the DXF viewer root (after LevelsContext is available).
 */

import { useEffect } from 'react';
import type { Level } from '../../systems/levels/config';
import { useBimRenderSettingsStore } from '../bim-render-settings-store';

interface UseBimRenderSettingsSyncParams {
  currentLevelId: string | null;
  levels: Level[];
}

export function useBimRenderSettingsSync({
  currentLevelId,
  levels,
}: UseBimRenderSettingsSyncParams): void {
  useEffect(() => {
    if (!currentLevelId) return;
    const level = levels.find((l) => l.id === currentLevelId);
    useBimRenderSettingsStore
      .getState()
      .loadForLevel(currentLevelId, level?.bimRenderSettings ?? null);
  }, [currentLevelId, levels]);
}
