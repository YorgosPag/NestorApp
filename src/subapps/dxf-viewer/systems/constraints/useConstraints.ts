/**
 * CONSTRAINTS SYSTEM HOOK
 * Standalone hook for accessing ortho/polar constraints context and utilities
 */

import { useContext } from 'react';
import type {
  ConstraintType,
  ConstraintDefinition,
  ConstraintsState,
  ConstraintsSettings,
  OrthoConstraintSettings,
  PolarConstraintSettings,
  ConstraintContext,
  ConstraintResult,
  ConstraintOperation,
  ConstraintOperationResult,
  ConstraintPreset,
  PolarCoordinates,
  CartesianCoordinates
} from './config';

// ✅ ENTERPRISE FIX: Fixed circular reference - use generic interface to break cycle
interface ConstraintsContextType {
  [key: string]: unknown; // Generic interface to break circular reference
}

export function useConstraints(): ConstraintsContextType {
  const { ConstraintsContext } = require('./ConstraintsSystem');
  const context = useContext(ConstraintsContext);
  if (!context) {
    throw new Error('useConstraints must be used within a ConstraintsSystem');
  }
  return context as ConstraintsContextType;
}

// Additional convenience hooks
export function useOrthoConstraints() {
  const constraints = useConstraints();
  return {
    enabled: constraints.isOrthoEnabled(),
    settings: constraints.getOrthoSettings(),
    enable: constraints.enableOrtho,
    disable: constraints.disableOrtho,
    toggle: constraints.toggleOrtho,
    updateSettings: constraints.updateOrthoSettings
  };
}

export function usePolarConstraints() {
  const constraints = useConstraints();
  return {
    enabled: constraints.isPolarEnabled(),
    settings: constraints.getPolarSettings(),
    enable: constraints.enablePolar,
    disable: constraints.disablePolar,
    toggle: constraints.togglePolar,
    updateSettings: constraints.updatePolarSettings,
    setBasePoint: constraints.setPolarBasePoint,
    setBaseAngle: constraints.setPolarBaseAngle
  };
}

export function useConstraintApplication() {
  const constraints = useConstraints();
  return {
    applyConstraints: constraints.applyConstraints,
    validatePoint: constraints.validatePoint,
    getConstrainedPoint: constraints.getConstrainedPoint,
    context: constraints.getConstraintContext(),
    setContext: constraints.setConstraintContext,
    updateContext: constraints.updateConstraintContext
  };
}

export function useConstraintManagement() {
  const constraints = useConstraints();
  return {
    constraints: constraints.getConstraints(),
    activeConstraints: constraints.getActiveConstraints(),
    addConstraint: constraints.addConstraint,
    removeConstraint: constraints.removeConstraint,
    enableConstraint: constraints.enableConstraint,
    disableConstraint: constraints.disableConstraint,
    toggleConstraint: constraints.toggleConstraint,
    clearConstraints: constraints.clearConstraints
  };
}

export function useCoordinateConversion() {
  const constraints = useConstraints();
  return {
    cartesianToPolar: constraints.cartesianToPolar,
    polarToCartesian: constraints.polarToCartesian,
    normalizeAngle: constraints.normalizeAngle,
    snapToAngle: constraints.snapToAngle,
    getAngleBetweenPoints: constraints.getAngleBetweenPoints,
    getDistanceBetweenPoints: constraints.getDistanceBetweenPoints
  };
}

export function useConstraintSettings() {
  const constraints = useConstraints();
  return {
    settings: constraints.getSettings(),
    updateSettings: constraints.updateSettings,
    resetSettings: constraints.resetSettings,
    loadPreset: constraints.loadPreset,
    savePreset: constraints.savePreset,
    getPresets: constraints.getPresets(),
    deletePreset: constraints.deletePreset
  };
}

export function useConstraintInput() {
  const constraints = useConstraints();
  return {
    handleKeyDown: constraints.handleKeyDown,
    handleKeyUp: constraints.handleKeyUp,
    handleMouseMove: constraints.handleMouseMove,
    isEnabled: constraints.isEnabled(),
    temporarilyDisable: constraints.temporarilyDisable,
    enable: constraints.enable,
    disable: constraints.disable
  };
}

export function useConstraintVisualization() {
  const constraints = useConstraints();
  return {
    renderData: constraints.getRenderData(),
    shouldShowFeedback: constraints.shouldShowFeedback(),
    constraintLines: constraints.getConstraintLines(),
    constraintMarkers: constraints.getConstraintMarkers()
  };
}

// Legacy hook names for backward compatibility
export const useOrtho = useOrthoConstraints;
export const usePolar = usePolarConstraints;
export const useOrthoPolar = useConstraints;

// ✅ ENTERPRISE FIX: Fixed circular reference - use proper type alias
export type ConstraintsHookReturn = ConstraintsContextType;

export function setConstraintsContext(context: any) {
  // TODO: Implement proper context setter if needed
  // This is a placeholder to resolve import error
  console.warn('setConstraintsContext called but not implemented');
}