/**
 * OVERRIDE SYSTEM MANAGEMENT HOOK
 * Καθαρή διαχείριση του override system για όλα τα entities
 *
 * 🔄 MIGRATED (2025-10-09): Phase 3.2 - Direct Enterprise (no adapter)
 * OLD: useViewerConfig (ConfigurationProvider - DELETED)
 * NEW: useDxfSettings (Enterprise provider)
 */

import { useCallback, useMemo } from 'react';
// 🔄 MIGRATION: Phase 3.2 - Direct Enterprise (no adapter)
import { useDxfSettings } from '../settings-provider';
import type { EntityType, OverrideSystemHookResult } from '../types/viewerConfiguration';

// ===== MAIN HOOK =====

export function useOverrideSystem(): OverrideSystemHookResult {
  // 🔄 MIGRATED: Direct Enterprise (no adapter)
  const dxfSettings = useDxfSettings();

  // Safety check - should always exist but protect against edge cases
  if (!dxfSettings) {
    throw new Error('useOverrideSystem must be used within DxfSettingsProvider');
  }

  const {
    settings,
    toggleLineOverride,
    toggleTextOverride,
    toggleGripOverride
  } = dxfSettings;

  // ===== CURRENT STATE =====

  const overrideStates = useMemo(() => ({
    // 🔄 MIGRATED: Access override flags from settings state
    line: settings.overrideEnabled.line.draft, // Use draft mode as default
    text: settings.overrideEnabled.text.draft,
    grip: settings.overrideEnabled.grip.draft
  }), [settings.overrideEnabled]);

  // ===== UTILITY METHODS =====

  const isEnabled = useCallback((entityType: EntityType): boolean => {
    return overrideStates[entityType];
  }, [overrideStates]);

  const toggle = useCallback((entityType: EntityType) => {
    // 🔄 MIGRATED: Use specific toggle methods from adapter
    const currentState = overrideStates[entityType];

    switch (entityType) {
      case 'line':
        toggleLineOverride('draft', !currentState);
        break;
      case 'text':
        toggleTextOverride('draft', !currentState);
        break;
      case 'grip':
        toggleGripOverride('draft', !currentState);
        break;
    }
  }, [overrideStates, toggleLineOverride, toggleTextOverride, toggleGripOverride]);

  const enable = useCallback((entityType: EntityType) => {
    // 🔄 MIGRATED: Use specific toggle methods from adapter
    switch (entityType) {
      case 'line':
        toggleLineOverride('draft', true);
        break;
      case 'text':
        toggleTextOverride('draft', true);
        break;
      case 'grip':
        toggleGripOverride('draft', true);
        break;
    }
  }, [toggleLineOverride, toggleTextOverride, toggleGripOverride]);

  const disable = useCallback((entityType: EntityType) => {
    // 🔄 MIGRATED: Use specific toggle methods from adapter
    switch (entityType) {
      case 'line':
        toggleLineOverride('draft', false);
        break;
      case 'text':
        toggleTextOverride('draft', false);
        break;
      case 'grip':
        toggleGripOverride('draft', false);
        break;
    }
  }, [toggleLineOverride, toggleTextOverride, toggleGripOverride]);

  // ===== RETURN VALUE =====

  return {
    isEnabled,
    toggle,
    enable,
    disable
  };
}

// ===== ENTITY-SPECIFIC HOOKS =====

export function useLineOverride() {
  const { isEnabled, toggle, enable, disable } = useOverrideSystem();

  return {
    isEnabled: isEnabled('line'),
    toggle: () => toggle('line'),
    enable: () => enable('line'),
    disable: () => disable('line')
  };
}

export function useTextOverride() {
  const { isEnabled, toggle, enable, disable } = useOverrideSystem();

  return {
    isEnabled: isEnabled('text'),
    toggle: () => toggle('text'),
    enable: () => enable('text'),
    disable: () => disable('text')
  };
}

export function useGripOverride() {
  const { isEnabled, toggle, enable, disable } = useOverrideSystem();

  return {
    isEnabled: isEnabled('grip'),
    toggle: () => toggle('grip'),
    enable: () => enable('grip'),
    disable: () => disable('grip')
  };
}

// ===== BULK OPERATIONS =====

export function useOverrideBulkOperations() {
  const { enable, disable } = useOverrideSystem();

  const enableAll = useCallback(() => {
    enable('line');
    enable('text');
    enable('grip');
  }, [enable]);

  const disableAll = useCallback(() => {
    disable('line');
    disable('text');
    disable('grip');
  }, [disable]);

  return {
    enableAll,
    disableAll
  };
}