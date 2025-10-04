import { useCallback } from 'react';
import type { 
  ConstraintOperation,
  ConstraintOperationResult,
  ConstraintDefinition,
  OrthoConstraintSettings,
  PolarConstraintSettings,
  ConstraintsSettings
} from './config';
import {
  DEFAULT_ORTHO_SETTINGS,
  DEFAULT_POLAR_SETTINGS,
  DEFAULT_CONSTRAINTS_SETTINGS,
  CONSTRAINT_PRESETS
} from './config';

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
          if (operation.presetId && CONSTRAINT_PRESETS[operation.presetId]) {
            const preset = CONSTRAINT_PRESETS[operation.presetId];
            setOrthoSettings(preset.orthoSettings);
            setPolarSettings(preset.polarSettings);
          }
          break;
        default:
          throw new Error(`Unknown operation: ${operation.type}`);
      }
      
      return { success: true, operation: operation.type };
    } catch (error) {
      return {
        success: false,
        operation: operation.type,
        error: error instanceof Error ? error.message : 'Operation failed'
      };
    }
  }, [toggleOrtho, togglePolar, setOrthoSettings, setPolarSettings]);

  const loadPreset = useCallback((presetId: string): ConstraintOperationResult => {
    try {
      const preset = CONSTRAINT_PRESETS[presetId];
      if (!preset) {
        throw new Error(`Preset not found: ${presetId}`);
      }
      
      setOrthoSettings(preset.orthoSettings);
      setPolarSettings(preset.polarSettings);
      if (preset.constraints) {
        setConstraints(preset.constraints);
      }
      
      return { success: true, operation: 'load-preset', data: preset };
    } catch (error) {
      return {
        success: false,
        operation: 'load-preset',
        error: error instanceof Error ? error.message : 'Failed to load preset'
      };
    }
  }, [setOrthoSettings, setPolarSettings, setConstraints]);

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
      if (data.orthoSettings) setOrthoSettings({ ...DEFAULT_ORTHO_SETTINGS, ...data.orthoSettings });
      if (data.polarSettings) setPolarSettings({ ...DEFAULT_POLAR_SETTINGS, ...data.polarSettings });
      if (data.settings) setSettings({ ...DEFAULT_CONSTRAINTS_SETTINGS, ...data.settings });
      if (data.constraints) setConstraints(data.constraints);
      
      return { success: true, operation: 'import' };
    } catch (error) {
      return {
        success: false,
        operation: 'import',
        error: error instanceof Error ? error.message : 'Import failed'
      };
    }
  }, [setOrthoSettings, setPolarSettings, setSettings, setConstraints]);

  return {
    performOperation,
    loadPreset,
    exportSettings,
    importSettings
  };
}