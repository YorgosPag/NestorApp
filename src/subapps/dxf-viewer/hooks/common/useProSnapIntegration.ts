'use client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSceneManager } from '../scene/useSceneManager';
import { useLevels } from '../../systems/levels';
import { ExtendedSnapType } from '../../snapping/extended-types';
import { useSnapContext } from '../../snapping/context/SnapContext';
import { GridSettings } from '../../systems/rulers-grid/config';

interface ProSnapIntegrationState {
  enabledModes: Set<ExtendedSnapType>;
  stats: { enabled: boolean; modes: ExtendedSnapType[]; entityCount: number; lastUpdate: number };
  toggleMode: (mode: ExtendedSnapType, enabled: boolean) => void;
  refreshEntities: () => void;
  snapEnabled: boolean;
  toggleSnap: (enabled?: boolean) => void;
}

export function useProSnapIntegration(parentSnapEnabled?: boolean): ProSnapIntegrationState {
  const { getLevelScene } = useSceneManager();
  const { currentLevelId } = useLevels();
  
  // Χρήση του ενοποιημένου SnapContext
  const snapContext = useSnapContext();
  
  // Χρήση snap enabled state από SnapContext ή parent prop
  const snapEnabled = parentSnapEnabled ?? snapContext.snapEnabled;
  
  // Χρήση enabled modes από SnapContext
  const enabledModes = snapContext.enabledModes;

  // Use ref to track previous values and prevent infinite loops
  const prevValuesRef = useRef({
    entityCount: 0,
    snapEnabled: false,
    enabledModesString: ''
  });

  // Get current entities - memoized properly
  const entities = useMemo(() => {
    const scene = currentLevelId ? getLevelScene(currentLevelId) : null;
    return scene?.entities ?? [];
  }, [currentLevelId, getLevelScene]);

  // Create stable stats object
  // ✅ ENTERPRISE: Explicit typing to prevent 'never[]' inference
  const [stats, setStats] = useState(() => ({
    enabled: false,
    modes: [] as ExtendedSnapType[],
    entityCount: 0,
    lastUpdate: Date.now()
  }));

  // Configure snapping when entities or settings change - with proper dependency check
  useEffect(() => {
    const currentEntityCount = entities.length;
    const currentEnabledModesString = Array.from(enabledModes).sort().join(',');
    
    // Only update if something actually changed
    const hasChanged = 
      prevValuesRef.current.entityCount !== currentEntityCount ||
      prevValuesRef.current.snapEnabled !== snapEnabled ||
      prevValuesRef.current.enabledModesString !== currentEnabledModesString;

    if (hasChanged) {

      // Update stats only when there's an actual change
      setStats({
        enabled: snapEnabled,
        modes: Array.from(enabledModes),
        entityCount: currentEntityCount,
        lastUpdate: Date.now()
      });

      // Update ref with current values
      prevValuesRef.current = {
        entityCount: currentEntityCount,
        snapEnabled,
        enabledModesString: currentEnabledModesString
      };
    }
  }, [entities.length, snapEnabled, enabledModes]); // Stable dependencies

  const toggleMode = useCallback((mode: ExtendedSnapType, enabled: boolean) => {

    snapContext.toggleMode(mode, enabled);
  }, [snapContext]);

  const toggleSnap = useCallback((enabled?: boolean) => {
    const newEnabled = enabled !== undefined ? enabled : !snapContext.snapEnabled;

    snapContext.setSnapEnabled(newEnabled);
  }, [snapContext]);

  const refreshEntities = useCallback(() => {

    // Force refresh by updating timestamp only
    setStats(prev => ({
      ...prev,
      lastUpdate: Date.now()
    }));
  }, []);

  // Sync with parent component if snapEnabled prop is provided - with proper check
  useEffect(() => {
    if (parentSnapEnabled !== undefined && parentSnapEnabled !== snapContext.snapEnabled) {

      snapContext.setSnapEnabled(parentSnapEnabled);
    }
  }, [parentSnapEnabled, snapContext.snapEnabled, snapContext]);

  return {
    enabledModes,
    stats: {
      enabled: snapEnabled,
      modes: stats.modes,
      entityCount: stats.entityCount,
      lastUpdate: stats.lastUpdate
    },
    toggleMode,
    refreshEntities,
    snapEnabled,
    toggleSnap,
  };
}
