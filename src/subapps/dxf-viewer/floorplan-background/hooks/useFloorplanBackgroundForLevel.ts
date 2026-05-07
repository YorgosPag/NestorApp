'use client';

import { useEffect } from 'react';
import { useLevels } from '../../systems/levels/useLevels';
import { useFloorplanBackground, type UseFloorplanBackgroundResult } from './useFloorplanBackground';
import { useFloorplanBackgroundStore } from '../stores/floorplanBackgroundStore';
import { registerProviders } from '../providers/register-providers';

/**
 * Binds the active DXF level to the floorplan-background store.
 *
 * `levelId` acts as `floorId` in the store — each level has 0..1 background.
 * Returns `null` when no level is active (e.g. boot, no level selected).
 */
export function useFloorplanBackgroundForLevel(): UseFloorplanBackgroundResult | null {
  const { currentLevelId } = useLevels();
  const setActiveFloor = useFloorplanBackgroundStore((s) => s.setActiveFloor);

  // Idempotent on every render — guard inside registerProviders().
  useEffect(() => { registerProviders(); }, []);

  useEffect(() => {
    setActiveFloor(currentLevelId);
  }, [currentLevelId, setActiveFloor]);

  // Conditionally call hook (rules-of-hooks safe via constant check)
  // The hook below is always called — we just return null if no level is active.
  const result = useFloorplanBackground(currentLevelId ?? '__no_level__');
  return currentLevelId ? result : null;
}
