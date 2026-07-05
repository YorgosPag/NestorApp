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
import { createExternalStore } from '../stores/createExternalStore';

/**
 * Grid settings store interface
 */
interface GridSettingsStore {
  settings: GridSettings;
  update: (updates: Partial<GridSettings>) => void;
  subscribe: (listener: (settings: GridSettings) => void) => () => void;
}

/**
 * Ruler settings store interface
 */
interface RulerSettingsStore {
  settings: RulerSettings;
  update: (updates: Partial<RulerSettings>) => void;
  subscribe: (listener: (settings: RulerSettings) => void) => () => void;
}

/**
 * Create grid settings store
 *
 * SSoT pub/sub via createExternalStore (WAVE 2.8): the hand-rolled
 * `let current` + inline listener-Set cell now lives on the factory. The public
 * `subscribe(settings => …)` payload contract is preserved by wrapping the
 * factory's parameterless listener so it forwards the current snapshot.
 */
const createGridStore = (): GridSettingsStore => {
  const store = createExternalStore<GridSettings>({ ...DEFAULT_GRID_SETTINGS });

  return {
    get settings() { return store.get(); },
    update: (updates) => {
      store.set({ ...store.get(), ...updates });
    },
    subscribe: (listener) => store.subscribe(() => listener(store.get())),
  };
};

/**
 * Create ruler settings store
 */
const createRulerStore = (): RulerSettingsStore => {
  const store = createExternalStore<RulerSettings>({ ...DEFAULT_RULER_SETTINGS });

  return {
    get settings() { return store.get(); },
    update: (updates) => {
      store.set({ ...store.get(), ...updates });
    },
    subscribe: (listener) => store.subscribe(() => listener(store.get())),
  };
};

/**
 * Global stores for Grid and Ruler settings
 * (Exported for backward compatibility)
 */
export const globalGridStore = createGridStore();
export const globalRulerStore = createRulerStore();
