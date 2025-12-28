/**
 * @module ZustandToConsolidatedAdapter
 * @description Adapter layer που συνδέει το νέο Zustand store με το υπάρχον useConsolidatedSettings pattern
 * Αυτό επιτρέπει σταδιακή μετάβαση χωρίς να σπάσει το υπάρχον UI
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useDxfSettingsStore } from '../stores/DxfSettingsStore';
// ✅ UNIFIED TYPES: Μετά την ενοποίηση, όλα χρησιμοποιούν το ίδιο unified type
import type { LineSettings, EntityId, LineCapStyle, LineJoinStyle } from '../settings-core/types';
// ✅ ENTERPRISE: Import centralized colors
import { UI_COLORS } from '../config/color-config';
import type { TextSettings as LegacyTextSettings } from '../contexts/TextSettingsContext';
import type { GripSettings as LegacyGripSettings } from '../contexts/GripSettingsContext';

/**
 * ✅ SIMPLIFIED: Μετά την ενοποίηση, δεν χρειάζεται conversion - όλα είναι ίδιο type
 */
function zustandToLegacyLine(settings: LineSettings): LineSettings {
  return {
    enabled: true,
    lineType: settings.lineType,
    lineWidth: settings.lineWidth,
    color: settings.lineColor,
    opacity: settings.opacity,
    dashScale: settings.dashScale || 1.0,
    dashOffset: settings.dashOffset || 0,
    lineCap: settings.lineCap,
    lineJoin: settings.lineJoin,
    breakAtCenter: false,
    hoverColor: settings.hoverColor || UI_COLORS.BRIGHT_YELLOW, // ✅ CENTRALIZED: Yellow hover color
    hoverType: settings.hoverType || 'solid',
    hoverWidth: settings.hoverWidth || settings.lineWidth * 1.5,
    hoverOpacity: settings.hoverOpacity || 0.8,
    finalColor: settings.finalColor || UI_COLORS.BRIGHT_GREEN, // ✅ CENTRALIZED: Green final color
    finalType: settings.finalType || settings.lineType,
    finalWidth: settings.finalWidth || settings.lineWidth,
    finalOpacity: settings.finalOpacity || settings.opacity,
    activeTemplate: settings.activeTemplate || null
  };
}

/**
 * Μετατρέπει Legacy LineSettings σε Zustand format
 */
function legacyToZustandLine(settings: LineSettings): Partial<LineSettings> {
  return {
    lineType: settings.lineType,
    lineWidth: settings.lineWidth,
    lineColor: settings.color,
    opacity: settings.opacity,
    dashScale: settings.dashScale,
    dashOffset: settings.dashOffset,
    lineCap: settings.lineCap,
    lineJoin: settings.lineJoin,
    hoverColor: settings.hoverColor,
    hoverType: settings.hoverType,
    hoverWidth: settings.hoverWidth,
    hoverOpacity: settings.hoverOpacity,
    finalColor: settings.finalColor,
    finalType: settings.finalType,
    finalWidth: settings.finalWidth,
    finalOpacity: settings.finalOpacity,
    activeTemplate: settings.activeTemplate
  };
}

/**
 * Hook που προσαρμόζει το Zustand store για χρήση με useConsolidatedSettings pattern
 * Χρησιμοποιείται για Draft, Hover, Selection, Completion settings
 */
export function useZustandAsConsolidated(
  entityId: EntityId | null,
  settingsKey: string
) {
  const store = useDxfSettingsStore();

  // Get settings based on entity or general
  const currentSettings = useMemo(() => {
    if (entityId) {
      return store.getEffectiveLine(entityId);
    }
    return store.general.line;
  }, [entityId, store.general.line, store.overrides[entityId as string]]);

  // Check if entity has overrides
  const hasOverrides = entityId ? store.hasEntityOverrides(entityId) : false;

  // Update settings
  const updateSettings = useCallback((updates: { overrideGlobalSettings?: boolean }) => {
    if (!entityId) return;

    if (updates.overrideGlobalSettings === false) {
      // Clear overrides when disabling
      store.clearOverride(entityId);
    } else if (updates.overrideGlobalSettings === true) {
      // Initialize with current general settings when enabling
      store.setOverride(entityId, { line: store.general.line });
    }
  }, [entityId, store]);

  // Update specific line settings
  const updateSpecificSettings = useCallback((updates: Partial<LineSettings>) => {
    const zustandUpdates = legacyToZustandLine(updates);

    if (entityId && hasOverrides) {
      // Update entity override
      store.setOverride(entityId, { line: zustandUpdates });
    } else if (!entityId) {
      // Update general settings
      store.setGeneralLine(zustandUpdates);
    }
  }, [entityId, hasOverrides, store]);

  // Get effective settings (with conversion)
  const getEffectiveSettings = useCallback(() => {
    return zustandToLegacyLine(currentSettings);
  }, [currentSettings]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    if (entityId) {
      store.clearOverride(entityId);
    } else {
      store.resetGeneralToDefaults();
    }
  }, [entityId, store]);

  return {
    settings: {
      overrideGlobalSettings: hasOverrides,
      specificSettings: zustandToLegacyLine(currentSettings)
    },
    updateSettings,
    updateSpecificSettings,
    getEffectiveSettings,
    resetToDefaults
  };
}

