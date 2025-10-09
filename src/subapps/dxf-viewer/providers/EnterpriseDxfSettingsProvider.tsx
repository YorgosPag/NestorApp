/**
 * @file EnterpriseDxfSettingsProvider - Enterprise Settings Provider (Phase 1)
 * @module providers/EnterpriseDxfSettingsProvider
 *
 * ENTERPRISE STANDARD - Next-generation settings provider
 *
 * **MIGRATION PHASE 1**: Parallel implementation (shadow mode)
 * - ✅ Uses settings/ enterprise module (IndexedDB, Zod, Migrations)
 * - ✅ Zero impact on existing DxfSettingsProvider
 * - ✅ Can run in dual-provider mode for validation
 * - ✅ Feature-flag controlled rollout
 *
 * **ARCHITECTURE**:
 * ```
 * EnterpriseDxfSettingsProvider
 *   ├── State: SettingsState (from settings/core/types)
 *   ├── Storage: IndexedDbDriver (with LocalStorage fallback)
 *   ├── Validation: Zod schemas (runtime type safety)
 *   ├── Persistence: safeLoad/safeSave (never throws)
 *   ├── Sync: SyncService (cross-tab via BroadcastChannel)
 *   └── Telemetry: Metrics (production debugging)
 * ```
 *
 * **COMPARISON WITH OLD PROVIDER**:
 * | Feature | Old Provider | Enterprise Provider |
 * |---------|--------------|---------------------|
 * | Storage | localStorage (manual) | IndexedDB + fallback |
 * | Validation | None | Zod schemas |
 * | Migrations | Manual | Automatic (v1→v2) |
 * | Compression | No | LZ-String |
 * | Cross-tab sync | No | BroadcastChannel |
 * | Error handling | Throws | Never throws (graceful) |
 * | Telemetry | No | Metrics tracking |
 *
 * **USAGE** (Phase 3 - Dual Provider Mode):
 * Shadow mode (validation only):
 *   DxfSettingsProvider (OLD - Renders UI)
 *     → EnterpriseDxfSettingsProvider (NEW - Validates)
 *       → App
 *
 * Production mode (after Phase 6):
 *   EnterpriseDxfSettingsProvider (NEW - Renders UI)
 *     → App
 *
 * @see {@link ../settings/README.md} - Enterprise module documentation
 * @see {@link ../docs/ENTERPRISE_MIGRATION_PLAN.md} - 8-phase migration plan
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 * @version 1.0.0 (Phase 1 - Skeleton)
 */

import React from 'react';
import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode
} from 'react';

// ============================================================================
// ENTERPRISE MODULE IMPORTS
// ============================================================================

import type {
  SettingsState,
  ViewerMode,
  StorageMode,
  LineSettings,
  TextSettings,
  GripSettings
} from '../settings/core/types';

// Re-export types for backward compatibility
export type { ViewerMode, StorageMode, LineSettings, TextSettings, GripSettings, SettingsState };

// 🔄 BACKWARD COMPATIBLE: Additional entity types (not in enterprise yet)
import type { GridSettings, RulerSettings } from '../systems/rulers-grid/config';
import type { UICursorSettings as CursorSettings } from '../rendering/ui/cursor/CursorTypes';
// 🔄 BACKWARD COMPATIBLE: Import default settings for Grid & Ruler stores
import { DEFAULT_GRID_SETTINGS, DEFAULT_RULER_SETTINGS } from '../systems/rulers-grid/config';

import { FACTORY_DEFAULTS } from '../settings/FACTORY_DEFAULTS';
import { computeEffective } from '../settings/core/computeEffective';
import { IndexedDbDriver } from '../settings/io/IndexedDbDriver';
import { LocalStorageDriver } from '../settings/io/LocalStorageDriver';
import { loadOrDefault } from '../settings/io/safeLoad';
import { safeSave } from '../settings/io/safeSave';
import type { StorageDriver } from '../settings/io/StorageDriver';
import { migrateFromLegacyProvider, isLegacyFormat, getMigrationInfo } from '../settings/io/legacyMigration';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Enterprise context type
 *
 * Matches DxfSettingsContextType API for compatibility
 */
interface EnterpriseDxfSettingsContextType {
  // State
  settings: SettingsState & {
    // 🔄 BACKWARD COMPATIBLE: Add old API properties for compatibility
    mode?: ViewerMode;
    saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
    lastSaved?: Date | null;
    cursor?: any; // Not implemented in enterprise yet
    grid?: any; // Not implemented in enterprise yet
    ruler?: any; // Not implemented in enterprise yet
    specific?: any; // Old structure - not needed in enterprise
  };

