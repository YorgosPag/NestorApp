/**
 * @file enterprise-settings-context - Settings context objects + types (SSoT)
 * @module settings-provider/enterprise-settings-context
 *
 * ✅ ENTERPRISE: Single Responsibility — owns the React context objects and their
 * value types. Both the provider (`EnterpriseDxfSettingsProvider`) and the consumer
 * hooks (`enterprise-settings-hooks`) import from here, so there is ONE definition
 * of each context (no duplicate `createContext` calls, no circular provider↔hooks).
 *
 * Split out of `EnterpriseDxfSettingsProvider.tsx` 2026-06-28 (N.7.1 file-size).
 */

import { createContext } from 'react';

import type { ViewerMode, StorageMode, SettingsState } from '../settings/core/types';
import type { LineSettings, TextSettings } from '../settings-core/types';
import type { GripSettings } from '../types/gripSettings'; // Full GripSettings (with all properties)

/**
 * ✅ ENTERPRISE: Extended settings state with metadata.
 *
 * ADR-341 perf (2026-06-28) — `saveStatus`/`lastSaved` no longer live here. They
 * flip on every autosave cycle (SAVE_START → SAVE_SUCCESS) and used to be spread
 * into this object + baked into the main context value's memo deps, so every
 * autosave rebuilt the whole context → re-rendered ALL ~28 consumer subtrees
 * (~1980 fibers / ~270ms per commit in the 2026-06-28 profile). They now live in
 * the dedicated `SettingsSaveStatusContext` (consumed only by the autosave-status
 * widget), so the main settings value changes ONLY on a real settings edit.
 */
export interface EnterpriseSettingsWithMetadata extends SettingsState {
  mode: ViewerMode;
}

/**
 * ADR-341 perf — volatile autosave status, split out of the main settings
 * context (see above). Re-renders only its single consumer
 * (`CentralizedAutoSaveStatus`) on each save cycle.
 */
export interface SettingsSaveStatusValue {
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
  isSaving: boolean;
  isAutoSaving: boolean;
  hasUnsavedChanges: boolean;
  lastError: string | null;
}

/**
 * Enterprise context type (backward compatible with old DxfSettingsProvider)
 */
export interface EnterpriseDxfSettingsContextType {
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
  // ADR-341 perf (2026-06-28) — `isSaving`/`isAutoSaving`/`hasUnsavedChanges`/
  // `lastError` moved to `SettingsSaveStatusContext` (see `SettingsSaveStatusValue`)
  // so autosave flips don't invalidate this whole context.

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
// CONTEXT OBJECTS
// ============================================================================

export const EnterpriseDxfSettingsContext = createContext<EnterpriseDxfSettingsContextType | null>(null);

// ADR-341 perf — dedicated volatile autosave-status context. Separate provider
// so a save cycle re-renders ONLY its consumer, never the main settings tree.
export const SettingsSaveStatusContext = createContext<SettingsSaveStatusValue | null>(null);
