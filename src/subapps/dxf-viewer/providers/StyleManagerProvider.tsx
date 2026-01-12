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
import { withOpacity } from '../config/color-config';

// ===== CONTEXT CREATION =====

const StyleManagerContext = createContext<StyleManagerContextType | null>(null);

// ===== STORE SYNC UTILITIES =====

/** Line settings for store synchronization */
interface LineSettings {
  enabled: boolean;
  color: string;
  lineWidth: number;
  opacity: number;
  lineType?: string;
}

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

/** Grip settings for store synchronization */
interface GripSettings {
  showGrips: boolean;
  gripSize: number;
  pickBoxSize: number;
  apertureSize: number;
  colors: Record<string, string>;
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
    lineType: settings.lineType,
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

    // Συγχρονίζουμε τα stores
    syncLineStore(lineSettings);
    syncTextStore(textSettings);
    syncGripStore(gripSettings);
  }, [getEffectiveLineSettings, getEffectiveTextSettings, getEffectiveGripSettings]);

  const updateStore = useCallback((entityType: EntityType) => {
    switch (entityType) {
      case 'line':
        syncLineStore(getEffectiveLineSettings());
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
  // 🚨 ΠΡΟΣΩΡΙΝΑ ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ: Διπλός συγχρονισμός με DxfSettingsProvider
  // Το DxfSettingsProvider ήδη συγχρονίζει τα stores σωστά με τις γενικές ρυθμίσεις

  // useEffect(() => {
  //   syncStores();
  //
  //   // DEBUG: Force log για να δούμε τι συμβαίνει
  //   if (DEBUG_STYLE_MANAGER_PROVIDER) {
  //     console.log('[StyleManager] Auto-sync triggered');
  //   }
  // }, [syncStores]); // Simplified dependencies - syncStores already has all needed deps

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