/**
 * Hook για global line settings (χρησιμοποιείται από DxfSettingsProvider)
 */
export function useZustandAsGlobalLineSettings() {
  const store = useDxfSettingsStore();

  const settings = useMemo(() =>
    zustandToLegacyLine(store.general.line),
    [store.general.line]
  );

  const updateSettings = useCallback((updates: Partial<LineSettings>) => {
    const zustandUpdates = legacyToZustandLine(updates);
    store.setGeneralLine(zustandUpdates);
  }, [store]);

  return {
    settings,
    updateSettings
  };
}

/**
 * Hook για text settings με Zustand backend
 */
export function useZustandAsTextSettings() {
  const store = useDxfSettingsStore();

  const settings: LegacyTextSettings = useMemo(() => ({
    enabled: true,
    fontFamily: store.general.text.fontFamily,
    fontSize: store.general.text.fontSize,
    color: store.general.text.color,
    isBold: store.general.text.bold,
    isItalic: store.general.text.italic,
    isUnderline: store.general.text.underline,
    isStrikethrough: store.general.text.strikethrough,
    isSuperscript: false,
    isSubscript: false
  }), [store.general.text]);

  const updateSettings = useCallback((updates: Partial<LegacyTextSettings>) => {
    store.setGeneralText({
      fontFamily: updates.fontFamily,
      fontSize: updates.fontSize,
      color: updates.color,
      bold: updates.isBold,
      italic: updates.isItalic,
      underline: updates.isUnderline,
      strikethrough: updates.isStrikethrough
    });
  }, [store]);

  return {
    settings,
    updateSettings
  };
}

/**
 * Hook για grip settings με Zustand backend
 */
export function useZustandAsGripSettings() {
  const store = useDxfSettingsStore();

  const settings: LegacyGripSettings = useMemo(() => ({
    enabled: store.general.grip.enabled,
    gripSize: store.general.grip.gripSize,
    pickBoxSize: store.general.grip.pickBoxSize,
    apertureSize: store.general.grip.apertureSize,
    opacity: store.general.grip.opacity,
    colors: {
      cold: store.general.grip.coldColor,
      warm: store.general.grip.warmColor,
      hot: store.general.grip.hotColor,
      contour: store.general.grip.contourColor
    },
    showAperture: store.general.grip.showAperture,
    multiGripEdit: store.general.grip.multiGripEdit,
    snapToGrips: store.general.grip.snapToGrips,
    showMidpoints: store.general.grip.showMidpoints,
    showCenters: store.general.grip.showCenters,
    showQuadrants: store.general.grip.showQuadrants,
    maxGripsPerEntity: store.general.grip.maxGripsPerEntity
  }), [store.general.grip]);

  const updateSettings = useCallback((updates: Partial<LegacyGripSettings>) => {
    store.setGeneralGrip({
      enabled: updates.enabled,
      gripSize: updates.gripSize,
      pickBoxSize: updates.pickBoxSize,
      apertureSize: updates.apertureSize,
      opacity: updates.opacity,
      coldColor: updates.colors?.cold,
      warmColor: updates.colors?.warm,
      hotColor: updates.colors?.hot,
      contourColor: updates.colors?.contour,
      showAperture: updates.showAperture,
      multiGripEdit: updates.multiGripEdit,
      snapToGrips: updates.snapToGrips,
      showMidpoints: updates.showMidpoints,
      showCenters: updates.showCenters,
      showQuadrants: updates.showQuadrants,
      maxGripsPerEntity: updates.maxGripsPerEntity
    });
  }, [store]);

  return {
    settings,
    updateSettings
  };
}

/**
 * Helper για entity-specific settings με fallback σε general
 */
export function useEntitySettingsWithZustand(entityId: EntityId | null) {
  const store = useDxfSettingsStore();

  // Subscribe to selection changes
  useEffect(() => {
    if (entityId) {
      store.setSelection([entityId]);
    } else {
      store.clearSelection();
    }
  }, [entityId, store]);

  const applyToSelection = useCallback((updates: Partial<LineSettings>) => {
    const zustandUpdates = legacyToZustandLine(updates);
    store.applyToSelection({ line: zustandUpdates });
  }, [store]);

  const clearOverrides = useCallback(() => {
    if (entityId) {
      store.clearOverride(entityId);
    }
  }, [entityId, store]);

  return {
    hasOverrides: entityId ? store.hasEntityOverrides(entityId) : false,
    applyToSelection,
    clearOverrides,
    selection: store.selection
  };
}