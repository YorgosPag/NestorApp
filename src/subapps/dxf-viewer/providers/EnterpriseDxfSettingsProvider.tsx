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
  settings: SettingsState;

  // Core actions
  updateLineSettings: (mode: StorageMode, updates: Partial<LineSettings>, layer: 'general' | 'specific' | 'overrides') => void;
  updateTextSettings: (mode: StorageMode, updates: Partial<TextSettings>, layer: 'general' | 'specific' | 'overrides') => void;
  updateGripSettings: (mode: StorageMode, updates: Partial<GripSettings>, layer: 'general' | 'specific' | 'overrides') => void;

  // Override toggles
  toggleLineOverride: (mode: StorageMode, enabled: boolean) => void;
  toggleTextOverride: (mode: StorageMode, enabled: boolean) => void;
  toggleGripOverride: (mode: StorageMode, enabled: boolean) => void;

  // Effective settings (computed)
  getEffectiveLineSettings: (mode: ViewerMode) => LineSettings;
  getEffectiveTextSettings: (mode: ViewerMode) => TextSettings;
  getEffectiveGripSettings: (mode: ViewerMode) => GripSettings;

  // Reset
  resetToDefaults: () => void;

  // Metadata
  isLoaded: boolean;
  isSaving: boolean;
  lastError: string | null;

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

  useEffect(() => {
    if (!enabled || !state.isLoaded) return; // Skip if disabled or not loaded

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
        });
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [driver, state.settings, state.isLoaded, enabled]);

  // ========================================================================
  // ACTIONS
  // ========================================================================

  const updateLineSettings = useCallback((
    mode: StorageMode,
    updates: Partial<LineSettings>,
    layer: 'general' | 'specific' | 'overrides'
  ) => {
    dispatch({ type: 'UPDATE_LINE', payload: { mode, updates, layer } });
  }, []);

  const updateTextSettings = useCallback((
    mode: StorageMode,
    updates: Partial<TextSettings>,
    layer: 'general' | 'specific' | 'overrides'
  ) => {
    dispatch({ type: 'UPDATE_TEXT', payload: { mode, updates, layer } });
  }, []);

  const updateGripSettings = useCallback((
    mode: StorageMode,
    updates: Partial<GripSettings>,
    layer: 'general' | 'specific' | 'overrides'
  ) => {
    dispatch({ type: 'UPDATE_GRIP', payload: { mode, updates, layer } });
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

  const getEffectiveLineSettings = useCallback((mode: ViewerMode): LineSettings => {
    return computeEffective(
      state.settings.line.general as unknown as Record<string, unknown>,
      state.settings.line.specific,
      state.settings.line.overrides,
      state.settings.overrideEnabled.line,
      mode
    ) as unknown as LineSettings;
  }, [state.settings]);

  const getEffectiveTextSettings = useCallback((mode: ViewerMode): TextSettings => {
    return computeEffective(
      state.settings.text.general as unknown as Record<string, unknown>,
      state.settings.text.specific,
      state.settings.text.overrides,
      state.settings.overrideEnabled.text,
      mode
    ) as unknown as TextSettings;
  }, [state.settings]);

  const getEffectiveGripSettings = useCallback((mode: ViewerMode): GripSettings => {
    return computeEffective(
      state.settings.grip.general as unknown as Record<string, unknown>,
      state.settings.grip.specific,
      state.settings.grip.overrides,
      state.settings.overrideEnabled.grip,
      mode
    ) as unknown as GripSettings;
  }, [state.settings]);

  // ========================================================================
  // CONTEXT VALUE
  // ========================================================================

  const contextValue = useMemo<EnterpriseDxfSettingsContextType>(() => ({
    // State
    settings: state.settings,

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

    // Metadata
    isLoaded: state.isLoaded,
    isSaving: state.isSaving,
    lastError: state.lastError,

    // Migration utilities
    migrationUtils: {
      isLegacyFormat,
      getMigrationInfo,
      triggerManualMigration: migrateFromLegacyProvider
    }
  }), [
    state,
    updateLineSettings,
    updateTextSettings,
    updateGripSettings,
    toggleLineOverride,
    toggleTextOverride,
    toggleGripOverride,
    resetToDefaults,
    getEffectiveLineSettings,
    getEffectiveTextSettings,
    getEffectiveGripSettings
  ]);

  // ========================================================================
  // RENDER
  // ========================================================================

  // If disabled, just render children (pass-through)
  if (!enabled) {
    return <>{children}</>;
  }

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
