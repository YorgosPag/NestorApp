/**
 * @file Global Stores - Grid & Ruler (Backward Compatibility)
 * @module settings-provider/globalStores
 *
 * ✅ ENTERPRISE: Backward compatible global stores
 *
 * These stores are used for Grid and Ruler settings synchronization
 * until they are migrated to the enterprise settings system.
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import type { GridSettings, RulerSettings } from '../systems/rulers-grid/config';
import { DEFAULT_GRID_SETTINGS, DEFAULT_RULER_SETTINGS } from '../systems/rulers-grid/config';

/**
 * Grid settings store interface
 */
interface GridSettingsStore {
  settings: GridSettings;
  listeners: Set<(settings: GridSettings) => void>;
  update: (updates: Partial<GridSettings>) => void;
  subscribe: (listener: (settings: GridSettings) => void) => () => void;
}

/**
 * Ruler settings store interface
 */
interface RulerSettingsStore {
  settings: RulerSettings;
  listeners: Set<(settings: RulerSettings) => void>;
  update: (updates: Partial<RulerSettings>) => void;
  subscribe: (listener: (settings: RulerSettings) => void) => () => void;
}

/**
 * Create grid settings store
 */
const createGridStore = (): GridSettingsStore => {
  let current = { ...DEFAULT_GRID_SETTINGS };
  const listeners = new Set<(settings: GridSettings) => void>();

  return {
    get settings() { return current; },
    listeners,
    update: (updates) => {
      current = { ...current, ...updates };
      listeners.forEach(listener => listener(current));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
};

/**
 * Create ruler settings store
 */
const createRulerStore = (): RulerSettingsStore => {
  let current = { ...DEFAULT_RULER_SETTINGS };
  const listeners = new Set<(settings: RulerSettings) => void>();

  return {
    get settings() { return current; },
    listeners,
    update: (updates) => {
      current = { ...current, ...updates };
      listeners.forEach(listener => listener(current));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
};

/**
 * Global stores for Grid and Ruler settings
 * (Exported for backward compatibility)
 */
export const globalGridStore = createGridStore();
export const globalRulerStore = createRulerStore();
