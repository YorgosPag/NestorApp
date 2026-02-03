'use client';
import React, { createContext, useCallback, useEffect, useState } from 'react';
import type {
  ConstraintsSettings,
  OrthoConstraintSettings,
  PolarConstraintSettings,
  ConstraintDefinition,
  ConstraintResult,
  ConstraintContextData,
  ConstraintPreset,
  PolarCoordinates
} from './config';
import {
  DEFAULT_ORTHO_SETTINGS,
  DEFAULT_POLAR_SETTINGS,
  DEFAULT_CONSTRAINTS_SETTINGS,
  CONSTRAINT_PRESETS
} from './config';
// ⌨️ ENTERPRISE: Centralized keyboard shortcuts - Single source of truth
import { matchesShortcut } from '../../config/keyboard-shortcuts';
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
import { AngleUtils, DistanceUtils, CoordinateUtils, mergeConstraintSettings } from './utils';

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
  const [customPresets, setCustomPresets] = useState<ConstraintPreset[]>([]);
  const [temporaryDisabled, setTemporaryDisabled] = useState(false);

  const getConstrainedPoint = useCallback((point: Point2D, context?: Partial<ConstraintContextData>): Point2D => {
    return applicationHook.applyConstraints(point, context).constrainedPoint;
  }, [applicationHook]);

  const getConstraintContext = useCallback((): ConstraintContextData => constraintContext, [constraintContext]);

  const setConstraintContextValue = useCallback((context: ConstraintContextData) => {
    setConstraintContext(context);
  }, [setConstraintContext]);

  const updateConstraintContext = useCallback((updates: Partial<ConstraintContextData>) => {
    setConstraintContext(prev => ({ ...prev, ...updates }));
  }, [setConstraintContext]);

  const cartesianToPolar = useCallback((point: Point2D, basePoint?: Point2D) => {
    return CoordinateUtils.cartesianToPolar(
      point,
      basePoint ?? polarSettings.basePoint,
      polarSettings.baseAngle
    );
  }, [polarSettings.basePoint, polarSettings.baseAngle]);

  const polarToCartesian = useCallback((polar: PolarCoordinates, basePoint?: Point2D) => {
    return CoordinateUtils.polarToCartesian(
      polar,
      basePoint ?? polarSettings.basePoint,
      polarSettings.baseAngle
    );
  }, [polarSettings.basePoint, polarSettings.baseAngle]);

  const normalizeAngle = useCallback((angle: number) => AngleUtils.normalizeAngle(angle), []);

  const snapToAngle = useCallback((angle: number, step: number = polarSettings.angleStep): number => {
    const snapped = AngleUtils.snapAngleToStep(angle, step, polarSettings.angleTolerance);
    return snapped ?? angle;
  }, [polarSettings.angleStep, polarSettings.angleTolerance]);

  const getAngleBetweenPoints = useCallback((point1: Point2D, point2: Point2D) => {
    return AngleUtils.angleBetweenPoints(point1, point2);
  }, []);

  const getDistanceBetweenPoints = useCallback((point1: Point2D, point2: Point2D) => {
    return DistanceUtils.distance(point1, point2);
  }, []);

  const getSettings = useCallback(() => settings, [settings]);

  const updateSettings = useCallback((updates: Partial<ConstraintsSettings>) => {
    setSettings(prev => mergeConstraintSettings(prev, updates));
  }, [setSettings]);

  const resetAllSettings = useCallback(() => {
    setOrthoSettings(DEFAULT_ORTHO_SETTINGS);
    setPolarSettings(DEFAULT_POLAR_SETTINGS);
    setSettings(DEFAULT_CONSTRAINTS_SETTINGS);
    managementHook.clearConstraints();
  }, [setOrthoSettings, setPolarSettings, setSettings, managementHook]);

  const loadPreset = useCallback((presetId: string) => {
    operationsHook.loadPreset(presetId);
  }, [operationsHook]);

  const savePreset = useCallback((preset: ConstraintPreset) => {
    setCustomPresets(prev => {
      const existingIndex = prev.findIndex(item => item.id === preset.id);
      if (existingIndex === -1) {
        return [...prev, preset];
      }
      const next = [...prev];
      next[existingIndex] = preset;
      return next;
    });
  }, []);

  const getPresets = useCallback(() => {
    return [...CONSTRAINT_PRESETS, ...customPresets];
  }, [customPresets]);

  const deletePreset = useCallback((presetId: string) => {
    setCustomPresets(prev => prev.filter(preset => preset.id !== presetId));
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    setConstraintContext(prev => ({
      ...prev,
      keyboardModifiers: {
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        alt: event.altKey
      }
    }));
  }, [setConstraintContext]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    setConstraintContext(prev => ({
      ...prev,
      keyboardModifiers: {
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        alt: event.altKey
      }
    }));
  }, [setConstraintContext]);

  const handleMouseMove = useCallback((event: MouseEvent, canvasRect: DOMRect) => {
    const mousePosition = {
      x: event.clientX - canvasRect.left,
      y: event.clientY - canvasRect.top
    };
    setConstraintContext(prev => ({ ...prev, mousePosition }));
  }, [setConstraintContext]);

  const isEnabled = useCallback(() => settings.general.enabled && !temporaryDisabled, [settings.general.enabled, temporaryDisabled]);

  const temporarilyDisable = useCallback(() => {
    setTemporaryDisabled(true);
  }, []);

  const enable = useCallback(() => {
    setTemporaryDisabled(false);
    setSettings(prev => ({ ...prev, general: { ...prev.general, enabled: true } }));
  }, [setSettings]);

  const disable = useCallback(() => {
    setTemporaryDisabled(false);
    setSettings(prev => ({ ...prev, general: { ...prev.general, enabled: false } }));
  }, [setSettings]);

  const getRenderData = useCallback(() => lastAppliedResult?.feedback ?? [], [lastAppliedResult]);

  const shouldShowFeedback = useCallback(() => settings.general.showFeedback, [settings.general.showFeedback]);

  const getConstraintLines = useCallback(() => {
    return getRenderData().flatMap(feedback => feedback.visual?.lines ?? []);
  }, [getRenderData]);

  const getConstraintMarkers = useCallback(() => {
    return getRenderData().flatMap(feedback => feedback.visual?.markers ?? []);
  }, [getRenderData]);

  // ⌨️ ENTERPRISE: Global hotkeys using centralized keyboard-shortcuts.ts
  // Reference: AutoCAD F8=Ortho, F10=Polar standard
  useEffect(() => {
    if (!globalHotkeys) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // ✅ GUARD: Skip if typing in input fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // F8 - Ortho Mode (AutoCAD standard)
      if (matchesShortcut(event, 'orthoMode')) {
        event.preventDefault();
        orthoHook.toggleOrtho();
        return;
      }

      // F10 - Polar Tracking (AutoCAD standard)
      if (matchesShortcut(event, 'polarTracking')) {
        event.preventDefault();
        polarHook.togglePolar();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [globalHotkeys, orthoHook.toggleOrtho, polarHook.togglePolar]);

  return {
    // State
    state: {
      ...state,
      isEnabled: settings.general.enabled && !temporaryDisabled,
      temporaryDisabled
    },
    
    // Ortho Constraints
    ...orthoHook,
    
    // Polar Constraints
    ...polarHook,
    
    // Constraint Management
    ...managementHook,
    
    // Constraint Application
    ...applicationHook,
    getConstrainedPoint,
    getConstraintContext,
    setConstraintContext: setConstraintContextValue,
    updateConstraintContext,
    
    // Coordinate Conversion
    toPolar: coordinateHook.toPolar,
    toCartesian: coordinateHook.toCartesian,
    cartesianToPolar,
    polarToCartesian,
    normalizeAngle,
    snapToAngle,
    getAngleBetweenPoints,
    getDistanceBetweenPoints,
    
    // Context Management
    ...contextHook,
    getContext: (): ConstraintContextData => constraintContext,
    referencePoint: constraintContext.referencePoint,
    
    // Operations
    ...operationsHook,
    getSettings,
    updateSettings,
    loadPreset,
    savePreset,
    getPresets,
    deletePreset,
    handleKeyDown,
    handleKeyUp,
    handleMouseMove,
    isEnabled,
    temporarilyDisable,
    enable,
    disable,
    getRenderData,
    shouldShowFeedback,
    getConstraintLines,
    getConstraintMarkers,
    
    // System Control
    resetSettings: resetAllSettings
  };
}

export const ConstraintsContext = createContext<ConstraintsHookReturn | null>(null);

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
