'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_STYLE_MANAGER_PROVIDER = false;

import React, { createContext, useContext, useEffect, useCallback } from 'react';
import type {
  StyleManagerContextType,
  EntityType
} from '../types/viewerConfiguration';
// 🗑️ REMOVED (2025-10-06): ConfigurationProvider - Using DxfSettingsProvider instead
// import { useViewerConfig } from './ConfigurationProvider';
// 🔄 MIGRATED (2025-10-09): Phase 3.2 - Direct Enterprise (no adapter)
import { useDxfSettings } from '../settings-provider';
// 🏢 SSoT single writers: effective settings → legacy style stores.
// All four mappers live in ONE place (style-store-sync.ts); these inline
// syncers are thin, idempotent delegations. Was: duplicated inline mappings
// here + lossy mappers in settings/sync/storeSync.ts (last-writer-wins hazard).
import {
  syncToolStyleStoreFromSettings,
  syncTextStyleStoreFromSettings,
  syncCompletionStyleStoreFromSettings,
  syncGripStyleStoreFromSettings,
  type TextStyleSyncInput,
} from '../stores/style-store-sync';
// 🏢 ADR-056: Import proper LineSettings type from settings-core
import type { LineSettings as CoreLineSettings } from '../settings-core/types';
// Full GripSettings (matches what getEffectiveGripSettings() actually returns)
import type { GripSettings } from '../types/gripSettings';

// ===== CONTEXT CREATION =====

const StyleManagerContext = createContext<StyleManagerContextType | null>(null);

// ===== STORE SYNC UTILITIES =====

// 🏢 ADR-056: Use CoreLineSettings alias for proper type (includes dashScale, lineCap, etc.)
type LineSettings = CoreLineSettings;
/** Text settings for store synchronization (SSoT shape in style-store-sync.ts) */
type TextSettings = TextStyleSyncInput;

// 🏢 SSoT: each syncer is a thin delegation to the single mapper in
// style-store-sync.ts. Keeping these named wrappers preserves the call sites
// (syncStores / updateStore) and their per-entity effective-settings modes.
const syncLineStore = (settings: LineSettings) => syncToolStyleStoreFromSettings(settings);
const syncTextStore = (settings: TextSettings) => syncTextStyleStoreFromSettings(settings);
const syncGripStore = (settings: GripSettings) => syncGripStyleStoreFromSettings(settings);
const syncCompletionStore = (settings: LineSettings) => syncCompletionStyleStoreFromSettings(settings);

// ===== PROVIDER COMPONENT =====

export function StyleManagerProvider({ children }: { children: React.ReactNode }) {
  // 🔄 MIGRATION (2025-10-06): Χρησιμοποιούμε το unified DxfSettingsProvider
  const dxfSettings = useDxfSettings();

  if (!dxfSettings) {
    // Fallback if context not available
    return <StyleManagerContext.Provider value={{ syncStores: () => {}, updateStore: () => {} }}>
      {children}
    </StyleManagerContext.Provider>;
  }

  const { getEffectiveLineSettings, getEffectiveTextSettings, getEffectiveGripSettings } = dxfSettings;

  // ===== STORE SYNCHRONIZATION =====

  const syncStores = useCallback(() => {
    // Παίρνουμε τα effective settings για κάθε entity type
    const lineSettings = getEffectiveLineSettings();
    const textSettings = getEffectiveTextSettings();
    const gripSettings = getEffectiveGripSettings();

    // 🏢 ADR-056: Get completion-specific settings
    const completionSettings = getEffectiveLineSettings('completion');

    // Συγχρονίζουμε τα stores
    syncLineStore(lineSettings);
    syncTextStore(textSettings);
    syncGripStore(gripSettings);
    // 🏢 ADR-056: Sync completion styles to dedicated store
    syncCompletionStore(completionSettings);
  }, [getEffectiveLineSettings, getEffectiveTextSettings, getEffectiveGripSettings]);

  const updateStore = useCallback((entityType: EntityType) => {
    switch (entityType) {
      case 'line':
        syncLineStore(getEffectiveLineSettings());
        // 🏢 ADR-056: Also update completion store when line settings change
        syncCompletionStore(getEffectiveLineSettings('completion'));
        break;
      case 'text':
        syncTextStore(getEffectiveTextSettings());
        break;
      case 'grip':
        syncGripStore(getEffectiveGripSettings());
        break;
    }
  }, [getEffectiveLineSettings, getEffectiveTextSettings, getEffectiveGripSettings]);

  // ===== AUTO-SYNC EFFECT =====
  // 🏢 ADR-056: Re-enabled for CompletionStyleStore synchronization
  // Note: DxfSettingsProvider syncs preview styles via storeSync.ts, but NOT completion styles
  // This effect syncs ONLY completionStyleStore (toolStyleStore sync handled by storeSync)
  useEffect(() => {
    // 🏢 ADR-056: Only sync completion store (preview already synced by storeSync)
    const completionSettings = getEffectiveLineSettings('completion');
    syncCompletionStore(completionSettings);

    if (DEBUG_STYLE_MANAGER_PROVIDER) {
      console.log('[StyleManager] Completion store synced:', completionSettings.color);
    }
  }, [getEffectiveLineSettings]);

  // ===== CONTEXT VALUE =====

  const contextValue: StyleManagerContextType = {
    syncStores,
    updateStore
  };

  return (
    <StyleManagerContext.Provider value={contextValue}>
      {children}
    </StyleManagerContext.Provider>
  );
}

// ===== HOOK =====

export function useStyleManager(): StyleManagerContextType {
  const context = useContext(StyleManagerContext);
  if (!context) {
    throw new Error('useStyleManager must be used within a StyleManagerProvider');
  }
  return context;
}
