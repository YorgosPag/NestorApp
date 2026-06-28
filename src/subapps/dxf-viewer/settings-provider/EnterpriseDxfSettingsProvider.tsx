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

// Context objects + value types (SSoT — shared with the consumer hooks)
import {
  EnterpriseDxfSettingsContext,
  SettingsSaveStatusContext,
  type EnterpriseDxfSettingsContextType,
  type SettingsSaveStatusValue,
} from './enterprise-settings-context';

// Re-export types for backward compatibility
export type { ViewerMode, StorageMode, LineSettings, TextSettings, GripSettings };
export type { EnterpriseSettingsWithMetadata, SettingsSaveStatusValue } from './enterprise-settings-context';
export { ENTERPRISE_CONSTANTS } from './constants';

// Re-export consumer hooks for backward compatibility (split out 2026-06-28, N.7.1)
export {
  useEnterpriseDxfSettings,
  useEnterpriseDxfSettingsOptional,
  useSettingsSaveStatusOptional,
  useSettingsSaveStatus,
  useEnterpriseLineSettings,
  useEnterpriseTextSettings,
  useEnterpriseGripSettings,
  useDxfSettings,
  useLineSettingsFromProvider,
  useTextSettingsFromProvider,
  useGripSettingsFromProvider,
  useLineStyles,
  useTextStyles,
  useGripStyles,
} from './enterprise-settings-hooks';

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

    // Storage Quota (Enterprise) - Using stable reference
    storageQuota: stableQuotaInfo
  }), [
    // ADR-341 perf (2026-06-28) — save-status deps (state.isSaving, state.lastError,
    // saveStatus, lastSaved) REMOVED. They drive `SettingsSaveStatusContext` instead,
    // so an autosave cycle no longer rebuilds this value → the ~28 settings consumers
    // stop re-rendering on every save.
    state.settings,
    state.isLoaded,
    currentMode,
    setCurrentMode,
    actions,
    effectiveSettings,
    stableQuotaInfo // ✅ ENTERPRISE: Stable quota reference prevents infinite loops
  ]);

  // ADR-341 perf — volatile autosave status. Its own memo + provider so a save
  // cycle re-renders ONLY `CentralizedAutoSaveStatus`, not the settings tree.
  // `isAutoSaving`/`hasUnsavedChanges` preserve the exact prior semantics
  // (derived from `saveStatus`), so the widget is behaviour-identical.
  const saveStatusValue = useMemo<SettingsSaveStatusValue>(() => ({
    saveStatus,
    lastSaved,
    isSaving: state.isSaving,
    isAutoSaving: saveStatus === 'saving',
    hasUnsavedChanges: saveStatus !== 'saved',
    lastError: state.lastError,
  }), [saveStatus, lastSaved, state.isSaving, state.lastError]);

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
    <SettingsSaveStatusContext.Provider value={saveStatusValue}>
      <EnterpriseDxfSettingsContext.Provider value={contextValue}>
        {children}
      </EnterpriseDxfSettingsContext.Provider>
    </SettingsSaveStatusContext.Provider>
  );
}