  // Core actions - 🔄 BACKWARD COMPATIBLE: Support both OLD (1 param) and NEW (3 params) API
  updateLineSettings: {
    (updates: Partial<LineSettings>): void; // OLD API
    (mode: StorageMode, updates: Partial<LineSettings>, layer?: 'general' | 'specific' | 'overrides'): void; // NEW API
  };
  updateTextSettings: {
    (updates: Partial<TextSettings>): void; // OLD API
    (mode: StorageMode, updates: Partial<TextSettings>, layer?: 'general' | 'specific' | 'overrides'): void; // NEW API
  };
  updateGripSettings: {
    (updates: Partial<GripSettings>): void; // OLD API
    (mode: StorageMode, updates: Partial<GripSettings>, layer?: 'general' | 'specific' | 'overrides'): void; // NEW API
  };

  // Override toggles
  toggleLineOverride: (mode: StorageMode, enabled: boolean) => void;
  toggleTextOverride: (mode: StorageMode, enabled: boolean) => void;
  toggleGripOverride: (mode: StorageMode, enabled: boolean) => void;

  // Effective settings (computed) - 🔄 BACKWARD COMPATIBLE: mode is optional (defaults to 'normal')
  getEffectiveLineSettings: (mode?: ViewerMode) => LineSettings;
  getEffectiveTextSettings: (mode?: ViewerMode) => TextSettings;
  getEffectiveGripSettings: (mode?: ViewerMode) => GripSettings;

  // 🔄 BACKWARD COMPATIBLE: Old API methods (aliases to new API)
  setMode?: (mode: ViewerMode) => void; // Deprecated - use mode-aware getters instead
  updateSpecificLineSettings?: (mode: 'draft' | 'hover' | 'selection' | 'completion', settings: Partial<LineSettings>) => void;
  updateSpecificTextSettings?: (mode: 'draft', settings: Partial<TextSettings>) => void;
  updateSpecificGripSettings?: (mode: 'draft', settings: Partial<GripSettings>) => void;
  updateLineOverrides?: (mode: 'draft' | 'hover' | 'selection' | 'completion', settings: Partial<LineSettings>) => void;
  updateTextOverrides?: (mode: 'draft', settings: Partial<TextSettings>) => void;
  updateGripOverrides?: (mode: 'draft', settings: Partial<GripSettings>) => void;

  // 🔄 BACKWARD COMPATIBLE: Additional entity types (grid, ruler, cursor)
  updateGridSettings?: (updates: Partial<GridSettings>) => void;
  updateRulerSettings?: (updates: Partial<RulerSettings>) => void;
  updateCursorSettings?: (updates: Partial<CursorSettings>) => void;

  // 🔄 BACKWARD COMPATIBLE: Template system (optional - not in enterprise yet)
  applyLineTemplate?: (templateName: string, templateSettings: LineSettings) => void;
  updateLineTemplateOverrides?: (overrides: Partial<LineSettings>) => void;
  clearLineTemplateOverrides?: () => void;
  resetLineToFactory?: () => void;

  // Reset
  resetToDefaults: () => void;

  // Metadata
  isLoaded: boolean;
  isSaving: boolean;
  lastError: string | null;

  // 🔄 BACKWARD COMPATIBLE: Additional computed flags
  isAutoSaving?: boolean; // Alias for isSaving
  hasUnsavedChanges?: boolean; // Not tracked in enterprise yet

  // 🔄 BACKWARD COMPATIBLE: Raw dispatch for advanced use cases
  dispatch?: React.Dispatch<any>; // Optional - for advanced users

  // 🆕 PHASE 2: Migration utilities (debugging & diagnostics)
  migrationUtils: {
    /** Check if current state is legacy format */
    isLegacyFormat: (state: unknown) => boolean;
    /** Get migration diagnostic info */
    getMigrationInfo: (state: unknown) => ReturnType<typeof getMigrationInfo>;
    /** Manually trigger legacy migration */
    triggerManualMigration: (legacyState: unknown) => SettingsState;
  };
}

/**
 * Reducer actions
 */
