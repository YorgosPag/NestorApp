/**
 * ORTHO/POLAR CONSTRAINTS SYSTEM CONFIGURATION
 * Single Source of Truth για orthogonal και polar constraint systems
 */

import type { Point2D } from '../../rendering/types/Types';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-067: Import centralized conversion constants
import { DEGREES_TO_RADIANS, RADIANS_TO_DEGREES } from '../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-079: Centralized Entity Limits Constants
import { ENTITY_LIMITS } from '../../config/tolerance-config';
// 🏢 ADR-118: Centralized Zero Point Pattern
import { ZERO_VECTOR } from '../../config/geometry-constants';

// ===== BASIC TYPES =====
export type ConstraintType = 'ortho' | 'polar' | 'angle' | 'distance' | 'parallel' | 'perpendicular' | 'tangent' | 'horizontal' | 'vertical';
export type ConstraintMode = 'absolute' | 'relative' | 'dynamic';
export type AngleUnit = 'degrees' | 'radians' | 'gradians';

// ===== ORTHO CONSTRAINT CONFIGURATION =====
export interface OrthoConstraintSettings {
  enabled: boolean;
  mode: 'strict' | 'assist' | 'lock';
  angleStep: number; // in degrees (e.g., 90 for cardinal directions, 45 for diagonal)
  tolerance: number; // snap tolerance in degrees
  lockAxes: {
    horizontal: boolean;
    vertical: boolean;
    diagonal: boolean;
  };
  visualFeedback: {
    showConstraintLines: boolean;
    showAngleIndicator: boolean;
    lineColor: string;
    lineWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    opacity: number;
  };
  behavior: {
    snapToCardinal: boolean; // Snap to 0, 90, 180, 270 degrees
    snapToDiagonal: boolean; // Snap to 45, 135, 225, 315 degrees
    inheritFromLastSegment: boolean; // Continue direction from last line
    overrideWithShift: boolean; // Shift key toggles ortho temporarily
  };
}

// ===== POLAR CONSTRAINT CONFIGURATION =====
export interface PolarConstraintSettings {
  enabled: boolean;
  mode: 'absolute' | 'relative' | 'incremental';
  angleStep: number; // in degrees (e.g., 15, 30, 45)
  distanceStep: number; // in drawing units
  angleTolerance: number; // snap tolerance in degrees
  distanceTolerance: number; // snap tolerance in units
  baseAngle: number; // reference angle in degrees (usually 0)
  basePoint: Point2D; // reference point for polar tracking
  visualFeedback: {
    showPolarRay: boolean;
    showDistanceMarker: boolean;
    showAngleArc: boolean;
    rayColor: string;
    rayWidth: number;
    rayLength: number;
    arcColor: string;
    arcRadius: number;
    markerColor: string;
    markerSize: number;
    opacity: number;
  };
  behavior: {
    trackingEnabled: boolean; // Show tracking rays as you move
    infiniteRays: boolean; // Rays extend beyond cursor
    dynamicAngles: boolean; // Calculate angles from geometry
    lockDistance: boolean; // Lock to specific distances
    lockAngle: boolean; // Lock to specific angles
  };
}

// ===== CONSTRAINT DEFINITIONS =====
export interface ConstraintDefinition {
  id: string;
  type: ConstraintType;
  name: string;
  description: string;
  enabled: boolean;
  priority: number; // Higher priority constraints are applied first
  parameters: Record<string, unknown>;
  validation?: (point: Point2D, context: ConstraintContext) => boolean;
  transform?: (point: Point2D, context: ConstraintContext) => Point2D;
  feedback?: (point: Point2D, context: ConstraintContext) => ConstraintFeedback;
}

// ===== CONSTRAINT CONTEXT DATA =====
export interface ConstraintContextData {
  currentPoint: Point2D;
  previousPoints: Point2D[];
  referencePoint?: Point2D;
  baseAngle?: number;
  mousePosition: Point2D;
  keyboardModifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
  };
  snapSettings: {
    enabled: boolean;
    tolerance: number;
  };
  activeConstraints: ConstraintDefinition[];
}

