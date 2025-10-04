import { useCallback } from 'react';
import type { RulerSettings, RulerSettingsUpdate, UnitType } from './config';

export interface RulerManagementHook {
  toggleRulers: (type?: 'horizontal' | 'vertical' | 'both') => void;
  setRulerVisibility: (type: 'horizontal' | 'vertical', visible: boolean) => void;
  updateRulerSettings: (updates: RulerSettingsUpdate) => void;
  setRulerUnits: (units: UnitType) => void;
  setRulerPosition: (type: 'horizontal' | 'vertical', position: 'top' | 'bottom' | 'left' | 'right') => void;
}

export function useRulerManagement(
  rulers: RulerSettings,
  setRulers: React.Dispatch<React.SetStateAction<RulerSettings>>
): RulerManagementHook {
  const toggleRulers = useCallback((type: 'horizontal' | 'vertical' | 'both' = 'both') => {
    setRulers(prev => {
      const newSettings = { ...prev };
      if (type === 'horizontal' || type === 'both') {
        newSettings.horizontal.enabled = !prev.horizontal.enabled;
      }
      if (type === 'vertical' || type === 'both') {
        newSettings.vertical.enabled = !prev.vertical.enabled;
      }
      return newSettings;
    });
  }, [setRulers]);

  const setRulerVisibility = useCallback((type: 'horizontal' | 'vertical', visible: boolean) => {
    setRulers(prev => ({
      ...prev,
      [type]: { ...prev[type], enabled: visible }
    }));
  }, [setRulers]);

  const updateRulerSettings = useCallback((updates: RulerSettingsUpdate) => {
    setRulers(prev => {
      const newSettings = { ...prev };
      
      if (updates.horizontal) {
        newSettings.horizontal = { ...prev.horizontal, ...updates.horizontal };
      }
      if (updates.vertical) {
        newSettings.vertical = { ...prev.vertical, ...updates.vertical };
      }
      if (updates.units !== undefined) {
        newSettings.units = updates.units;
      }
      if (updates.snap) {
        newSettings.snap = { ...prev.snap, ...updates.snap };
      }
      
      return newSettings;
    });
  }, [setRulers]);

  const setRulerUnits = useCallback((units: UnitType) => {
    setRulers(prev => ({ ...prev, units }));
  }, [setRulers]);

  const setRulerPosition = useCallback((
    type: 'horizontal' | 'vertical', 
    position: 'top' | 'bottom' | 'left' | 'right'
  ) => {
    setRulers(prev => ({
      ...prev,
      [type]: { ...prev[type], position }
    }));
  }, [setRulers]);

  return {
    toggleRulers,
    setRulerVisibility,
    updateRulerSettings,
    setRulerUnits,
    setRulerPosition
  };
}