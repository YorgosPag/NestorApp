import { useCallback } from 'react';
import type { 
  ConstraintOperation,
  ConstraintOperationResult,
  ConstraintDefinition,
  OrthoConstraintSettings,
  PolarConstraintSettings,
  ConstraintsSettings,
  ConstraintPreset
} from './config';
import {
  DEFAULT_ORTHO_SETTINGS,
  DEFAULT_POLAR_SETTINGS,
  DEFAULT_CONSTRAINTS_SETTINGS,
  CONSTRAINT_PRESETS
} from './config';
import { mergeConstraintSettings } from './utils';

export interface ConstraintOperationsHook {
  performOperation: (operation: ConstraintOperation) => Promise<ConstraintOperationResult>;
  loadPreset: (presetId: string) => ConstraintOperationResult;
  exportSettings: () => { orthoSettings: OrthoConstraintSettings; polarSettings: PolarConstraintSettings; settings: ConstraintsSettings; constraints: Record<string, ConstraintDefinition>; version: string; timestamp: number };
  importSettings: (data: unknown) => ConstraintOperationResult;
}

export function useConstraintOperations(
  orthoSettings: OrthoConstraintSettings,
  polarSettings: PolarConstraintSettings,
  settings: ConstraintsSettings,
  constraints: Record<string, ConstraintDefinition>,
  setOrthoSettings: React.Dispatch<React.SetStateAction<OrthoConstraintSettings>>,
  setPolarSettings: React.Dispatch<React.SetStateAction<PolarConstraintSettings>>,
  setSettings: React.Dispatch<React.SetStateAction<ConstraintsSettings>>,
  setConstraints: React.Dispatch<React.SetStateAction<Record<string, ConstraintDefinition>>>,
  toggleOrtho: () => void,
  togglePolar: () => void
): ConstraintOperationsHook {
  const getPresetById = useCallback((presetId: string): ConstraintPreset | undefined => {
    return CONSTRAINT_PRESETS.find(preset => preset.id === presetId);
  }, []);

  const toConstraintsRecord = useCallback((list: ConstraintDefinition[]): Record<string, ConstraintDefinition> => {
    return list.reduce<Record<string, ConstraintDefinition>>((acc, constraint) => {
      acc[constraint.id] = constraint;
      return acc;
    }, {});
  }, []);

  const applyPreset = useCallback((preset: ConstraintPreset): void => {
    setSettings(prev => mergeConstraintSettings(prev, preset.settings));
    setConstraints(toConstraintsRecord(preset.constraints));
  }, [setSettings, setConstraints, toConstraintsRecord]);

  const performOperation = useCallback(async (operation: ConstraintOperation): Promise<ConstraintOperationResult> => {
    try {
      switch (operation.type) {
        case 'toggle-ortho':
          toggleOrtho();
          break;
        case 'toggle-polar':
          togglePolar();
          break;
        case 'reset-settings':
          setOrthoSettings(DEFAULT_ORTHO_SETTINGS);
          setPolarSettings(DEFAULT_POLAR_SETTINGS);
          break;
        case 'load-preset':
          if (operation.presetId) {
            const preset = getPresetById(operation.presetId);
            if (!preset) {
              throw new Error(`Preset not found: ${operation.presetId}`);
            }
            applyPreset(preset);
          }
          break;
        default:
          throw new Error(`Unknown operation: ${operation.type}`);
      }
      
      return { success: true, operation };
    } catch (error) {
      return {
        success: false,
        operation,
        error: error instanceof Error ? error.message : 'Operation failed'
      };
    }
  }, [toggleOrtho, togglePolar, setOrthoSettings, setPolarSettings, getPresetById, applyPreset]);

  const loadPreset = useCallback((presetId: string): ConstraintOperationResult => {
    try {
      const preset = getPresetById(presetId);
      if (!preset) {
        throw new Error(`Preset not found: ${presetId}`);
      }

      applyPreset(preset);
      
      return { success: true, operation: { type: 'load-preset', presetId }, data: preset };
    } catch (error) {
      return {
        success: false,
        operation: { type: 'load-preset', presetId },
        error: error instanceof Error ? error.message : 'Failed to load preset'
      };
    }
  }, [getPresetById, applyPreset]);

  const exportSettings = useCallback(() => {
    return {
      orthoSettings,
      polarSettings,
      settings,
      constraints,
      version: '1.0',
      timestamp: Date.now()
    };
  }, [orthoSettings, polarSettings, settings, constraints]);

  const importSettings = useCallback((data: unknown): ConstraintOperationResult => {
    try {
      // ✅ ENTERPRISE: Type guard pattern αντί για 'as any'
      if (typeof data === 'object' && data !== null) {
        const validData = data as Record<string, unknown>;

        if ('orthoSettings' in validData && validData.orthoSettings) {
          setOrthoSettings({ ...DEFAULT_ORTHO_SETTINGS, ...validData.orthoSettings as Partial<OrthoConstraintSettings> });
        }
        if ('polarSettings' in validData && validData.polarSettings) {
          setPolarSettings({ ...DEFAULT_POLAR_SETTINGS, ...validData.polarSettings as Partial<PolarConstraintSettings> });
        }
        if ('settings' in validData && validData.settings) {
          setSettings(prev => mergeConstraintSettings({ ...prev, ...DEFAULT_CONSTRAINTS_SETTINGS }, validData.settings as Partial<ConstraintsSettings>));
        }
        if ('constraints' in validData && validData.constraints) {
          if (Array.isArray(validData.constraints)) {
            const list = validData.constraints.filter((item): item is ConstraintDefinition => {
              return typeof item === 'object' && item !== null && 'id' in item;
            });
            setConstraints(toConstraintsRecord(list));
          } else if (typeof validData.constraints === 'object') {
            setConstraints(validData.constraints as Record<string, ConstraintDefinition>);
          }
        }
      }
      
      return { success: true, operation: { type: 'import' } };
    } catch (error) {
      return {
        success: false,
        operation: { type: 'import' },
        error: error instanceof Error ? error.message : 'Import failed'
      };
    }
  }, [setOrthoSettings, setPolarSettings, setSettings, setConstraints, toConstraintsRecord]);

  return {
    performOperation,
    loadPreset,
    exportSettings,
    importSettings
  };
}