// ===== CONSTRAINT CONTEXT INTERFACE =====
/**
 * 🏢 ENTERPRISE: Complete ConstraintContext interface
 * Combines all constraint-related interfaces για unified API
 * Based on existing centralized interfaces - ZERO DUPLICATES
 */
export interface ConstraintContext extends
  PolarConstraintsInterface,
  ConstraintManagementInterface {

  // State and Data
  state: ConstraintsState;

  // Ortho Constraints (from OrthoConstraintsHook)
  enableOrtho: () => void;
  disableOrtho: () => void;
  toggleOrtho: () => void;
  isOrthoEnabled: () => boolean;
  updateOrthoSettings: (updates: Partial<OrthoConstraintSettings>) => void;
  getOrthoSettings: () => OrthoConstraintSettings;

  // Constraint Application
  applyConstraints: (point: Point2D, context?: Partial<ConstraintContextData>) => ConstraintResult;
  validatePoint: (point: Point2D, context?: Partial<ConstraintContextData>) => boolean;
  getConstrainedPoint: (point: Point2D, context?: Partial<ConstraintContextData>) => Point2D;
  getConstraintContext: () => ConstraintContextData;
  setConstraintContext: (context: ConstraintContextData) => void;
  updateConstraintContext: (updates: Partial<ConstraintContextData>) => void;

  // ✅ ENTERPRISE: Additional context methods (από useConstraintContext.ts requirements)
  setCurrentTool: (tool: string) => void;
  setInputMode: (mode: 'point' | 'distance' | 'angle') => void;
  setLastPoint: (point: Point2D | null) => void;

  // ✅ ENTERPRISE: Context data access (από utils.ts requirements)
  referencePoint?: Point2D;

  // Coordinate Conversion
  cartesianToPolar: (point: Point2D, basePoint?: Point2D) => PolarCoordinates;
  polarToCartesian: (polar: PolarCoordinates, basePoint?: Point2D) => Point2D;
  normalizeAngle: (angle: number) => number;
  snapToAngle: (angle: number, step?: number) => number;
  getAngleBetweenPoints: (point1: Point2D, point2: Point2D) => number;
  getDistanceBetweenPoints: (point1: Point2D, point2: Point2D) => number;

  // Settings Management
  getSettings: () => ConstraintsSettings;
  updateSettings: (updates: Partial<ConstraintsSettings>) => void;
  resetSettings: () => void;
  loadPreset: (presetId: string) => void;
  savePreset: (preset: ConstraintPreset) => void;
  getPresets: () => ConstraintPreset[];
  deletePreset: (presetId: string) => void;

  // Input Handling
  handleKeyDown: (event: KeyboardEvent) => void;
  handleKeyUp: (event: KeyboardEvent) => void;
  handleMouseMove: (event: MouseEvent, canvasRect: DOMRect) => void;
  isEnabled: () => boolean;
  temporarilyDisable: () => void;
  enable: () => void;
  disable: () => void;

  // Visualization
  getRenderData: () => ConstraintFeedback[];
  shouldShowFeedback: () => boolean;
  getConstraintLines: () => Array<{ start: Point2D; end: Point2D; color: string; width: number; style: string; }>;
  getConstraintMarkers: () => Array<{ position: Point2D; type: string; color: string; size: number; }>;

  // Context Management
  updateContext: (updates: Partial<ConstraintContextData>) => void;
  getContext: () => ConstraintContextData;

  // Operations
  performOperation: (operation: ConstraintOperation) => Promise<ConstraintOperationResult>;

  // Coordinate Conversion Aliases (compatibility)
  toPolar: (point: Point2D, basePoint?: Point2D) => PolarCoordinates;
  toCartesian: (polar: PolarCoordinates, basePoint?: Point2D) => Point2D;
}

