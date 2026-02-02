'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_STYLE_MANAGER_PROVIDER = false;

import React, { createContext, useContext, useEffect, useCallback } from 'react';
import type {
  StyleManagerContextType,
  EntityType,
  EffectiveSettings
} from '../types/viewerConfiguration';
// 🗑️ REMOVED (2025-10-06): ConfigurationProvider - Using DxfSettingsProvider instead
// import { useViewerConfig } from './ConfigurationProvider';
// 🔄 MIGRATED (2025-10-09): Phase 3.2 - Direct Enterprise (no adapter)
import { useDxfSettings } from '../settings-provider';
import { toolStyleStore } from '../stores/ToolStyleStore';
import { textStyleStore } from '../stores/TextStyleStore';
import { gripStyleStore } from '../stores/GripStyleStore';
// 🏢 ADR-056: Centralized completion style store
import { completionStyleStore } from '../stores/CompletionStyleStore';
import { withOpacity } from '../config/color-config';
// 🏢 ADR-056: Import proper LineSettings type from settings-core
import type { LineSettings as CoreLineSettings } from '../settings-core/types';
import type { GripSettings } from '../rendering/types/Types';

// ===== CONTEXT CREATION =====

const StyleManagerContext = createContext<StyleManagerContextType | null>(null);

// ===== STORE SYNC UTILITIES =====

// 🏢 ADR-056: Use CoreLineSettings alias for proper type (includes dashScale, lineCap, etc.)
type LineSettings = CoreLineSettings;

/** Text settings for store synchronization */
interface TextSettings {
  enabled: boolean;
  fontFamily: string;
  fontSize: number;
  color: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  isSuperscript?: boolean;
  isSubscript?: boolean;
  opacity: number;
}

// 🔄 MIGRATION NOTE: Type assertion needed because adapter returns Old types
// but these sync functions expect specific entity types
const syncLineStore = (settings: LineSettings) => {
  // Use centralized withOpacity function instead of manual rgba construction
  toolStyleStore.set({
    enabled: settings.enabled,
    strokeColor: settings.color,
    lineWidth: settings.lineWidth,
    opacity: settings.opacity,
    fillColor: withOpacity(settings.color, 0), // Fully transparent fill
    lineType: settings.lineType, // Now properly typed as LineType
  });
};

const syncTextStore = (settings: TextSettings) => {
  const getTextDecoration = (): string => {
    const decorations: string[] = [];
    if (settings.isUnderline) decorations.push('underline');
    if (settings.isStrikethrough) decorations.push('line-through');
    return decorations.join(' ') || 'none';
  };

  textStyleStore.set({
    enabled: settings.enabled,
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    color: settings.color,
    fontWeight: settings.isBold ? 'bold' : 'normal',
    fontStyle: settings.isItalic ? 'italic' : 'normal',
    textDecoration: getTextDecoration(),
    opacity: settings.opacity / 100,
    isSuperscript: settings.isSuperscript,
    isSubscript: settings.isSubscript,
  });
};

const syncGripStore = (settings: GripSettings) => {
  gripStyleStore.set({
    enabled: settings.showGrips,
    showGrips: settings.showGrips,
    gripSize: settings.gripSize,
    pickBoxSize: settings.pickBoxSize,
    apertureSize: settings.apertureSize,
    colors: settings.colors,
    opacity: 1.0
  });
};

// 🏢 ADR-056: Sync completion styles to CompletionStyleStore
// Mirrors syncLineStore pattern for preview styles
const syncCompletionStore = (settings: LineSettings) => {
  completionStyleStore.set({
    enabled: settings.enabled,
    color: settings.color,
    fillColor: withOpacity(settings.color, 0), // Fully transparent fill
    lineWidth: settings.lineWidth,
    opacity: settings.opacity,
    lineType: settings.lineType,
    dashScale: settings.dashScale ?? 1.0,
    lineCap: settings.lineCap ?? 'round',
    lineJoin: settings.lineJoin ?? 'round',
    dashOffset: settings.dashOffset ?? 0,
    breakAtCenter: settings.breakAtCenter ?? false,
  });
};

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
