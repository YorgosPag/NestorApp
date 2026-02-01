import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  ConstraintsState,
  ConstraintDefinition,
  ConstraintResult,
  ConstraintContext,
  ConstraintContextData,
  OrthoConstraintSettings,
  PolarConstraintSettings,
  ConstraintsSettings,
  PolarCoordinates,
  CartesianCoordinates,
  ConstraintOperation,
  ConstraintOperationResult,
  ConstraintPreset,
  PolarConstraintsInterface,
  ConstraintManagementInterface,
  ConstraintFeedback,
  ConstraintOperationType
} from './config';
import {
  DEFAULT_ORTHO_SETTINGS,
  DEFAULT_POLAR_SETTINGS,
  DEFAULT_CONSTRAINTS_SETTINGS
} from './config';
// 🏢 ADR-092: Centralized localStorage Service
import { storageGet, storageSet } from '../../utils/storage-utils';
// 🏢 ADR-105: Centralized Hit Test Fallback Tolerance
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';

// Import the base persistence hook
interface ConstraintsPersistedData {
  orthoSettings?: Partial<OrthoConstraintSettings>;
  polarSettings?: Partial<PolarConstraintSettings>;
  settings?: Partial<ConstraintsSettings>;
  constraints?: Record<string, ConstraintDefinition>;
  timestamp?: number;
}

/**
 * Load constraints settings from storage
 * 🏢 ADR-092: Using centralized storage-utils
 */
function useLoadConstraintsSettings(enablePersistence: boolean, persistenceKey: string): () => ConstraintsPersistedData | null {
  return () => {
    if (!enablePersistence) return null;
    return storageGet<ConstraintsPersistedData | null>(persistenceKey, null);
  };
}

export interface ConstraintsSystemStateProps {
  initialOrthoSettings?: Partial<OrthoConstraintSettings>;
  initialPolarSettings?: Partial<PolarConstraintSettings>;
  initialSettings?: Partial<ConstraintsSettings>;
  initialConstraints?: Record<string, ConstraintDefinition>;
  enablePersistence?: boolean;
  persistenceKey?: string;
  onConstraintChange?: (constraints: Record<string, ConstraintDefinition>) => void;
  globalHotkeys?: boolean;
}

export interface ConstraintsSystemStateReturn {
  // State values
  orthoSettings: OrthoConstraintSettings;
  polarSettings: PolarConstraintSettings;
  settings: ConstraintsSettings;
  constraints: Record<string, ConstraintDefinition>;
  activeConstraints: string[];
  lastAppliedResult: ConstraintResult | null;
  constraintContext: ConstraintContextData;
  state: ConstraintsState;

  // Setters
  setOrthoSettings: React.Dispatch<React.SetStateAction<OrthoConstraintSettings>>;
  setPolarSettings: React.Dispatch<React.SetStateAction<PolarConstraintSettings>>;
  setSettings: React.Dispatch<React.SetStateAction<ConstraintsSettings>>;
  setConstraints: React.Dispatch<React.SetStateAction<Record<string, ConstraintDefinition>>>;
  setActiveConstraints: React.Dispatch<React.SetStateAction<string[]>>;
  setLastAppliedResult: React.Dispatch<React.SetStateAction<ConstraintResult | null>>;
  setConstraintContext: React.Dispatch<React.SetStateAction<ConstraintContextData>>;
}

