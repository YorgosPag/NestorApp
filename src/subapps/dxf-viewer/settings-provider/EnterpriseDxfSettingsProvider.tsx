/**
 * @file EnterpriseDxfSettingsProvider - Enterprise Settings Provider (Modular)
 * @module settings-provider/EnterpriseDxfSettingsProvider
 *
 * ✅ ENTERPRISE: Single Responsibility - Orchestration only (NO business logic!)
 *
 * This provider is a THIN ORCHESTRATOR that composes extracted hooks:
 * - Storage hooks (load/save)
 * - State management hook (reducer)
 * - Actions hook (update/toggle/reset)
 * - Effective settings hook (computed settings)
 * - Store sync hook (backward compatibility)
 *
 * **ARCHITECTURE**:
 * ```
 * EnterpriseDxfSettingsProvider (THIS FILE - 200 lines)
 *   ├── useStorageDriver()          → storage/useStorageDriver.ts
 *   ├── useStorageLoad()            → storage/useStorageLoad.ts
 *   ├── useStorageSave()            → storage/useStorageSave.ts
 *   ├── useEnterpriseSettingsState() → hooks/useEnterpriseSettingsState.ts
 *   ├── useEnterpriseActions()      → hooks/useEnterpriseActions.ts
 *   ├── useEffectiveSettings()      → hooks/useEffectiveSettings.ts
 *   └── style-store hydration       → stores/style-store-sync.ts (SSoT writers)
 * ```
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import React from 'react';
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  type ReactNode
} from 'react';
import { ENTERPRISE_CONSTANTS } from './constants';

// Storage hooks
import { useStorageDriver } from './storage/useStorageDriver';
import { useStorageLoad } from './storage/useStorageLoad';
import { useStorageSave } from './storage/useStorageSave';

// State & Actions hooks
import { useEnterpriseSettingsState } from './hooks/useEnterpriseSettingsState';
import { useUserSettingsRepoSync } from './storage/useUserSettingsRepoSync';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useEnterpriseActions } from './hooks/useEnterpriseActions';
import { useEffectiveSettings } from './hooks/useEffectiveSettings';

// 🏢 SSoT store hydration: settings → legacy style stores via the SINGLE
// mapping writers (stores/style-store-sync.ts). This provider is the one
// runtime driver. The former hexagonal ports/adapters/createStoreSync layer
// was retired 2026-06-20 (it had become a dead second writer + dormant DI).
import {
  syncToolStyleStoreFromSettings,
  syncTextStyleStoreFromSettings,
  syncCompletionStyleStoreFromSettings,
} from '../stores/style-store-sync';
import { EXPERIMENTAL_FEATURES } from '../config/experimental-features';

// ✅ ENTERPRISE: Conditional Logging System
import { dlog, dwarn, derr } from '../debug/utils/devlog';

// Types
import type { ViewerMode, StorageMode, SettingsState } from '../settings/core/types';
import type { LineSettings, TextSettings } from '../settings-core/types';
import type { GripSettings } from '../types/gripSettings'; // Full GripSettings (with all properties)

// Re-export types for backward compatibility
export type { ViewerMode, StorageMode, LineSettings, TextSettings, GripSettings };
export { ENTERPRISE_CONSTANTS } from './constants';

// ============================================================================
// CONTEXT TYPE
// ============================================================================

/**
 * ✅ ENTERPRISE: Extended settings state with metadata
 */
export interface EnterpriseSettingsWithMetadata extends SettingsState {
  mode: ViewerMode;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
}

/**
 * Enterprise context type (backward compatible with old DxfSettingsProvider)
 */
interface EnterpriseDxfSettingsContextType {
  // Core settings state
  settings: EnterpriseSettingsWithMetadata;

  // Actions
  updateLineSettings: {
    (updates: Partial<LineSettings>): void;
    (mode: StorageMode, updates: Partial<LineSettings>, layer?: 'general' | 'specific' | 'overrides'): void;
  };
  updateTextSettings: {
    (updates: Partial<TextSettings>): void;
    (mode: StorageMode, updates: Partial<TextSettings>, layer?: 'general' | 'specific' | 'overrides'): void;
  };
  updateGripSettings: {
    (updates: Partial<GripSettings>): void;
    (mode: StorageMode, updates: Partial<GripSettings>, layer?: 'general' | 'specific' | 'overrides'): void;
  };

