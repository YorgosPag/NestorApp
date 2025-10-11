/**
 * 📍 USE SNAP ENGINE HOOK
 *
 * React hook για snap engine management
 *
 * @module floor-plan-system/snapping/hooks/useSnapEngine
 *
 * Features:
 * - Initialize snap engine με DXF data
 * - Calculate snap για cursor position
 * - Manage snap state
 * - Provide snap result
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ParserResult } from '@/subapps/dxf-viewer/types/parser.types';
import { SnapEngine, createSnapEngine } from '../engine';
import type { SnapResult, SnapSettings } from '../types';

/**
 * Hook options
 */
export interface UseSnapEngineOptions {
  /** Initial snap settings */
  settings?: Partial<SnapSettings>;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Hook return type
 */
export interface UseSnapEngineReturn {
  /** Current snap result (null if no snap) */
  snapResult: SnapResult | null;
  /** Calculate snap for cursor position */
  calculateSnap: (cursorX: number, cursorY: number) => SnapResult | null;
  /** Clear current snap */
  clearSnap: () => void;
  /** Update snap settings */
  updateSettings: (settings: Partial<SnapSettings>) => void;
  /** Enable/disable snap */
  setEnabled: (enabled: boolean) => void;
  /** Current snap settings */
  settings: SnapSettings;
  /** Is snap engine ready? */
  isReady: boolean;
  /** Number of snap points */
  snapPointsCount: number;
}

/**
 * useSnapEngine Hook
 *
 * Main hook για snap functionality
 *
 * @param parserResult - DXF parser result
 * @param options - Hook options
 * @returns Snap engine interface
 */
export function useSnapEngine(
  parserResult: ParserResult | null,
  options: UseSnapEngineOptions = {}
): UseSnapEngineReturn {
  const { settings: initialSettings, debug = false } = options;

  // ===================================================================
  // REFS
  // ===================================================================

  // Snap engine instance (persistent across renders)
  const engineRef = useRef<SnapEngine | null>(null);

  // ===================================================================
  // STATE
  // ===================================================================

  const [snapResult, setSnapResult] = useState<SnapResult | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentSettings, setCurrentSettings] = useState<SnapSettings | null>(null);

  // ===================================================================
  // INITIALIZATION
  // ===================================================================

  // Create snap engine (once)
  useEffect(() => {
    if (!engineRef.current) {
      if (debug) console.log('🔧 useSnapEngine: Creating snap engine...');
      engineRef.current = createSnapEngine(initialSettings);
    }
  }, [initialSettings, debug]);

  // Initialize engine με DXF data
  useEffect(() => {
    if (!engineRef.current) return;

    if (debug) console.log('🔧 useSnapEngine: Initializing με DXF data...');
    engineRef.current.initialize(parserResult);

    const ready = engineRef.current.isInitialized();
    setIsReady(ready);

    if (ready) {
      setCurrentSettings(engineRef.current.getSettings());
      if (debug) {
        console.log(`✅ useSnapEngine: Ready with ${engineRef.current.getSnapPointsCount()} snap points`);
      }
    }
  }, [parserResult, debug]);

  // ===================================================================
  // CALLBACKS
  // ===================================================================

  /**
   * Calculate snap for cursor position
   */
  const calculateSnap = useCallback((cursorX: number, cursorY: number): SnapResult | null => {
    if (!engineRef.current || !isReady) {
      return null;
    }

    const result = engineRef.current.calculateSnap(cursorX, cursorY);
    setSnapResult(result);

    if (debug && result) {
      console.log('🎯 Snap found:', {
        point: result.point,
        distance: result.distance.toFixed(2)
      });
    }

    return result;
  }, [isReady, debug]);

  /**
   * Clear current snap
   */
  const clearSnap = useCallback(() => {
    if (!engineRef.current) return;

    engineRef.current.clearSnap();
    setSnapResult(null);
  }, []);

  /**
   * Update snap settings
   */
  const updateSettings = useCallback((settings: Partial<SnapSettings>) => {
    if (!engineRef.current) return;

    engineRef.current.updateSettings(settings);
    setCurrentSettings(engineRef.current.getSettings());

    if (debug) console.log('⚙️ useSnapEngine: Settings updated', settings);
  }, [debug]);

  /**
   * Enable/disable snap
   */
  const setEnabled = useCallback((enabled: boolean) => {
    if (!engineRef.current) return;

    engineRef.current.setEnabled(enabled);
    setCurrentSettings(engineRef.current.getSettings());

    if (!enabled) {
      clearSnap();
    }

    if (debug) console.log(`⚙️ useSnapEngine: Snap ${enabled ? 'enabled' : 'disabled'}`);
  }, [clearSnap, debug]);

  // ===================================================================
  // RETURN
  // ===================================================================

  return {
    snapResult,
    calculateSnap,
    clearSnap,
    updateSettings,
    setEnabled,
    settings: currentSettings || engineRef.current?.getSettings() || {} as SnapSettings,
    isReady,
    snapPointsCount: engineRef.current?.getSnapPointsCount() || 0
  };
}