// ===== CONSTRAINT FEEDBACK =====
export interface ConstraintFeedback {
  type: 'visual' | 'audio' | 'haptic';
  visual?: {
    lines: Array<{
      start: Point2D;
      end: Point2D;
      color: string;
      width: number;
      style: 'solid' | 'dashed' | 'dotted';
    }>;
    circles: Array<{
      center: Point2D;
      radius: number;
      color: string;
      width: number;
      fill?: boolean;
    }>;
    arcs: Array<{
      center: Point2D;
      radius: number;
      startAngle: number;
      endAngle: number;
      color: string;
      width: number;
    }>;
    text: Array<{
      position: Point2D;
      text: string;
      color: string;
      size: number;
      font: string;
    }>;
    markers: Array<{
      position: Point2D;
      type: 'cross' | 'circle' | 'square' | 'diamond';
      color: string;
      size: number;
    }>;
  };
  audio?: {
    type: 'beep' | 'click' | 'snap';
    frequency: number;
    duration: number;
    volume: number;
  };
  haptic?: {
    type: 'vibration' | 'force';
    intensity: number;
    duration: number;
  };
}

// ===== CONSTRAINT RESULT =====
export interface ConstraintResult {
  constrainedPoint: Point2D;
  appliedConstraints: ConstraintDefinition[];
  feedback: ConstraintFeedback[];
  metadata: {
    angle?: number;
    distance?: number;
    direction?: string;
    accuracy: number;
  };
}

// ===== CONSTRAINTS SYSTEM STATE =====
export interface ConstraintsState {
  ortho: OrthoConstraintSettings;
  polar: PolarConstraintSettings;
  constraints: Record<string, ConstraintDefinition>;
  activeConstraints: string[];
  currentContext: ConstraintContext | null;
  lastResult: ConstraintResult | null;
  isEnabled: boolean;
  temporaryDisabled: boolean;
  settings: ConstraintsSettings;
}

// ===== CONSTRAINTS SETTINGS =====
export interface ConstraintsSettings {
  general: {
    enabled: boolean;
    priority: ConstraintType[];
    globalTolerance: number;
    showFeedback: boolean;
    audioFeedback: boolean;
    hapticFeedback: boolean;
  };
  display: {
    showConstraintLines: boolean;
    showTooltips: boolean;
    fadeInactiveConstraints: boolean;
    constraintLineOpacity: number;
    feedbackDuration: number;
  };
  input: {
    keyboardShortcuts: Record<string, ConstraintType>;
    mouseModifiers: {
      shift: ConstraintType | null;
      ctrl: ConstraintType | null;
      alt: ConstraintType | null;
    };
    touchGestures: Record<string, ConstraintType>;
  };
  performance: {
    maxConstraintChecks: number;
    optimizeRendering: boolean;
    throttleUpdates: boolean;
    updateInterval: number;
  };
}

// ===== DEFAULT SETTINGS =====
export const DEFAULT_ORTHO_SETTINGS: OrthoConstraintSettings = {
  enabled: false,
  mode: 'assist',
  angleStep: 90,
  tolerance: 5,
  lockAxes: {
    horizontal: true,
    vertical: true,
    diagonal: false
  },
  visualFeedback: {
    showConstraintLines: true,
    showAngleIndicator: true,
    lineColor: UI_COLORS.GREEN,
    lineWidth: 1,
    lineStyle: 'dashed',
    opacity: 0.7
  },
  behavior: {
    snapToCardinal: true,
    snapToDiagonal: false,
    inheritFromLastSegment: true,
    overrideWithShift: true
  }
};

// 🏢 ADR-118: Use centralized ZERO_VECTOR for basePoint
export const DEFAULT_POLAR_SETTINGS: PolarConstraintSettings = {
  enabled: false,
  mode: 'absolute',
  angleStep: 15,
  distanceStep: 10,
  angleTolerance: 2,
  distanceTolerance: 1,
  baseAngle: 0,
  basePoint: ZERO_VECTOR,
  visualFeedback: {
    showPolarRay: true,
    showDistanceMarker: true,
    showAngleArc: true,
    rayColor: UI_COLORS.YELLOW,
    rayWidth: 1,
    rayLength: 100,
    arcColor: UI_COLORS.YELLOW,
    arcRadius: 30,
    markerColor: UI_COLORS.RED,
    markerSize: 4,
    opacity: 0.8
  },
  behavior: {
    trackingEnabled: true,
    infiniteRays: true,
    dynamicAngles: true,
    lockDistance: false,
    lockAngle: false
  }
};