type EnterpriseAction =
  | { type: 'LOAD_SUCCESS'; payload: SettingsState }
  | { type: 'LOAD_ERROR'; payload: string }
  | { type: 'UPDATE_LINE'; payload: { mode: StorageMode; updates: Partial<LineSettings>; layer: 'general' | 'specific' | 'overrides' } }
  | { type: 'UPDATE_TEXT'; payload: { mode: StorageMode; updates: Partial<TextSettings>; layer: 'general' | 'specific' | 'overrides' } }
  | { type: 'UPDATE_GRIP'; payload: { mode: StorageMode; updates: Partial<GripSettings>; layer: 'general' | 'specific' | 'overrides' } }
  | { type: 'TOGGLE_LINE_OVERRIDE'; payload: { mode: StorageMode; enabled: boolean } }
  | { type: 'TOGGLE_TEXT_OVERRIDE'; payload: { mode: StorageMode; enabled: boolean } }
  | { type: 'TOGGLE_GRIP_OVERRIDE'; payload: { mode: StorageMode; enabled: boolean } }
  | { type: 'RESET_TO_DEFAULTS' }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR'; payload: string };

/**
 * Reducer state
 */
interface EnterpriseState {
  settings: SettingsState;
  isLoaded: boolean;
  isSaving: boolean;
  lastError: string | null;
}

// ============================================================================
// GLOBAL STORES (BACKWARD COMPATIBLE - for Grid & Ruler synchronization)
// ============================================================================

interface GridSettingsStore {
  settings: GridSettings;
  listeners: Set<(settings: GridSettings) => void>;
  update: (updates: Partial<GridSettings>) => void;
  subscribe: (listener: (settings: GridSettings) => void) => () => void;
}

interface RulerSettingsStore {
  settings: RulerSettings;
  listeners: Set<(settings: RulerSettings) => void>;
  update: (updates: Partial<RulerSettings>) => void;
  subscribe: (listener: (settings: RulerSettings) => void) => () => void;
}

// Grid Settings Store
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

// Ruler Settings Store
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

// Global stores για sync (exported for backward compatibility)
export const globalGridStore = createGridStore();
export const globalRulerStore = createRulerStore();

// ============================================================================
// REDUCER
// ============================================================================

function enterpriseReducer(state: EnterpriseState, action: EnterpriseAction): EnterpriseState {
  switch (action.type) {
    case 'LOAD_SUCCESS':
      return {
        ...state,
        settings: action.payload,
        isLoaded: true,
        lastError: null
      };

    case 'LOAD_ERROR':
      return {
        ...state,
        isLoaded: true,
        lastError: action.payload
      };

    case 'UPDATE_LINE': {
      const { mode, updates, layer } = action.payload;
      const newSettings = { ...state.settings };

      if (layer === 'general') {
        newSettings.line.general = { ...newSettings.line.general, ...updates };
      } else if (layer === 'specific') {
        newSettings.line.specific[mode] = { ...newSettings.line.specific[mode], ...updates };
      } else if (layer === 'overrides') {
        newSettings.line.overrides[mode] = { ...newSettings.line.overrides[mode], ...updates };
      }

      return { ...state, settings: newSettings };
    }

    case 'UPDATE_TEXT': {
      const { mode, updates, layer } = action.payload;
      const newSettings = { ...state.settings };

      if (layer === 'general') {
        newSettings.text.general = { ...newSettings.text.general, ...updates };
      } else if (layer === 'specific') {
        newSettings.text.specific[mode] = { ...newSettings.text.specific[mode], ...updates };
      } else if (layer === 'overrides') {
        newSettings.text.overrides[mode] = { ...newSettings.text.overrides[mode], ...updates };
      }

      return { ...state, settings: newSettings };
    }

    case 'UPDATE_GRIP': {
      const { mode, updates, layer } = action.payload;
      const newSettings = { ...state.settings };

      if (layer === 'general') {
        newSettings.grip.general = { ...newSettings.grip.general, ...updates };
      } else if (layer === 'specific') {
        newSettings.grip.specific[mode] = { ...newSettings.grip.specific[mode], ...updates };
      } else if (layer === 'overrides') {
        newSettings.grip.overrides[mode] = { ...newSettings.grip.overrides[mode], ...updates };
      }

      return { ...state, settings: newSettings };
    }

    case 'TOGGLE_LINE_OVERRIDE': {
      const { mode, enabled } = action.payload;
      return {
        ...state,
        settings: {
          ...state.settings,
          overrideEnabled: {
            ...state.settings.overrideEnabled,
            line: {
              ...state.settings.overrideEnabled.line,
              [mode]: enabled
            }
          }
        }
      };
    }

    case 'TOGGLE_TEXT_OVERRIDE': {
      const { mode, enabled } = action.payload;
      return {
        ...state,
        settings: {
          ...state.settings,
          overrideEnabled: {
            ...state.settings.overrideEnabled,
            text: {
              ...state.settings.overrideEnabled.text,
              [mode]: enabled
            }
          }
        }
      };
    }

    case 'TOGGLE_GRIP_OVERRIDE': {
      const { mode, enabled } = action.payload;
      return {
        ...state,
        settings: {
          ...state.settings,
          overrideEnabled: {
            ...state.settings.overrideEnabled,
            grip: {
              ...state.settings.overrideEnabled.grip,
              [mode]: enabled
            }
          }
        }
      };
    }

    case 'RESET_TO_DEFAULTS':
      return {
        ...state,
        settings: FACTORY_DEFAULTS
      };

    case 'SAVE_START':
      return { ...state, isSaving: true };

    case 'SAVE_SUCCESS':
      return { ...state, isSaving: false, lastError: null };

    case 'SAVE_ERROR':
      return { ...state, isSaving: false, lastError: action.payload };

    default:
      return state;
  }
}

