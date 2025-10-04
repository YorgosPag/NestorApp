/**
 * OVERRIDE SYSTEM MANAGEMENT HOOK
 * Καθαρή διαχείριση του override system για όλα τα entities
 */

import { useCallback, useMemo } from 'react';
import { useViewerConfig } from '../providers/ConfigurationProvider';
import type { EntityType, OverrideSystemHookResult } from '../types/viewerConfiguration';

// ===== MAIN HOOK =====

export function useOverrideSystem(): OverrideSystemHookResult {
  const { config, updateEntityConfig } = useViewerConfig();

  // ===== CURRENT STATE =====

  const overrideStates = useMemo(() => ({
    line: config.entities.line.overrideEnabled,
    text: config.entities.text.overrideEnabled,
    grip: config.entities.grip.overrideEnabled
  }), [config.entities]);

  // ===== UTILITY METHODS =====

  const isEnabled = useCallback((entityType: EntityType): boolean => {
    return overrideStates[entityType];
  }, [overrideStates]);

  const toggle = useCallback((entityType: EntityType) => {
    const currentState = overrideStates[entityType];
    updateEntityConfig(entityType, {
      overrideEnabled: !currentState
    });
  }, [overrideStates, updateEntityConfig]);

  const enable = useCallback((entityType: EntityType) => {
    updateEntityConfig(entityType, {
      overrideEnabled: true
    });
  }, [updateEntityConfig]);

  const disable = useCallback((entityType: EntityType) => {
    updateEntityConfig(entityType, {
      overrideEnabled: false
    });
  }, [updateEntityConfig]);

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