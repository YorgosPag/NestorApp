/**
 * useGripSettings
 * Manages grip settings and visual helpers
 */

'use client';

import { useState, useCallback } from 'react';
import type { GripSettings } from '../../types/gripSettings';
import { validateGripSettings, DEFAULT_GRIP_SETTINGS } from '../../types/gripSettings';
// ===== OVERRIDE GUARD SYSTEM =====
import { guardGlobalAccess } from '../../../utils/overrideGuard';
// ===== AUTO-SAVE FUNCTIONALITY DISABLED =====
// import { useAutoSaveSettings, useLoadSavedSettings } from '../useAutoSaveSettings';

export function useGripSettings() {
  // AUTO-SAVE DISABLED - Load saved settings on initialization
  // const savedSettings = useLoadSavedSettings<GripSettings>('dxf-grip-general-settings');

  // Fallback state για backwards compatibility - χωρίς auto-load
  const [gripSettings, setGripSettings] = useState<GripSettings>(DEFAULT_GRIP_SETTINGS);

  // ===== AUTO-SAVE FUNCTIONALITY DISABLED =====
  // const autoSaveStatus = useAutoSaveSettings({
  //   storageKey: 'dxf-grip-general-settings',
  //   data: gripSettings,
  //   enabled: true,
  //   debounceMs: 500,
  //   onSaved: (data) => {
  //     console.log('✅ [GripSettings] Αποθηκεύτηκαν οι γενικές ρυθμίσεις grips:', data);
  //   },
  //   onError: (error) => {
  //     console.error('❌ [GripSettings] Σφάλμα αποθήκευσης:', error);
  //   }
  // });

  // Update grip settings with validation
  const updateGripSettings = useCallback((updates: Partial<GripSettings>) => {
    // 🔥 GUARD: Προστασία ενημέρωσης των γενικών grip settings όταν override ενεργό
    guardGlobalAccess('GRIP_SETTINGS_UPDATE');
    setGripSettings(prev => validateGripSettings({ ...prev, ...updates }));
  }, []);

  // Get grip size based on state
  const getGripSize = useCallback((state: 'cold' | 'warm' | 'hot') => {
    // 🔥 GUARD: Προστασία πρόσβασης στις γενικές grip settings όταν override ενεργό
    guardGlobalAccess('GRIP_SIZE_READ');
    const baseSize = gripSettings.gripSize * gripSettings.dpiScale;
    switch (state) {
      case 'warm': return Math.round(baseSize * 1.2);
      case 'hot': return Math.round(baseSize * 1.4);
      case 'cold':
      default: return Math.round(baseSize);
    }
  }, [gripSettings.gripSize, gripSettings.dpiScale]);

  // Get grip color based on state
  const getGripColor = useCallback((state: 'cold' | 'warm' | 'hot') => {
    // 🔥 GUARD: Προστασία πρόσβασης στις γενικές grip settings όταν override ενεργό
    guardGlobalAccess('GRIP_COLOR_READ');
    return gripSettings.colors[state];
  }, [gripSettings.colors]);

  return {
    gripSettings,
    updateGripSettings,
    getGripSize,
    getGripColor,
    // autoSaveStatus // DISABLED: Θα αντικατασταθεί από κεντρικό provider
  };
}