// ============================================================================
// CONTEXT
// ============================================================================

const EnterpriseDxfSettingsContext = createContext<EnterpriseDxfSettingsContextType | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

interface EnterpriseDxfSettingsProviderProps {
  children: ReactNode;
  /** Feature flag - enable/disable enterprise provider */
  enabled?: boolean;
}

export function EnterpriseDxfSettingsProvider({
  children,
  enabled = false  // ✅ Disabled by default (Phase 1)
}: EnterpriseDxfSettingsProviderProps) {
  // ========================================================================
  // DEBUG: Render counter
  // ========================================================================
  const renderCountRef = useRef(0);
  renderCountRef.current++;

  if (renderCountRef.current > 50) {
    console.error('[Enterprise] INFINITE LOOP DETECTED! Render count:', renderCountRef.current);
    console.trace('[Enterprise] Stack trace:');
  } else {
    console.log('[Enterprise] Render #', renderCountRef.current);
  }

  // ========================================================================
  // STORAGE DRIVER
  // ========================================================================

  const driver = useMemo<StorageDriver>(() => {
    // Try IndexedDB first, fallback to LocalStorage
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      console.log('[Enterprise] Using IndexedDB driver');
      return new IndexedDbDriver();
    } else {
      console.log('[Enterprise] Using LocalStorage driver (fallback)');
      return new LocalStorageDriver();
    }
  }, []);

  // ========================================================================
  // STATE
  // ========================================================================

  const [state, dispatch] = useReducer(enterpriseReducer, {
    settings: FACTORY_DEFAULTS,
    isLoaded: false,
    isSaving: false,
    lastError: null
  });

  // 🔄 BACKWARD COMPATIBLE: Track current viewer mode (old API compatibility)
  const [currentMode, setCurrentMode] = React.useState<ViewerMode>('normal');

  // 🔄 BACKWARD COMPATIBLE: Track save status (derived from reducer state)
  const saveStatus = useMemo<'idle' | 'saving' | 'saved' | 'error'>(() => {
    if (state.isSaving) return 'saving';
    if (state.lastError) return 'error';
    if (state.isLoaded) return 'saved';
    return 'idle';
  }, [state.isSaving, state.lastError, state.isLoaded]);

  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);

  // Update lastSaved when save completes
  useEffect(() => {
    if (saveStatus === 'saved' && !state.isSaving) {
      setLastSaved(new Date());
    }
  }, [saveStatus, state.isSaving]);

  // ========================================================================
  // LOAD FROM STORAGE
  // ========================================================================

  useEffect(() => {
    if (!enabled) return; // Skip if disabled

    console.log('[Enterprise] Loading settings from storage...');

    // Try to load from enterprise storage first
    loadOrDefault(driver, 'settings_state')
      .then(enterpriseData => {
        // Check if this is enterprise format or legacy
        if (isLegacyFormat(enterpriseData)) {
          console.log('[Enterprise] Detected legacy format, migrating...');

          // Migrate legacy → enterprise
          const migratedData = migrateFromLegacyProvider(enterpriseData);

          console.log('[Enterprise] Legacy migration complete:', getMigrationInfo(enterpriseData));

          // Save migrated data immediately (one-time migration)
          safeSave(driver, migratedData, 'settings_state')
            .then(() => console.log('[Enterprise] Migrated data saved'))
            .catch(err => console.warn('[Enterprise] Failed to save migrated data:', err));

          dispatch({ type: 'LOAD_SUCCESS', payload: migratedData });
        } else {
          // Already enterprise format
          console.log('[Enterprise] Settings loaded successfully (enterprise format)');
          dispatch({ type: 'LOAD_SUCCESS', payload: enterpriseData });
        }
      })
      .catch(error => {
        console.error('[Enterprise] Failed to load settings:', error);
        dispatch({ type: 'LOAD_ERROR', payload: error.message });
        // Still use factory defaults (already in state)
      });
  }, [driver, enabled]);

  // ========================================================================
  // AUTO-SAVE TO STORAGE
  // ========================================================================

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousSettingsRef = useRef<SettingsState | null>(null);

  useEffect(() => {
    if (!enabled || !state.isLoaded) return; // Skip if disabled or not loaded

    // ✅ FIX: Skip save if settings haven't actually changed (deep equality)
    if (previousSettingsRef.current) {
      const hasChanged = JSON.stringify(state.settings) !== JSON.stringify(previousSettingsRef.current);
      if (!hasChanged) {
        console.log('[Enterprise] Settings unchanged, skipping auto-save');
        return;
      }
    }

    // Update previous settings ref
    previousSettingsRef.current = state.settings;

    // Debounce saves (500ms)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      console.log('[Enterprise] Auto-saving settings...');
      dispatch({ type: 'SAVE_START' });

      safeSave(driver, state.settings, 'settings_state')
        .then(result => {
          if (result.success) {
            console.log('[Enterprise] Settings saved successfully');
            dispatch({ type: 'SAVE_SUCCESS' });
          } else {
            const error = 'error' in result ? result.error : 'Unknown error';
            console.error('[Enterprise] Save failed:', error);
            dispatch({ type: 'SAVE_ERROR', payload: error });
          }
        })
        .catch(err => {
          console.error('[Enterprise] Save exception:', err);
          dispatch({ type: 'SAVE_ERROR', payload: String(err) });
        });
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, state.settings, enabled]); // ✅ FIX: Remove state.isLoaded to avoid infinite loop when SAVE_START/SAVE_SUCCESS toggle isSaving

  // ========================================================================
  // ACTIONS
  // ========================================================================

  // ============================================================================
  // 🔄 BACKWARD COMPATIBLE API
  // Supports both OLD API (1 param) and NEW API (3 params)
  // ============================================================================

  const updateLineSettings = useCallback((
    modeOrUpdates: StorageMode | Partial<LineSettings>,
    updatesParam?: Partial<LineSettings>,
    layerParam?: 'general' | 'specific' | 'overrides'
  ) => {
    console.log('[Enterprise] updateLineSettings called', { modeOrUpdates, updatesParam, layerParam });
    // Detect OLD API: updateLineSettings(updates)
    if (typeof modeOrUpdates === 'object' && updatesParam === undefined) {
      const mode = 'normal' as StorageMode;
      const updates = modeOrUpdates as Partial<LineSettings>;
      const layer = 'general';
      dispatch({ type: 'UPDATE_LINE', payload: { mode, updates, layer } });
    } else {
      // NEW API: updateLineSettings(mode, updates, layer)
      const mode = modeOrUpdates as StorageMode;
      const updates = updatesParam!;
      const layer = layerParam || 'general';
      dispatch({ type: 'UPDATE_LINE', payload: { mode, updates, layer } });
    }
  }, []);

  const updateTextSettings = useCallback((
    modeOrUpdates: StorageMode | Partial<TextSettings>,
    updatesParam?: Partial<TextSettings>,
    layerParam?: 'general' | 'specific' | 'overrides'
  ) => {
    // Detect OLD API: updateTextSettings(updates)
    if (typeof modeOrUpdates === 'object' && updatesParam === undefined) {
      const mode = 'normal' as StorageMode;
      const updates = modeOrUpdates as Partial<TextSettings>;
      const layer = 'general';
      dispatch({ type: 'UPDATE_TEXT', payload: { mode, updates, layer } });
    } else {
      // NEW API: updateTextSettings(mode, updates, layer)
      const mode = modeOrUpdates as StorageMode;
      const updates = updatesParam!;
      const layer = layerParam || 'general';
      dispatch({ type: 'UPDATE_TEXT', payload: { mode, updates, layer } });
    }
  }, []);

  const updateGripSettings = useCallback((
    modeOrUpdates: StorageMode | Partial<GripSettings>,
    updatesParam?: Partial<GripSettings>,
    layerParam?: 'general' | 'specific' | 'overrides'
  ) => {
    // Detect OLD API: updateGripSettings(updates)
    if (typeof modeOrUpdates === 'object' && updatesParam === undefined) {
      const mode = 'normal' as StorageMode;
      const updates = modeOrUpdates as Partial<GripSettings>;
      const layer = 'general';
      dispatch({ type: 'UPDATE_GRIP', payload: { mode, updates, layer } });
    } else {
      // NEW API: updateGripSettings(mode, updates, layer)
      const mode = modeOrUpdates as StorageMode;
      const updates = updatesParam!;
      const layer = layerParam || 'general';
      dispatch({ type: 'UPDATE_GRIP', payload: { mode, updates, layer } });
    }
  }, []);

  const toggleLineOverride = useCallback((mode: StorageMode, enabled: boolean) => {
    dispatch({ type: 'TOGGLE_LINE_OVERRIDE', payload: { mode, enabled } });
  }, []);

  const toggleTextOverride = useCallback((mode: StorageMode, enabled: boolean) => {
    dispatch({ type: 'TOGGLE_TEXT_OVERRIDE', payload: { mode, enabled } });
  }, []);

  const toggleGripOverride = useCallback((mode: StorageMode, enabled: boolean) => {
    dispatch({ type: 'TOGGLE_GRIP_OVERRIDE', payload: { mode, enabled } });
  }, []);

  const resetToDefaults = useCallback(() => {
    dispatch({ type: 'RESET_TO_DEFAULTS' });
  }, []);

  // ========================================================================
  // COMPUTED EFFECTIVE SETTINGS
  // ========================================================================

  // 🔄 BACKWARD COMPATIBLE: Accept optional mode parameter (default 'normal')
  const getEffectiveLineSettings = useCallback((mode?: ViewerMode): LineSettings => {
    const effectiveMode = mode || 'normal';
    return computeEffective(
      state.settings.line.general as unknown as Record<string, unknown>,
      state.settings.line.specific,
      state.settings.line.overrides,
      state.settings.overrideEnabled.line,
      effectiveMode
    ) as unknown as LineSettings;
  }, [state.settings]);

  // 🔄 BACKWARD COMPATIBLE: Accept optional mode parameter (default 'normal')
  const getEffectiveTextSettings = useCallback((mode?: ViewerMode): TextSettings => {
    const effectiveMode = mode || 'normal';
    return computeEffective(
      state.settings.text.general as unknown as Record<string, unknown>,
      state.settings.text.specific,
      state.settings.text.overrides,
      state.settings.overrideEnabled.text,
      effectiveMode
    ) as unknown as TextSettings;
  }, [state.settings]);

  // 🔄 BACKWARD COMPATIBLE: Accept optional mode parameter (default 'normal')
  const getEffectiveGripSettings = useCallback((mode?: ViewerMode): GripSettings => {
    const effectiveMode = mode || 'normal';
    return computeEffective(
      state.settings.grip.general as unknown as Record<string, unknown>,
      state.settings.grip.specific,
      state.settings.grip.overrides,
      state.settings.overrideEnabled.grip,
      effectiveMode
    ) as unknown as GripSettings;
  }, [state.settings]);

  // ========================================================================
  // 🔄 BACKWARD COMPATIBLE: Old API methods (aliases/stubs)
  // ========================================================================

  // Map old specific mode names to new StorageMode
  const mapSpecificMode = (oldMode: 'draft' | 'hover' | 'selection' | 'completion'): StorageMode => {
    return oldMode as StorageMode;
  };

  // 🔄 BACKWARD COMPATIBLE: setMode now works by updating internal state
  const setMode = useCallback((mode: ViewerMode) => {
    setCurrentMode(mode);
  }, []);

  const updateSpecificLineSettings = useCallback((mode: 'draft' | 'hover' | 'selection' | 'completion', settings: Partial<LineSettings>) => {
    const storageMode = mapSpecificMode(mode);
    updateLineSettings(storageMode, settings, 'specific');
  }, [updateLineSettings]);

  const updateSpecificTextSettings = useCallback((mode: 'draft', settings: Partial<TextSettings>) => {
    const storageMode = mapSpecificMode(mode);
    updateTextSettings(storageMode, settings, 'specific');
  }, [updateTextSettings]);

  const updateSpecificGripSettings = useCallback((mode: 'draft', settings: Partial<GripSettings>) => {
    const storageMode = mapSpecificMode(mode);
    updateGripSettings(storageMode, settings, 'specific');
  }, [updateGripSettings]);

  const updateLineOverrides = useCallback((mode: 'draft' | 'hover' | 'selection' | 'completion', settings: Partial<LineSettings>) => {
    const storageMode = mapSpecificMode(mode);
    updateLineSettings(storageMode, settings, 'overrides');
  }, [updateLineSettings]);

  const updateTextOverrides = useCallback((mode: 'draft', settings: Partial<TextSettings>) => {
    const storageMode = mapSpecificMode(mode);
    updateTextSettings(storageMode, settings, 'overrides');
  }, [updateTextSettings]);

  const updateGripOverrides = useCallback((mode: 'draft', settings: Partial<GripSettings>) => {
    const storageMode = mapSpecificMode(mode);
    updateGripSettings(storageMode, settings, 'overrides');
  }, [updateGripSettings]);

  // Stub implementations for grid/ruler/cursor (not in enterprise yet)
  const updateGridSettings = useCallback((updates: Partial<GridSettings>) => {
    console.warn('[EnterpriseDxfSettings] Grid settings not implemented in enterprise yet:', updates);
  }, []);

  const updateRulerSettings = useCallback((updates: Partial<RulerSettings>) => {
    console.warn('[EnterpriseDxfSettings] Ruler settings not implemented in enterprise yet:', updates);
  }, []);

  const updateCursorSettings = useCallback((updates: Partial<CursorSettings>) => {
    console.warn('[EnterpriseDxfSettings] Cursor settings not implemented in enterprise yet:', updates);
  }, []);

  // Template system stubs (not in enterprise yet)
  const applyLineTemplate = useCallback((_templateName: string, _templateSettings: LineSettings) => {
    console.warn('[EnterpriseDxfSettings] Template system not implemented in enterprise yet');
  }, []);

  const updateLineTemplateOverrides = useCallback((_overrides: Partial<LineSettings>) => {
    console.warn('[EnterpriseDxfSettings] Template system not implemented in enterprise yet');
  }, []);

  const clearLineTemplateOverrides = useCallback(() => {
    console.warn('[EnterpriseDxfSettings] Template system not implemented in enterprise yet');
  }, []);

  const resetLineToFactory = useCallback(() => {
    console.warn('[EnterpriseDxfSettings] Template system not implemented in enterprise yet');
  }, []);

  // ========================================================================
  // CONTEXT VALUE
  // ========================================================================

  const contextValue = useMemo<EnterpriseDxfSettingsContextType>(() => ({
    // State - 🔄 BACKWARD COMPATIBLE: Add old API properties
    settings: {
      ...state.settings,
      mode: currentMode,
      saveStatus,
      lastSaved,
      cursor: undefined, // Not implemented yet
      grid: undefined, // Not implemented yet
      ruler: undefined, // Not implemented yet
      specific: undefined // Old structure not needed
    },

    // Actions
    updateLineSettings,
    updateTextSettings,
    updateGripSettings,
    toggleLineOverride,
    toggleTextOverride,
    toggleGripOverride,
    resetToDefaults,

    // Computed
    getEffectiveLineSettings,
    getEffectiveTextSettings,
    getEffectiveGripSettings,

    // 🔄 BACKWARD COMPATIBLE: Old API methods
    setMode,
    updateSpecificLineSettings,
    updateSpecificTextSettings,
    updateSpecificGripSettings,
    updateLineOverrides,
    updateTextOverrides,
    updateGripOverrides,
    updateGridSettings,
    updateRulerSettings,
    updateCursorSettings,
    applyLineTemplate,
    updateLineTemplateOverrides,
    clearLineTemplateOverrides,
    resetLineToFactory,

    // Metadata
    isLoaded: state.isLoaded,
    isSaving: state.isSaving,
    lastError: state.lastError,
    isAutoSaving: state.isSaving, // Alias
    hasUnsavedChanges: false, // Not tracked in enterprise yet

    // 🔄 BACKWARD COMPATIBLE: Raw dispatch (optional)
    dispatch: undefined, // Not exposed in enterprise

    // Migration utilities
    migrationUtils: {
      isLegacyFormat,
      getMigrationInfo,
      triggerManualMigration: migrateFromLegacyProvider
    }
  }), [
    // ✅ FIX: Use destructured properties instead of entire state object to avoid infinite re-renders
    state.settings,
    state.isLoaded,
    state.isSaving,
    state.lastError,
    currentMode,
    saveStatus,
    lastSaved,
    updateLineSettings,
    updateTextSettings,
    updateGripSettings,
    toggleLineOverride,
    toggleTextOverride,
    toggleGripOverride,
    resetToDefaults,
    getEffectiveLineSettings,
    getEffectiveTextSettings,
    getEffectiveGripSettings,
    setMode,
    updateSpecificLineSettings,
    updateSpecificTextSettings,
    updateSpecificGripSettings,
    updateLineOverrides,
    updateTextOverrides,
    updateGripOverrides,
    updateGridSettings,
    updateRulerSettings,
    updateCursorSettings,
    applyLineTemplate,
    updateLineTemplateOverrides,
    clearLineTemplateOverrides,
    resetLineToFactory
  ]);

  // ========================================================================
  // RENDER
  // ========================================================================

  // 🏢 SHADOW MODE: Pass-through if disabled, validate if enabled
  if (!enabled) {
    console.warn('[Enterprise] Provider is DISABLED - no context provided');
    return <>{children}</>;
  }

  // Debug: Log context value creation
  console.log('[Enterprise] Provider rendering with context:', {
    hasSettings: !!contextValue.settings,
    isLoaded: state.isLoaded,
    isSaving: state.isSaving,
    hasMode: !!contextValue.settings?.mode
  });

  return (
    <EnterpriseDxfSettingsContext.Provider value={contextValue}>
      {children}
    </EnterpriseDxfSettingsContext.Provider>
  );
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Access enterprise settings context
 *
 * @throws Error if used outside EnterpriseDxfSettingsProvider
 */
