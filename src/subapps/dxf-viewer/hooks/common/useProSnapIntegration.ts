'use client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useCurrentLevelScene } from '../../systems/levels';
import { ExtendedSnapType } from '../../snapping/extended-types';
import { useSnapContext } from '../../snapping/context/SnapContext';

interface ProSnapIntegrationState {
  enabledModes: Set<ExtendedSnapType>;
  stats: { enabled: boolean; modes: ExtendedSnapType[]; entityCount: number; lastUpdate: number };
  toggleMode: (mode: ExtendedSnapType, enabled: boolean) => void;
  refreshEntities: () => void;
  snapEnabled: boolean;
  toggleSnap: (enabled?: boolean) => void;
}

export function useProSnapIntegration(parentSnapEnabled?: boolean): ProSnapIntegrationState {
  const scene = useCurrentLevelScene();

  // Χρήση του ενοποιημένου SnapContext
  const snapContext = useSnapContext();

  // 🚀 PERF (2026-02-21): Ref for stable callback access to snapContext.
  // BEFORE: snapContext as dependency in callbacks → new callback ref on every context change.
  // AFTER: Callbacks read from ref → stable across renders.
  const snapContextRef = useRef(snapContext);
  snapContextRef.current = snapContext;

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
  const entities = useMemo(() => scene?.entities ?? [], [scene]);

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
    snapContextRef.current.toggleMode(mode, enabled);
  }, []); // 🚀 PERF: Stable — reads from ref

  const toggleSnap = useCallback((enabled?: boolean) => {
    const ctx = snapContextRef.current;
    const newEnabled = enabled !== undefined ? enabled : !ctx.snapEnabled;
    ctx.setSnapEnabled(newEnabled);
  }, []); // 🚀 PERF: Stable — reads from ref

  const refreshEntities = useCallback(() => {

    // Force refresh by updating timestamp only
    setStats(prev => ({
      ...prev,
      lastUpdate: Date.now()
    }));
  }, []);

  // Sync with parent component if snapEnabled prop is provided - with proper check
  useEffect(() => {
    const ctx = snapContextRef.current;
    if (parentSnapEnabled !== undefined && parentSnapEnabled !== ctx.snapEnabled) {
      ctx.setSnapEnabled(parentSnapEnabled);
    }
  }, [parentSnapEnabled, snapContext.snapEnabled]);

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