export function useConstraintsSystemState({
  initialOrthoSettings = {},
  initialPolarSettings = {},
  initialSettings = {},
  initialConstraints = {},
  enablePersistence = false,
  persistenceKey = 'dxf-viewer-constraints',
  onConstraintChange,
  globalHotkeys = true
}: ConstraintsSystemStateProps): ConstraintsSystemStateReturn {

  const loadPersistedSettings = useLoadConstraintsSettings(enablePersistence, persistenceKey);
  const persistedData = loadPersistedSettings();

  // State initialization
  const [orthoSettings, setOrthoSettings] = useState<OrthoConstraintSettings>(() => ({
    ...DEFAULT_ORTHO_SETTINGS,
    ...persistedData?.orthoSettings,
    ...initialOrthoSettings
  }));

  const [polarSettings, setPolarSettings] = useState<PolarConstraintSettings>(() => ({
    ...DEFAULT_POLAR_SETTINGS,
    ...persistedData?.polarSettings,
    ...initialPolarSettings
  }));

  const [settings, setSettings] = useState<ConstraintsSettings>(() => ({
    ...DEFAULT_CONSTRAINTS_SETTINGS,
    ...persistedData?.settings,
    ...initialSettings
  }));

  const [constraints, setConstraints] = useState<Record<string, ConstraintDefinition>>(() => ({
    ...persistedData?.constraints,
    ...initialConstraints
  }));

  const [activeConstraints, setActiveConstraints] = useState<string[]>([]);
  const [lastAppliedResult, setLastAppliedResult] = useState<ConstraintResult | null>(null);
  const [constraintContext, setConstraintContext] = useState<ConstraintContextData>({
    currentPoint: { x: 0, y: 0 },
    previousPoints: [],
    referencePoint: undefined,
    baseAngle: 0,
    mousePosition: { x: 0, y: 0 },
    keyboardModifiers: {
      shift: false,
      ctrl: false,
      alt: false
    },
    // 🏢 ADR-105: Use centralized fallback tolerance
    snapSettings: {
      enabled: true,
      tolerance: TOLERANCE_CONFIG.HIT_TEST_FALLBACK
    },
    activeConstraints: []
  });

  // Persistence effect
  // 🏢 ADR-092: Using centralized storage-utils
  useEffect(() => {
    if (enablePersistence) {
      const dataToStore: ConstraintsPersistedData = {
        orthoSettings,
        polarSettings,
        settings,
        constraints,
        timestamp: Date.now()
      };
      storageSet(persistenceKey, dataToStore);
    }
  }, [orthoSettings, polarSettings, settings, constraints, enablePersistence, persistenceKey]);

  // Update active constraints when constraints change
  useEffect(() => {
    const active = Object.keys(constraints).filter(id => constraints[id].enabled);
    setActiveConstraints(active);
    onConstraintChange?.(constraints);
  }, [constraints, onConstraintChange]);

  // Global hotkey effects
  useEffect(() => {
    if (!globalHotkeys) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // ✅ ENTERPRISE FIX: Update keyboard modifiers state with correct property name
      setConstraintContext(prev => ({
        ...prev,
        keyboardModifiers: {
          shift: event.shiftKey,
          ctrl: event.ctrlKey,
          alt: event.altKey
        }
      }));

      // Note: Hotkey handling for F8 and F10 will be handled by the consumer hooks
      // This is just for modifier key state updates
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      setConstraintContext(prev => ({
        ...prev,
        keyboardModifiers: {
          shift: event.shiftKey,
          ctrl: event.ctrlKey,
          alt: event.altKey
        }
      }));
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [globalHotkeys]);

  // State object
  const state = useMemo<ConstraintsState>(() => ({
    ortho: orthoSettings,
    polar: polarSettings,
    constraints,
    activeConstraints,
    currentContext: null, // Will be filled by ConstraintsSystem.tsx
    lastResult: lastAppliedResult,
    isEnabled: settings.general.enabled,
    temporaryDisabled: false,
    settings
  }), [orthoSettings, polarSettings, settings, constraints, activeConstraints, lastAppliedResult]);

  return {
    // State values
    orthoSettings,
    polarSettings,
    settings,
    constraints,
    activeConstraints,
    lastAppliedResult,
    constraintContext,
    state,

    // Setters
    setOrthoSettings,
    setPolarSettings,
    setSettings,
    setConstraints,
    setActiveConstraints,
    setLastAppliedResult,
    setConstraintContext
  };
}