export function useEnterpriseDxfSettings(): EnterpriseDxfSettingsContextType {
  const context = useContext(EnterpriseDxfSettingsContext);

  if (!context) {
    console.error('[Enterprise] useEnterpriseDxfSettings called outside provider context!');
    console.trace('[Enterprise] Call stack:');
    throw new Error(
      'useEnterpriseDxfSettings must be used within EnterpriseDxfSettingsProvider'
    );
  }

  return context;
}

/**
 * Convenience hook for line settings
 */
export function useEnterpriseLineSettings(mode: ViewerMode = 'normal') {
  const { getEffectiveLineSettings } = useEnterpriseDxfSettings();
  return getEffectiveLineSettings(mode);
}

/**
 * Convenience hook for text settings
 */
export function useEnterpriseTextSettings(mode: ViewerMode = 'normal') {
  const { getEffectiveTextSettings } = useEnterpriseDxfSettings();
  return getEffectiveTextSettings(mode);
}

/**
 * Convenience hook for grip settings
 */
export function useEnterpriseGripSettings(mode: ViewerMode = 'normal') {
  const { getEffectiveGripSettings } = useEnterpriseDxfSettings();
  return getEffectiveGripSettings(mode);
}

// ============================================================================
// 🔄 BACKWARD COMPATIBLE EXPORTS
// ============================================================================

