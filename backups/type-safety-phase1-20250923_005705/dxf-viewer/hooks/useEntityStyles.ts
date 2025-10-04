/**
 * UNIFIED ENTITY STYLES HOOK
 * Αντικαθιστά όλα τα διαφορετικά style hooks με ένα unified approach
 */

import { useCallback, useMemo } from 'react';
import { useViewerConfig } from '../providers/ConfigurationProvider';
import { useStyleManager } from '../providers/StyleManagerProvider';
import type {
  EntityType,
  ViewerMode,
  EntityStylesHookResult
} from '../types/viewerConfiguration';
import type { LineSettings } from '../types/lineSettings';
import type { TextSettings } from '../types/textSettings';
import type { GripSettings } from '../types/gripSettings';

// ===== TYPE MAPPING =====

type EntitySettingsMap = {
  line: LineSettings;
  text: TextSettings;
  grip: GripSettings;
};

// ===== MAIN HOOK =====

export function useEntityStyles<T extends EntityType>(
  entityType: T,
  mode?: ViewerMode,
  userOverrides?: Partial<EntitySettingsMap[T]>
): EntityStylesHookResult<EntitySettingsMap[T]> {

  const { config, updateEntityConfig, updateOverrides } = useViewerConfig();
  const { updateStore } = useStyleManager();

  // ===== CURRENT STATE =====

  const entityConfig = config.entities[entityType];
  const currentMode = mode || config.mode;
  const isOverridden = entityConfig.overrideEnabled;

  // ===== EFFECTIVE SETTINGS CALCULATION =====

  const settings = useMemo((): EntitySettingsMap[T] => {
    let baseSettings = entityConfig.general;

    // Εφαρμογή specific settings για το τρέχον mode
    if (currentMode !== 'normal' && entityConfig.specific[currentMode]) {
      baseSettings = {
        ...baseSettings,
        ...entityConfig.specific[currentMode]
      };
    }

    // Εφαρμογή user overrides αν είναι enabled το override
    if (isOverridden && config.overrides[entityType][currentMode]) {
      baseSettings = {
        ...baseSettings,
        ...config.overrides[entityType][currentMode]
      };
    }

    // Εφαρμογή runtime user overrides (αν υπάρχουν)
    if (userOverrides) {
      baseSettings = {
        ...baseSettings,
        ...userOverrides
      };
    }

    return baseSettings as EntitySettingsMap[T];
  }, [
    entityConfig,
    currentMode,
    isOverridden,
    config.overrides,
    entityType,
    userOverrides
  ]);

  // ===== UPDATE METHODS =====

  const update = useCallback((updates: Partial<EntitySettingsMap[T]>) => {
    if (isOverridden) {
      // Ενημέρωση user overrides
      updateOverrides({
        [entityType]: {
          [currentMode]: updates
        }
      } as any);
    } else {
      // Ενημέρωση general ή specific settings
      if (currentMode === 'normal') {
        updateEntityConfig(entityType, {
          general: { ...entityConfig.general, ...updates }
        });
      } else {
        updateEntityConfig(entityType, {
          specific: {
            ...entityConfig.specific,
            [currentMode]: {
              ...entityConfig.specific[currentMode],
              ...updates
            }
          }
        });
      }
    }

    // Άμεση ενημέρωση του αντίστοιχου store
    const updatedSettings = { ...settings, ...updates };
    updateStore(entityType, updatedSettings);
  }, [
    isOverridden,
    entityType,
    currentMode,
    updateOverrides,
    updateEntityConfig,
    entityConfig,
    settings,
    updateStore
  ]);

  const reset = useCallback(() => {
    if (isOverridden) {
      // Reset user overrides
      updateOverrides({
        [entityType]: {
          [currentMode]: {}
        }
      } as any);
    } else {
      // Reset to default settings
      if (currentMode === 'normal') {
        updateEntityConfig(entityType, {
          general: entityConfig.general // Reset to original
        });
      } else {
        updateEntityConfig(entityType, {
          specific: {
            ...entityConfig.specific,
            [currentMode]: {}
          }
        });
      }
    }
  }, [
    isOverridden,
    entityType,
    currentMode,
    updateOverrides,
    updateEntityConfig,
    entityConfig
  ]);

  // ===== RETURN VALUE =====

  return {
    settings,
    isOverridden,
    update,
    reset
  };
}

// ===== CONVENIENCE HOOKS =====

export function useLineStyles(mode?: ViewerMode, overrides?: Partial<LineSettings>) {
  return useEntityStyles('line', mode, overrides);
}

export function useTextStyles(mode?: ViewerMode, overrides?: Partial<TextSettings>) {
  return useEntityStyles('text', mode, overrides);
}

export function useGripStyles(mode?: ViewerMode, overrides?: Partial<GripSettings>) {
  return useEntityStyles('grip', mode, overrides);
}