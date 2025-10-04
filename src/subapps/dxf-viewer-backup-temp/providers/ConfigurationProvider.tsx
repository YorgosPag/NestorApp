'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type {
  ViewerConfiguration,
  ConfigurationContextType,
  ConfigurationProviderProps,
  ViewerMode,
  EntityType,
  UserOverrides,
  EntityConfig,
  EffectiveSettings
} from '../types/viewerConfiguration';
import { DEFAULT_LINE_SETTINGS } from '../types/lineSettings';
import { DEFAULT_TEXT_SETTINGS } from '../types/textSettings';
import { DEFAULT_GRIP_SETTINGS } from '../types/gripSettings';

// ===== CONTEXT CREATION =====
/**
 * Unified Configuration Context
 *
 * Αντικαθιστά τα 12+ nested contexts με ένα κεντρικό configuration system.
 * Παρέχει centralized state management για όλα τα entity types (line, text, grip).
 *
 * Features:
 * - Unified configuration για όλα τα entities
 * - Mode-based settings (normal, preview, completion)
 * - User overrides system
 * - Effective settings calculation
 * - Automatic store synchronization (via StyleManagerProvider)
 *
 * @see StyleManagerProvider για store synchronization
 * @see hooks/useEntityStyles.ts για simplified access
 */
const ConfigurationContext = createContext<ConfigurationContextType | null>(null);

// ===== DEFAULT CONFIGURATION =====

const createDefaultConfiguration = (): ViewerConfiguration => ({
  entities: {
    line: {
      general: DEFAULT_LINE_SETTINGS,
      specific: {
        preview: {
          lineType: 'dashed',
          color: '#ffffff',
          opacity: 1.0
        },
        completion: {
          lineType: 'solid',
          color: '#00FF00',
          opacity: 0.8
        }
      },
      overrideEnabled: false
    },
    text: {
      general: DEFAULT_TEXT_SETTINGS,
      specific: {
        preview: {
          color: '#ffffff',
          opacity: 100
        }
      },
      overrideEnabled: false
    },
    grip: {
      general: DEFAULT_GRIP_SETTINGS,
      specific: {
        preview: {
          colors: {
            cold: '#0000FF',        // ✅ AutoCAD standard: Blue (ACI 5) - unselected grips
            warm: '#FF69B4',        // ✅ AutoCAD standard: Hot Pink - hover grips
            hot: '#FF0000',         // ✅ AutoCAD standard: Red (ACI 1) - selected grips
            contour: '#000000'      // ✅ AutoCAD standard: Black contour
          },
          gripSize: 8,
          showGrips: true
        }
      },
      overrideEnabled: false
    }
  },
  mode: 'normal',
  overrides: {
    line: {
      preview: {},
      completion: {}
    },
    text: {
      preview: {}
    },
    grip: {
      preview: {}
    }
  }
});

// ===== PROVIDER COMPONENT =====

export function ConfigurationProvider({
  children,
  initialConfig
}: ConfigurationProviderProps) {

  // ===== STATE =====
  const [config, setConfig] = useState<ViewerConfiguration>(() => ({
    ...createDefaultConfiguration(),
    ...initialConfig
  }));

  // ===== UPDATE METHODS =====

  const updateConfig = useCallback((updates: Partial<ViewerConfiguration>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const updateEntityConfig = useCallback(<T extends EntityType>(
    entityType: T,
    updates: Partial<EntityConfig<unknown>>
  ) => {
    setConfig(prev => ({
      ...prev,
      entities: {
        ...prev.entities,
        [entityType]: {
          ...prev.entities[entityType],
          ...updates
        }
      }
    }));
  }, []);

  const updateOverrides = useCallback((updates: Partial<UserOverrides>) => {
    setConfig(prev => ({
      ...prev,
      overrides: {
        line: { ...prev.overrides.line, ...updates.line },
        text: { ...prev.overrides.text, ...updates.text },
        grip: { ...prev.overrides.grip, ...updates.grip }
      }
    }));
  }, []);

  const setMode = useCallback((mode: ViewerMode) => {
    setConfig(prev => ({ ...prev, mode }));
  }, []);

  // ===== EFFECTIVE SETTINGS CALCULATION =====

  const getEffectiveSettings = useCallback((): EffectiveSettings => {
    const { entities, mode, overrides } = config;

    const getEntityEffectiveSettings = <T,>(
      entityConfig: EntityConfig<T>,
      entityOverrides: Partial<T>
    ): T => {
      let baseSettings = entityConfig.general;

      // Αν δεν είναι normal mode, εφάρμοσε specific settings
      if (mode !== 'normal' && entityConfig.specific[mode]) {
        baseSettings = {
          ...baseSettings,
          ...entityConfig.specific[mode]
        };
      }

      // Αν είναι enabled το override, εφάρμοσε user overrides
      if (entityConfig.overrideEnabled && entityOverrides[mode]) {
        baseSettings = {
          ...baseSettings,
          ...entityOverrides[mode]
        };
      }

      return baseSettings;
    };

    return {
      line: getEntityEffectiveSettings(entities.line, overrides.line),
      text: getEntityEffectiveSettings(entities.text, overrides.text),
      grip: getEntityEffectiveSettings(entities.grip, overrides.grip)
    };
  }, [config]);

  // ===== CONTEXT VALUE =====

  const contextValue: ConfigurationContextType = useMemo(() => ({
    config,
    updateConfig,
    updateEntityConfig,
    updateOverrides,
    setMode,
    getEffectiveSettings
  }), [
    config,
    updateConfig,
    updateEntityConfig,
    updateOverrides,
    setMode,
    getEffectiveSettings
  ]);

  return (
    <ConfigurationContext.Provider value={contextValue}>
      {children}
    </ConfigurationContext.Provider>
  );
}

// ===== HOOK =====

export function useViewerConfig(): ConfigurationContextType {
  const context = useContext(ConfigurationContext);
  if (!context) {
    throw new Error('useViewerConfig must be used within a ConfigurationProvider');
  }
  return context;
}