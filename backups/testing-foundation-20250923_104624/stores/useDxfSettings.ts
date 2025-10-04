/**
 * CUSTOM HOOKS για DXF Settings Store
 * Παρέχουν εύκολη πρόσβαση και debouncing
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDxfSettingsStore } from './DxfSettingsStore';
import type {
  LineSettings,
  TextSettings,
  GripSettings,
  EntityId,
  PartialDxfSettings
} from '../settings-core/types';

// ============================================================================
// DEBOUNCE UTILITY
// ============================================================================

function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  return debouncedCallback;
}

// ============================================================================
// GENERAL SETTINGS HOOKS
// ============================================================================

/**
 * Hook για Line Settings (General)
 */
export function useGeneralLineSettings() {
  const settings = useDxfSettingsStore((state) => state.general.line);
  const setSettings = useDxfSettingsStore((state) => state.setGeneralLine);
  const saveToLocalStorage = useDxfSettingsStore((state) => state.saveToLocalStorage);

  // Debounced update για sliders
  const debouncedSetSettings = useDebounce((patch: Partial<LineSettings>) => {
    setSettings(patch);
    saveToLocalStorage();
  }, 150);

  // Instant update για toggles και dropdowns
  const instantSetSettings = useCallback((patch: Partial<LineSettings>) => {
    setSettings(patch);
    saveToLocalStorage();
  }, [setSettings, saveToLocalStorage]);

  return {
    settings,
    setSettings: debouncedSetSettings,
    setSettingsInstant: instantSetSettings,
  };
}

/**
 * Hook για Text Settings (General)
 */
export function useGeneralTextSettings() {
  const settings = useDxfSettingsStore((state) => state.general.text);
  const setSettings = useDxfSettingsStore((state) => state.setGeneralText);
  const saveToLocalStorage = useDxfSettingsStore((state) => state.saveToLocalStorage);

  const debouncedSetSettings = useDebounce((patch: Partial<TextSettings>) => {
    setSettings(patch);
    saveToLocalStorage();
  }, 150);

  const instantSetSettings = useCallback((patch: Partial<TextSettings>) => {
    setSettings(patch);
    saveToLocalStorage();
  }, [setSettings, saveToLocalStorage]);

  return {
    settings,
    setSettings: debouncedSetSettings,
    setSettingsInstant: instantSetSettings,
  };
}

/**
 * Hook για Grip Settings (General)
 */
export function useGeneralGripSettings() {
  const settings = useDxfSettingsStore((state) => state.general.grip);
  const setSettings = useDxfSettingsStore((state) => state.setGeneralGrip);
  const saveToLocalStorage = useDxfSettingsStore((state) => state.saveToLocalStorage);

  const debouncedSetSettings = useDebounce((patch: Partial<GripSettings>) => {
    setSettings(patch);
    saveToLocalStorage();
  }, 150);

  const instantSetSettings = useCallback((patch: Partial<GripSettings>) => {
    setSettings(patch);
    saveToLocalStorage();
  }, [setSettings, saveToLocalStorage]);

  return {
    settings,
    setSettings: debouncedSetSettings,
    setSettingsInstant: instantSetSettings,
  };
}

// ============================================================================
// ENTITY OVERRIDE HOOKS
// ============================================================================

/**
 * Hook για entity-specific settings με override support
 */