  // ✅ ENTERPRISE FIX: Missing specific update methods used by hooks
  updateSpecificLineSettings: (mode: StorageMode, updates: Partial<LineSettings>) => void;
  updateSpecificTextSettings: (mode: StorageMode, updates: Partial<TextSettings>) => void;
  updateSpecificGripSettings: (mode: StorageMode, updates: Partial<GripSettings>) => void;

  toggleLineOverride: (mode: StorageMode, enabled: boolean) => void;
  toggleTextOverride: (mode: StorageMode, enabled: boolean) => void;
  toggleGripOverride: (mode: StorageMode, enabled: boolean) => void;
  resetToDefaults: () => void;
  resetToFactory: () => void; // ✅ ENTERPRISE FIX: Added missing resetToFactory interface member

  // Computed
  getEffectiveLineSettings: (mode?: ViewerMode) => LineSettings;
  getEffectiveTextSettings: (mode?: ViewerMode) => TextSettings;
  getEffectiveGripSettings: (mode?: ViewerMode) => GripSettings;

  // Mode management (backward compatibility with usePreviewMode)
  setMode: (mode: ViewerMode) => void;

  // Metadata
  isLoaded: boolean;
  isSaving: boolean;
  isAutoSaving: boolean; // ✅ ENTERPRISE FIX: Added for CentralizedAutoSaveStatus.tsx
  hasUnsavedChanges: boolean; // ✅ ENTERPRISE FIX: Added for CentralizedAutoSaveStatus.tsx
  lastError: string | null;

