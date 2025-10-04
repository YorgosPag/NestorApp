import { useCallback } from 'react';
import type { OrthoConstraintSettings } from './config';

export interface OrthoConstraintsHook {
  enableOrtho: () => void;
  disableOrtho: () => void;
  toggleOrtho: () => void;
  isOrthoEnabled: () => boolean;
  updateOrthoSettings: (updates: Partial<OrthoConstraintSettings>) => void;
  getOrthoSettings: () => OrthoConstraintSettings;
}

export function useOrthoConstraints(
  orthoSettings: OrthoConstraintSettings,
  setOrthoSettings: React.Dispatch<React.SetStateAction<OrthoConstraintSettings>>,
  onOrthoToggle?: (enabled: boolean) => void
): OrthoConstraintsHook {
  const enableOrtho = useCallback(() => {
    setOrthoSettings(prev => ({ ...prev, enabled: true }));
    onOrthoToggle?.(true);
  }, [setOrthoSettings, onOrthoToggle]);

  const disableOrtho = useCallback(() => {
    setOrthoSettings(prev => ({ ...prev, enabled: false }));
    onOrthoToggle?.(false);
  }, [setOrthoSettings, onOrthoToggle]);

  const toggleOrtho = useCallback(() => {
    setOrthoSettings(prev => {
      const newEnabled = !prev.enabled;
      onOrthoToggle?.(newEnabled);
      return { ...prev, enabled: newEnabled };
    });
  }, [setOrthoSettings, onOrthoToggle]);

  const isOrthoEnabled = useCallback(() => orthoSettings.enabled, [orthoSettings.enabled]);

  const updateOrthoSettings = useCallback((updates: Partial<OrthoConstraintSettings>) => {
    setOrthoSettings(prev => ({ ...prev, ...updates }));
  }, [setOrthoSettings]);

  const getOrthoSettings = useCallback(() => orthoSettings, [orthoSettings]);

  return {
    enableOrtho,
    disableOrtho,
    toggleOrtho,
    isOrthoEnabled,
    updateOrthoSettings,
    getOrthoSettings
  };
}