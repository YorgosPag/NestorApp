/**
 * ENTITY CREATION SYSTEM CONFIGURATION
 * Configuration and types for entity creation/drawing tools
 */

// Re-export DrawingTool type from existing hook
export type { DrawingTool, DrawingState } from '../../hooks/drawing/useUnifiedDrawing';

// Entity creation configuration
export interface EntityCreationConfig {
  defaultLayer: string;
  autoSnapping: boolean;
  snapToGrid: boolean;
  snapToEntities: boolean;
  continuousDrawing: boolean;
  showPreview: boolean;
  defaultLineStyle: {
    color: string;
    width: number;
    dashPattern?: number[];
  };
  tools: {
    line: {
      enabled: boolean;
      icon: string;
      shortcut?: string;
    };
    rectangle: {
      enabled: boolean;
      icon: string;
      shortcut?: string;
    };
    circle: {
      enabled: boolean;
      icon: string;
      shortcut?: string;
    };
    polyline: {
      enabled: boolean;
      icon: string;
      shortcut?: string;
      allowClosed: boolean;
    };
  };
}

export const DEFAULT_ENTITY_CREATION_CONFIG: EntityCreationConfig = {
  defaultLayer: '0',
  autoSnapping: true,
  snapToGrid: true,
  snapToEntities: true,
  continuousDrawing: false,
  showPreview: true,
  defaultLineStyle: {
    color: '#ffffff',
    width: 1,
  },
  tools: {
    line: {
      enabled: true,
      icon: 'line',
      shortcut: 'L',
    },
    rectangle: {
      enabled: true,
      icon: 'rectangle',
      shortcut: 'R',
    },
    circle: {
      enabled: true,
      icon: 'circle',
      shortcut: 'C',
    },
    polyline: {
      enabled: true,
      icon: 'polyline',
      shortcut: 'P',
      allowClosed: true,
    },
  },
};

// Drawing tool constraints
export interface DrawingConstraints {
  minPoints: Record<string, number>;
  maxPoints: Record<string, number>;
  requiresClosure: string[];
  allowsPreview: string[];
}

export const DEFAULT_DRAWING_CONSTRAINTS: DrawingConstraints = {
  minPoints: {
    line: 2,
    rectangle: 2,
    circle: 2,
    polyline: 2,
  },
  maxPoints: {
    line: 2,
    rectangle: 2,
    circle: 2,
    polyline: Infinity,
  },
  requiresClosure: ['rectangle'],
  allowsPreview: ['line', 'rectangle', 'circle', 'polyline'],
};

// Entity validation rules
export interface EntityValidationRules {
  minSize: number;
  maxSize: number;
  allowZeroSize: boolean;
  requireValidGeometry: boolean;
}

export const DEFAULT_VALIDATION_RULES: EntityValidationRules = {
  minSize: 0.001,
  maxSize: 1000000,
  allowZeroSize: false,
  requireValidGeometry: true,
};

// Drawing feedback configuration
export interface DrawingFeedbackConfig {
  showCoordinates: boolean;
  showDimensions: boolean;
  showAngles: boolean;
  coordinatesPrecision: number;
  dimensionsPrecision: number;
  anglesPrecision: number;
}

export const DEFAULT_FEEDBACK_CONFIG: DrawingFeedbackConfig = {
  showCoordinates: true,
  showDimensions: true,
  showAngles: false,
  coordinatesPrecision: 2,
  dimensionsPrecision: 2,
  anglesPrecision: 1,
};