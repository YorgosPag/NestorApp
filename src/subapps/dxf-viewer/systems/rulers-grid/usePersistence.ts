import { useCallback, useEffect } from 'react';
import type { Point2D } from './config';
import type { RulerSettings, GridSettings } from './config';
// 🏢 ADR-092: Centralized localStorage Service
import { storageGet, storageSet } from '../../utils/storage-utils';

interface PersistedData {
  rulers?: Partial<RulerSettings>;
  grid?: Partial<GridSettings>;
  origin?: Point2D;
  isVisible?: boolean;
  timestamp?: number;
}

export interface PersistenceHook {
  loadPersistedSettings: () => PersistedData | null;
  persistedData: PersistedData | null;
}

/**
 * Shared hook for loading persisted settings from localStorage
 * 🏢 ADR-092: Using centralized storage-utils
 */
export function useLoadPersistedSettings(enablePersistence: boolean, persistenceKey: string): () => PersistedData | null {
  return useCallback(() => {
    if (!enablePersistence) return null;
    return storageGet<PersistedData | null>(persistenceKey, null);
  }, [enablePersistence, persistenceKey]);
}

export function usePersistence(
  enablePersistence: boolean,
  persistenceKey: string,
  rulers: RulerSettings,
  grid: GridSettings,
  origin: Point2D,
  isVisible: boolean
): PersistenceHook {
  const loadPersistedSettings = useLoadPersistedSettings(enablePersistence, persistenceKey);

  const persistedData = loadPersistedSettings();

  // Persistence effect
  // 🏢 ADR-092: Using centralized storage-utils
  useEffect(() => {
    if (enablePersistence) {
      const dataToStore: PersistedData = {
        rulers,
        grid,
        origin,
        isVisible,
        timestamp: Date.now()
      };
      storageSet(persistenceKey, dataToStore);
    }
  }, [rulers, grid, origin, isVisible, enablePersistence, persistenceKey]);

  return {
    loadPersistedSettings,
    persistedData
  };
}