export function useEntitySettings(entityId: EntityId | null) {
  const general = useDxfSettingsStore((state) => state.general);
  const overrides = useDxfSettingsStore((state) =>
    entityId ? state.overrides[entityId] : undefined
  );
  const setOverride = useDxfSettingsStore((state) => state.setOverride);
  const clearOverride = useDxfSettingsStore((state) => state.clearOverride);
  const hasOverrides = useDxfSettingsStore((state) =>
    entityId ? state.hasEntityOverrides(entityId) : false
  );
  const saveToLocalStorage = useDxfSettingsStore((state) => state.saveToLocalStorage);

  // Calculate effective settings
  const effectiveSettings = useMemo(() => {
    if (!entityId) return general;
    return useDxfSettingsStore.getState().getEffective(entityId);
  }, [entityId, general, overrides]);

  // Debounced override setter
  const debouncedSetOverride = useDebounce((patch: PartialDxfSettings) => {
    if (entityId) {
      setOverride(entityId, patch);
      saveToLocalStorage();
    }
  }, 150);

  // Clear overrides
  const handleClearOverrides = useCallback(() => {
    if (entityId) {
      clearOverride(entityId);
      saveToLocalStorage();
    }
  }, [entityId, clearOverride, saveToLocalStorage]);

  return {
    general,
    overrides,
    effective: effectiveSettings,
    hasOverrides,
    setOverride: debouncedSetOverride,
    clearOverrides: handleClearOverrides,
  };
}

// ============================================================================
// SELECTION HOOKS
// ============================================================================

/**
 * Hook για selection-based operations
 */
export function useSelectionSettings() {
  const selection = useDxfSettingsStore((state) => state.selection);
  const applyToSelection = useDxfSettingsStore((state) => state.applyToSelection);
  const clearSelection = useDxfSettingsStore((state) => state.clearSelection);
  const saveToLocalStorage = useDxfSettingsStore((state) => state.saveToLocalStorage);

  const debouncedApplyToSelection = useDebounce((patch: PartialDxfSettings) => {
    applyToSelection(patch);
    saveToLocalStorage();
  }, 150);

  const handleClearSelection = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  return {
    selection,
    selectionCount: selection.length,
    hasSelection: selection.length > 0,
    applyToSelection: debouncedApplyToSelection,
    clearSelection: handleClearSelection,
  };
}

// ============================================================================
// PERSISTENCE HOOK
// ============================================================================

/**
 * Hook για αρχικοποίηση και persistence
 */
export function useDxfSettingsInit() {
  const loadFromLocalStorage = useDxfSettingsStore((state) => state.loadFromLocalStorage);
  const isLoaded = useDxfSettingsStore((state) => state.isLoaded);
  const saveStatus = useDxfSettingsStore((state) => state.saveStatus);
  const lastSaved = useDxfSettingsStore((state) => state.lastSaved);

  // Load settings on mount
  useEffect(() => {
    if (!isLoaded) {
      loadFromLocalStorage();
    }
  }, [isLoaded, loadFromLocalStorage]);

  return {
    isLoaded,
    saveStatus,
    lastSaved,
  };
}

// ============================================================================
// COMBINED HOOK για components
// ============================================================================

/**
 * All-in-one hook για DXF Settings Panel
 */
export function useDxfSettingsPanel(
  activeContext: 'general' | 'entity',
  entityId?: EntityId
) {
  const init = useDxfSettingsInit();

  // General settings
  const lineGeneral = useGeneralLineSettings();
  const textGeneral = useGeneralTextSettings();
  const gripGeneral = useGeneralGripSettings();

  // Entity settings (αν είμαστε σε entity context)
  const entitySettings = useEntitySettings(activeContext === 'entity' ? entityId || null : null);

  // Selection settings
  const selectionSettings = useSelectionSettings();

  // Reset to defaults
  const resetGeneralToDefaults = useDxfSettingsStore((state) => state.resetGeneralToDefaults);
  const clearAllOverrides = useDxfSettingsStore((state) => state.clearAllOverrides);

  return {
    // Initialization
    ...init,

    // Context
    activeContext,
    entityId,

    // General settings
    general: {
      line: lineGeneral,
      text: textGeneral,
      grip: gripGeneral,
    },

    // Entity-specific
    entity: activeContext === 'entity' ? entitySettings : null,

    // Selection
    selection: selectionSettings,

    // Actions
    resetGeneralToDefaults,
    clearAllOverrides,
  };
}