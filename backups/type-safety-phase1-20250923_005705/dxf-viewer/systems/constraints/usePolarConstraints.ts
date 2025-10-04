import { useCallback } from 'react';
import type { Point2D } from '../coordinates/config';
import type { PolarConstraintSettings, PolarConstraintsInterface } from './config';

export interface PolarConstraintsHook extends PolarConstraintsInterface {}

export function usePolarConstraints(
  polarSettings: PolarConstraintSettings,
  setPolarSettings: React.Dispatch<React.SetStateAction<PolarConstraintSettings>>,
  onPolarToggle?: (enabled: boolean) => void
): PolarConstraintsHook {
  const enablePolar = useCallback(() => {
    setPolarSettings(prev => ({ ...prev, enabled: true }));
    onPolarToggle?.(true);
  }, [setPolarSettings, onPolarToggle]);

  const disablePolar = useCallback(() => {
    setPolarSettings(prev => ({ ...prev, enabled: false }));
    onPolarToggle?.(false);
  }, [setPolarSettings, onPolarToggle]);

  const togglePolar = useCallback(() => {
    setPolarSettings(prev => {
      const newEnabled = !prev.enabled;
      onPolarToggle?.(newEnabled);
      return { ...prev, enabled: newEnabled };
    });
  }, [setPolarSettings, onPolarToggle]);

  const isPolarEnabled = useCallback(() => polarSettings.enabled, [polarSettings.enabled]);

  const updatePolarSettings = useCallback((updates: Partial<PolarConstraintSettings>) => {
    setPolarSettings(prev => ({ ...prev, ...updates }));
  }, [setPolarSettings]);

  const getPolarSettings = useCallback(() => polarSettings, [polarSettings]);

  const setPolarBasePoint = useCallback((point: Point2D) => {
    setPolarSettings(prev => ({ ...prev, basePoint: point }));
  }, [setPolarSettings]);

  const setPolarBaseAngle = useCallback((angle: number) => {
    setPolarSettings(prev => ({ ...prev, baseAngle: angle }));
  }, [setPolarSettings]);

  return {
    enablePolar,
    disablePolar,
    togglePolar,
    isPolarEnabled,
    updatePolarSettings,
    getPolarSettings,
    setPolarBasePoint,
    setPolarBaseAngle
  };
}