export const DEFAULT_CONSTRAINTS_SETTINGS: ConstraintsSettings = {
  general: {
    enabled: true,
    priority: ['ortho', 'polar', 'angle', 'distance', 'parallel', 'perpendicular'],
    globalTolerance: 5,
    showFeedback: true,
    audioFeedback: false,
    hapticFeedback: false
  },
  display: {
    showConstraintLines: true,
    showTooltips: true,
    fadeInactiveConstraints: true,
    constraintLineOpacity: 0.6,
    feedbackDuration: 1000
  },
  input: {
    keyboardShortcuts: {
      'F8': 'ortho',
      'F10': 'polar',
      'Ctrl+L': 'horizontal',
      'Ctrl+V': 'vertical'
    },
    mouseModifiers: {
      shift: 'ortho',
      ctrl: null,
      alt: null
    },
    touchGestures: {}
  },
  performance: {
    maxConstraintChecks: 10,
    optimizeRendering: true,
    throttleUpdates: true,
    updateInterval: 16
  }
};

// ===== CONSTANTS =====
// 🏢 ADR-067: Angle constants now imported from geometry-utils.ts
export const CONSTRAINTS_CONFIG = {
  // Angle constants - re-exported from centralized source
  DEGREES_TO_RADIANS,
  RADIANS_TO_DEGREES,

  // Standard angles in degrees
  CARDINAL_ANGLES: [0, 90, 180, 270],
  DIAGONAL_ANGLES: [45, 135, 225, 315],
  COMMON_ANGLES: [0, 15, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330],
  
  // Tolerance limits
  MIN_ANGLE_TOLERANCE: 0.1,
  MAX_ANGLE_TOLERANCE: 45,
  MIN_DISTANCE_TOLERANCE: 0.01,
  MAX_DISTANCE_TOLERANCE: 100,
  
  // Performance limits
  MAX_CONSTRAINT_DISTANCE: 1000, // Maximum distance for constraint calculations
  MIN_UPDATE_INTERVAL: 10, // Minimum milliseconds between updates
  MAX_UPDATE_INTERVAL: 100, // Maximum milliseconds between updates
  
  // Visual constants
  MIN_RAY_LENGTH: 20,
  MAX_RAY_LENGTH: 500,
  DEFAULT_RAY_LENGTH: 100,
  MIN_ARC_RADIUS: 10,
  MAX_ARC_RADIUS: 100,
  DEFAULT_ARC_RADIUS: 30,
  
  // Color constants
  COLORS: {
    ORTHO: UI_COLORS.GREEN,
    POLAR: UI_COLORS.YELLOW,
    ANGLE: UI_COLORS.BLUE_DEFAULT,
    DISTANCE: UI_COLORS.ORANGE,
    PARALLEL: UI_COLORS.PURPLE,
    PERPENDICULAR: UI_COLORS.MAGENTA,
    ACTIVE: UI_COLORS.WHITE,
    INACTIVE: UI_COLORS.MEDIUM_GRAY
  }
} as const;

// ===== CONSTRAINT OPERATIONS =====
export type ConstraintOperationType =
  | 'enable-constraint'
  | 'disable-constraint'
  | 'toggle-constraint'
  | 'toggle-ortho'
  | 'toggle-polar'
  | 'reset-settings'
  | 'load-preset'
  | 'set-base-point'
  | 'set-base-angle'
  | 'add-constraint'
  | 'remove-constraint'
  | 'add'
  | 'remove'
  | 'import'
  | 'remove-constraint'
  | 'clear-constraints'
  | 'reset-constraints';