  // Storage Quota (Enterprise)
  storageQuota?: {
    available: number;
    usage: number;
    usagePercent: number;
    isStorageCritical: boolean;
    isMemoryMode: boolean;
  };
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
  enabled = false
}: EnterpriseDxfSettingsProviderProps) {
  // ========================================================================
  // DEBUG: Render counter
  // ========================================================================
  // Rate-based loop detector: count renders within a sliding burst window.
  // The counter resets once RENDER_LOOP_WINDOW_MS elapses without a burst, so
  // legitimate long-session re-renders never accumulate into a false positive.
  // Only a genuine tight loop reaches the threshold before the window resets.
  const renderCountRef = useRef(0);
  const renderWindowStartRef = useRef(0);
  const renderNow = typeof performance !== 'undefined' ? performance.now() : 0;

  renderCountRef.current++;
  if (renderWindowStartRef.current === 0) {
    renderWindowStartRef.current = renderNow;
  } else if (renderNow - renderWindowStartRef.current > ENTERPRISE_CONSTANTS.RENDER_LOOP_WINDOW_MS) {
    // Window elapsed without a burst → normal usage; restart the window.
    renderCountRef.current = 1;
    renderWindowStartRef.current = renderNow;
  }

  if (renderCountRef.current > ENTERPRISE_CONSTANTS.RENDER_LOOP_THRESHOLD) {
    derr(
      '[Enterprise] INFINITE LOOP DETECTED! Render count:',
      renderCountRef.current,
      `within ${ENTERPRISE_CONSTANTS.RENDER_LOOP_WINDOW_MS}ms`
    );
    console.trace('[Enterprise] Stack trace:');
    // Reset so a single transient burst does not re-fire on every render.
    renderCountRef.current = 1;
    renderWindowStartRef.current = renderNow;
  } else {
    dlog('[Enterprise] Render #', renderCountRef.current);
  }

  // ========================================================================
  // COMPOSED HOOKS (Orchestration)
  // ========================================================================

  // Storage driver (simplified - no quota management)
  const driver = useStorageDriver();

  // State management
  const { state, dispatch, currentMode, setCurrentMode, saveStatus, lastSaved } = useEnterpriseSettingsState();

  // ========================================================================
  // ✅ ENTERPRISE: MEMOIZED CALLBACKS (ChatGPT5 Solution - Prevents infinite loops)
  // ========================================================================

  // Storage load callbacks
  const onLoadSuccess = useCallback(
    (settings: SettingsState) => dispatch({ type: 'LOAD_SUCCESS', payload: settings }),
    [dispatch]
  );

  const onLoadError = useCallback(
    (error: string) => dispatch({ type: 'LOAD_ERROR', payload: error }),
    [dispatch]
  );

  // Storage save callbacks
  const onSaveStart = useCallback(
    () => dispatch({ type: 'SAVE_START' }),
    [dispatch]
  );

  const onSaveSuccess = useCallback(
    () => dispatch({ type: 'SAVE_SUCCESS' }),
    [dispatch]
  );

  const onSaveError = useCallback(
    (error: string) => dispatch({ type: 'SAVE_ERROR', payload: error }),
    [dispatch]
  );

  // Storage load with memoized callbacks
  useStorageLoad(driver, enabled, onLoadSuccess, onLoadError);

  // Storage save with memoized callbacks
  useStorageSave(
    driver,
    state.settings,
    state.isLoaded,
    enabled,
    onSaveStart,
    onSaveSuccess,
    onSaveError
  );

  // 🏢 ADR-XXX UserSettings SSoT — server-side mirror via Firestore-backed
  // userSettingsRepository (cross-device sync + audit trail). Local IndexedDB
  // remains as fast boot cache; Firestore is the source of truth.
  const { user } = useAuth();
  useUserSettingsRepoSync({
    userId: user?.uid ?? null,
    companyId: user?.companyId ?? null,
    enabled,
    isLoaded: state.isLoaded,
    settings: state.settings,
    onRemoteHydrate: onLoadSuccess,
  });

  // Actions
  const actions = useEnterpriseActions(dispatch);

  // Effective settings
  const effectiveSettings = useEffectiveSettings(state.settings);

  // ========================================================================
  // STORE HYDRATION (SSoT: settings → legacy style stores)
  // ========================================================================
  // Single runtime driver. Pushes FULL effective state into the legacy style
  // stores via the one mapping source (stores/style-store-sync.ts) once the
  // persisted settings have loaded — exactly what the old createStoreSync(...)
  // .start()/pushFromSettings() did, minus the dead hexagonal port indirection.
  //
  // ⚠️ GRIP IS DELIBERATELY EXCLUDED. `gripStyleStore` has a single authoritative
  // owner — `GripProvider` — which hydrates it (mount + on every change) from the
  // GENERAL effective grip settings (`getEffectiveGripSettings()`, base size 7).
  // The retired `storeSync` used a divergent `grip('preview')` → 'draft' mode here;
  // pushing that as a second writer raced GripProvider and made grips render the
  // wrong (draft-mode) size. One store, one owner.
  //
  // Per-entity effective modes: tool = 'preview', completion = 'completion',
  // text = default.
  useEffect(() => {
    if (!EXPERIMENTAL_FEATURES.ENABLE_SETTINGS_SYNC || !state.isLoaded) return;

    dlog('[Enterprise] Hydrating style stores from effective settings');

    syncToolStyleStoreFromSettings(effectiveSettings.getEffectiveLineSettings('preview'));
    syncCompletionStyleStoreFromSettings(effectiveSettings.getEffectiveLineSettings('completion'));
    syncTextStyleStoreFromSettings(effectiveSettings.getEffectiveTextSettings());
    // grip: owned by GripProvider — intentionally NOT written here (see above).
    // Initialize once when loaded (matches the prior pushFromSettings-on-mount
    // behaviour; ongoing per-change sync is handled by StyleManagerProvider).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isLoaded]);

  // ✅ ENTERPRISE: hydration runs once on load; per-change sync flows through
  // StyleManagerProvider's updateStore — no useEffect dependency cycles.

  // ========================================================================
  // STABLE QUOTA (Prevents infinite loops from changing quota objects)
  // ========================================================================

  // ⚠️ TEMPORARY: Static quota info to prevent infinite loops
  const stableQuotaInfo = useMemo(() => undefined, []);

  // ========================================================================
  // CONTEXT VALUE
  // ========================================================================

  const contextValue = useMemo<EnterpriseDxfSettingsContextType>(() => ({
    // Settings
    settings: {
      ...state.settings,
      mode: currentMode,
      saveStatus,
      lastSaved
    },

    // Actions
    ...actions,
    resetToFactory: actions.resetToDefaults,

    // Effective settings
    ...effectiveSettings,

    // Mode management (backward compatibility)
    setMode: setCurrentMode,

    // Metadata
    isLoaded: state.isLoaded,
    isSaving: state.isSaving,
    isAutoSaving: state.isSaving, // ✅ ENTERPRISE FIX: Use same value as isSaving for compatibility
    hasUnsavedChanges: false, // ✅ ENTERPRISE FIX: For now, default to false
    lastError: state.lastError,

    // Storage Quota (Enterprise) - Using stable reference
    storageQuota: stableQuotaInfo
  }), [
    state.settings,
    state.isLoaded,
    state.isSaving,
    state.lastError,
    currentMode,
    setCurrentMode,
    saveStatus,
    lastSaved,
    actions,
    effectiveSettings,
    stableQuotaInfo // ✅ ENTERPRISE: Stable quota reference prevents infinite loops
  ]);

  // ========================================================================
  // RENDER
  // ========================================================================

  // Shadow mode: Pass-through if disabled
  if (!enabled) {
    dwarn('[Enterprise] Provider is DISABLED - no context provided');
    return <>{children}</>;
  }

  dlog('[Enterprise] Provider rendering with context:', {
    hasSettings: !!contextValue.settings,
    isLoaded: state.isLoaded,
    isSaving: state.isSaving
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
    derr('[Enterprise] useEnterpriseDxfSettings called outside provider context!');
    console.trace('[Enterprise] Call stack:');
    throw new Error(
      'useEnterpriseDxfSettings must be used within EnterpriseDxfSettingsProvider'
    );
  }

  return context;
}

/**
 * Optional access - does not throw error if provider is missing
 */
export function useEnterpriseDxfSettingsOptional(): EnterpriseDxfSettingsContextType | null {
  return useContext(EnterpriseDxfSettingsContext);
}

/**
 * Convenience hooks for specific settings
 */
export function useEnterpriseLineSettings(mode: ViewerMode = ENTERPRISE_CONSTANTS.DEFAULT_VIEWER_MODE) {
  const { getEffectiveLineSettings } = useEnterpriseDxfSettings();
  return getEffectiveLineSettings(mode);
}

export function useEnterpriseTextSettings(mode: ViewerMode = ENTERPRISE_CONSTANTS.DEFAULT_VIEWER_MODE) {
  const { getEffectiveTextSettings } = useEnterpriseDxfSettings();
  return getEffectiveTextSettings(mode);
}

export function useEnterpriseGripSettings(mode: ViewerMode = ENTERPRISE_CONSTANTS.DEFAULT_VIEWER_MODE) {
  const { getEffectiveGripSettings } = useEnterpriseDxfSettings();
  return getEffectiveGripSettings(mode);
}

// ============================================================================
// BACKWARD COMPATIBLE EXPORTS
// ============================================================================

export const useDxfSettings = useEnterpriseDxfSettings;

/**
 * Backward compatible provider hooks
 */
export function useLineSettingsFromProvider(mode?: ViewerMode) {
  const { getEffectiveLineSettings, updateLineSettings, resetToDefaults, resetToFactory } = useEnterpriseDxfSettings();
  const effectiveSettings = getEffectiveLineSettings(mode);

  return {
    settings: effectiveSettings,
    updateSettings: updateLineSettings as (updates: Partial<LineSettings>) => void,
    resetToDefaults,
    resetToFactory, // ✅ ENTERPRISE FIX: Added missing resetToFactory για LineSettingsContext.tsx
    getCurrentDashPattern: () => {
      const { getDashArray } = require('../settings-core/defaults');
      return getDashArray(effectiveSettings.lineType, effectiveSettings.dashScale);
    },
    applyTemplate: () => {} // ✅ ENTERPRISE FIX: Added missing applyTemplate για LineSettingsContext.tsx
  };
}

export function useTextSettingsFromProvider(mode?: ViewerMode) {
  const { getEffectiveTextSettings, updateTextSettings, resetToDefaults } = useEnterpriseDxfSettings();
  return {
    settings: getEffectiveTextSettings(mode),
    updateSettings: updateTextSettings as (updates: Partial<TextSettings>) => void,
    resetToDefaults,
    resetToFactory: resetToDefaults
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
 * Style hooks (backward compatible)
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
