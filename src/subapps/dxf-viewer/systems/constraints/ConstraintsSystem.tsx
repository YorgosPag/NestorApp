'use client';
import React, { createContext, useCallback, useEffect } from 'react';
import type {
  ConstraintsSettings,
  OrthoConstraintSettings,
  PolarConstraintSettings,
  ConstraintDefinition,
  ConstraintResult,
  DEFAULT_ORTHO_SETTINGS,
  DEFAULT_POLAR_SETTINGS,
  DEFAULT_CONSTRAINTS_SETTINGS
} from './config';
import { setConstraintsContext, type ConstraintsHookReturn } from './useConstraints';
import type { Point2D } from '../../rendering/types/Types';
import { useConstraintsSystemState } from './useConstraintsSystemState';
import { useOrthoConstraints } from './useOrthoConstraints';
import { usePolarConstraints } from './usePolarConstraints';
import { useConstraintManagement } from './useConstraintManagement';
import { useConstraintApplication } from './useConstraintApplication';
import { useCoordinateConversion } from './useCoordinateConversion';
import { useConstraintContext } from './useConstraintContext';
import { useConstraintOperations } from './useConstraintOperations';

export interface ConstraintsSystemProps {
  children: React.ReactNode;
  initialOrthoSettings?: Partial<OrthoConstraintSettings>;
  initialPolarSettings?: Partial<PolarConstraintSettings>;
  initialSettings?: Partial<ConstraintsSettings>;
  initialConstraints?: Record<string, ConstraintDefinition>;
  enablePersistence?: boolean;
  persistenceKey?: string;
  onConstraintChange?: (constraints: Record<string, ConstraintDefinition>) => void;
  onOrthoToggle?: (enabled: boolean) => void;
  onPolarToggle?: (enabled: boolean) => void;
  onConstraintResult?: (result: ConstraintResult) => void;
  globalHotkeys?: boolean;
}

function useConstraintsSystemStateIntegration({
  initialOrthoSettings = {},
  initialPolarSettings = {},
  initialSettings = {},
  initialConstraints = {},
  enablePersistence = false,
  persistenceKey = 'dxf-viewer-constraints',
  onConstraintChange,
  onOrthoToggle,
  onPolarToggle,
  onConstraintResult,
  globalHotkeys = true
}: Omit<ConstraintsSystemProps, 'children'>): ConstraintsHookReturn {

  // Initialize core state
  const systemState = useConstraintsSystemState({
    initialOrthoSettings,
    initialPolarSettings,
    initialSettings,
    initialConstraints,
    enablePersistence,
    persistenceKey,
    onConstraintChange,
    globalHotkeys
  });

  const {
    orthoSettings,
    polarSettings,
    settings,
    constraints,
    activeConstraints,
    lastAppliedResult,
    constraintContext,
    state,
    setOrthoSettings,
    setPolarSettings,
    setSettings,
    setConstraints,
    setActiveConstraints,
    setLastAppliedResult,
    setConstraintContext
  } = systemState;

  // Initialize individual constraint hooks
  const orthoHook = useOrthoConstraints(orthoSettings, setOrthoSettings, onOrthoToggle);
  const polarHook = usePolarConstraints(polarSettings, setPolarSettings, onPolarToggle);
  const managementHook = useConstraintManagement(constraints, setConstraints, activeConstraints);
  const applicationHook = useConstraintApplication(
    constraintContext,
    setConstraintContext,
    orthoSettings,
    polarSettings,
    managementHook.getActiveConstraints,
    setLastAppliedResult,
    onConstraintResult
  );
  const coordinateHook = useCoordinateConversion(polarSettings);
  const contextHook = useConstraintContext(setConstraintContext);
  const operationsHook = useConstraintOperations(
    orthoSettings,
    polarSettings,
    settings,
    constraints,
    setOrthoSettings,
    setPolarSettings,
    setSettings,
    setConstraints,
    orthoHook.toggleOrtho,
    polarHook.togglePolar
  );

  // Handle global hotkeys
  useEffect(() => {
    if (!globalHotkeys) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Hotkey handling
      if (event.key === 'F8') {
        event.preventDefault();
        orthoHook.toggleOrtho();
      } else if (event.key === 'F10') {
        event.preventDefault();
        polarHook.togglePolar();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [globalHotkeys, orthoHook.toggleOrtho, polarHook.togglePolar]);

  return {
    // State
    state,
    
    // Ortho Constraints
    ...orthoHook,
    
    // Polar Constraints
    ...polarHook,
    
    // Constraint Management
    ...managementHook,
    
    // Constraint Application
    ...applicationHook,
    
    // Coordinate Conversion
    toPolar: coordinateHook.toPolar,
    toCartesian: coordinateHook.toCartesian,
    
    // Context Management
    ...contextHook,
    getContext: () => constraintContext,
    
    // Operations
    ...operationsHook,
    
    // System Control
    resetSettings: () => {
      setOrthoSettings(DEFAULT_ORTHO_SETTINGS);
      setPolarSettings(DEFAULT_POLAR_SETTINGS);
      setSettings(DEFAULT_CONSTRAINTS_SETTINGS);
      managementHook.clearConstraints();
    }
  };
}

const ConstraintsContext = createContext<ConstraintsHookReturn | null>(null);

export function useConstraintsContext(): ConstraintsHookReturn {
  const context = React.useContext(ConstraintsContext);
  if (!context) {
    throw new Error('useConstraintsContext must be used within ConstraintsSystem');
  }
  return context;
}

export function ConstraintsSystem({ children, ...props }: ConstraintsSystemProps) {
  const value = useConstraintsSystemStateIntegration(props);

  React.useEffect(() => {
    setConstraintsContext(ConstraintsContext);
  }, []);

  return (
    <ConstraintsContext.Provider value={value}>
      {children}
    </ConstraintsContext.Provider>
  );
}