export interface ConstraintOperation {
  type: ConstraintOperationType;
  presetId?: string;
  payload?: unknown;
}

export interface ConstraintOperationResult {
  success: boolean;
  operation: ConstraintOperation;
  constraintId?: string;
  error?: string;
  data?: unknown;
}

// ===== UTILITY TYPES =====
export interface PolarCoordinates {
  distance: number;
  angle: number;
  angleUnit: AngleUnit;
}

export interface CartesianCoordinates {
  x: number;
  y: number;
}

export interface ConstraintValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ===== CONSTRAINT PRESETS =====
export interface ConstraintPreset {
  id: string;
  name: string;
  description: string;
  constraints: ConstraintDefinition[];
  settings: Partial<ConstraintsSettings>;
  tags: string[];
}

export const DEFAULT_CONSTRAINT_PRESETS: ConstraintPreset[] = [
  {
    id: 'architectural',
    name: 'Architectural Drawing',
    description: 'Standard constraints for architectural drafting',
    constraints: [],
    settings: {
      general: {
        enabled: true,
        priority: ['ortho', 'polar', 'parallel', 'perpendicular'],
        globalTolerance: 0.01,
        showFeedback: true,
        audioFeedback: false,
        hapticFeedback: false
      }
    },
    tags: ['architecture', 'building', 'construction']
  },
  {
    id: 'mechanical',
    name: 'Mechanical Drawing',
    description: 'Precision constraints for mechanical parts',
    constraints: [],
    settings: {
      general: {
        enabled: true,
        priority: ['angle', 'distance', 'parallel', 'tangent'],
        // 🏢 ADR-079: Use centralized constraint tolerance
        globalTolerance: ENTITY_LIMITS.CONSTRAINT_TOLERANCE,
        showFeedback: true,
        audioFeedback: true,
        hapticFeedback: true
      }
    },
    tags: ['mechanical', 'engineering', 'precision']
  },
  {
    id: 'artistic',
    name: 'Artistic/Freeform',
    description: 'Minimal constraints for artistic drawing',
    constraints: [],
    settings: {
      general: {
        enabled: false,
        priority: [],
        globalTolerance: 0.1,
        showFeedback: false,
        audioFeedback: false,
        hapticFeedback: false
      }
    },
    tags: ['art', 'creative', 'freeform']
  }
];

// ✅ ENTERPRISE: Alias για backward compatibility με useConstraintOperations.ts
export const CONSTRAINT_PRESETS = DEFAULT_CONSTRAINT_PRESETS;

// ===== SHARED HOOK INTERFACES =====
/**
 * Interface for constraint management operations - eliminates duplicate method signatures
 */
export interface ConstraintManagementInterface {
  addConstraint: (constraint: ConstraintDefinition) => Promise<ConstraintOperationResult>;
  removeConstraint: (constraintId: string) => Promise<ConstraintOperationResult>;
  enableConstraint: (constraintId: string) => void;
  disableConstraint: (constraintId: string) => void;
  toggleConstraint: (constraintId: string) => void;
  getConstraint: (constraintId: string) => ConstraintDefinition | undefined;
  getConstraints: () => Record<string, ConstraintDefinition>;
  getActiveConstraints: () => ConstraintDefinition[];
  clearConstraints: () => void;
}

/**
 * Interface for polar constraint operations - eliminates duplicate method signatures
 */
export interface PolarConstraintsInterface {
  enablePolar: () => void;
  disablePolar: () => void;
  togglePolar: () => void;
  isPolarEnabled: () => boolean;
  updatePolarSettings: (updates: Partial<PolarConstraintSettings>) => void;
  getPolarSettings: () => PolarConstraintSettings;
  setPolarBasePoint: (point: Point2D) => void;
  setPolarBaseAngle: (angle: number) => void;
}

// ===== TYPE EXPORTS =====
export type { Point2D };
export type ConstraintSettings = ConstraintsSettings;