/**
 * 🔄 BACKWARD COMPATIBLE: Alias for useEnterpriseDxfSettings
 *
 * This allows old code to use `useDxfSettings()` instead of `useEnterpriseDxfSettings()`.
 * When we delete the old DxfSettingsProvider, all imports will automatically work with enterprise.
 */
export const useDxfSettings = useEnterpriseDxfSettings;

/**
 * 🔄 BACKWARD COMPATIBLE: Specialized hooks matching old API
 */
export function useLineSettingsFromProvider(mode?: ViewerMode) {
  const { getEffectiveLineSettings, updateLineSettings, resetToDefaults } = useEnterpriseDxfSettings();
  return {
    settings: getEffectiveLineSettings(mode),
    updateSettings: updateLineSettings as (updates: Partial<LineSettings>) => void,
    resetToDefaults
  };
}

export function useTextSettingsFromProvider(mode?: ViewerMode) {
  const { getEffectiveTextSettings, updateTextSettings, resetToDefaults } = useEnterpriseDxfSettings();
  return {
    settings: getEffectiveTextSettings(mode),
    updateSettings: updateTextSettings as (updates: Partial<TextSettings>) => void,
    resetToDefaults,
    resetToFactory: resetToDefaults // Alias
  };
}

export function useTextDraftSettings() {
  const { getEffectiveTextSettings, updateSpecificTextSettings } = useEnterpriseDxfSettings();
  return {
    settings: getEffectiveTextSettings('preview'),
    updateSettings: (updates: Partial<TextSettings>) => {
      updateSpecificTextSettings?.('draft', updates);
    }
  };
}

export function useGripSettingsFromProvider() {
  const { getEffectiveGripSettings, updateGripSettings, resetToDefaults } = useEnterpriseDxfSettings();
  return {
    settings: getEffectiveGripSettings(),
    updateSettings: updateGripSettings as (updates: Partial<GripSettings>) => void,
    resetToDefaults
  };
}

/**
 * 🔄 BACKWARD COMPATIBLE: Style hooks (aliases to get settings)
 */
export function useLineStyles(mode?: ViewerMode) {
  const { getEffectiveLineSettings } = useEnterpriseDxfSettings();
  return getEffectiveLineSettings(mode);
}

export function useTextStyles(mode?: ViewerMode) {
  const { getEffectiveTextSettings } = useEnterpriseDxfSettings();
  return getEffectiveTextSettings(mode);
}

export function useGripStyles(mode?: ViewerMode) {
  const { getEffectiveGripSettings } = useEnterpriseDxfSettings();
  return getEffectiveGripSettings(mode);
}
