import { useCallback, useEffect } from 'react';
import type { Point2D } from './config';
import type { RulerSettings, GridSettings } from './config';

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
 */
export function useLoadPersistedSettings(enablePersistence: boolean, persistenceKey: string): () => PersistedData | null {
  return useCallback(() => {
    if (!enablePersistence) return null;
    try {
      const stored = localStorage.getItem(persistenceKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
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
  useEffect(() => {
    if (enablePersistence) {
      const dataToStore = {
        rulers,
        grid,
        origin,
        isVisible,
        timestamp: Date.now()
      };
      try {
        localStorage.setItem(persistenceKey, JSON.stringify(dataToStore));
      } catch (error) {
        console.warn('Failed to persist rulers/grid settings:', error);
      }
    }
  }, [rulers, grid, origin, isVisible, enablePersistence, persistenceKey]);

  return {
    loadPersistedSettings,
    persistedData
  };
}