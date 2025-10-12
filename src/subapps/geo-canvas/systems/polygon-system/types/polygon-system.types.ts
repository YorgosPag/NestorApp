/**
 * 🏢 ENTERPRISE POLYGON SYSTEM TYPES
 * Unified type definitions for centralized polygon management
 *
 * @module polygon-system/types
 */

import type { PolygonType, UniversalPolygon } from '@geo-alert/core';

// ============================================================================
// CORE SYSTEM TYPES
// ============================================================================

/**
 * User role types for polygon system configuration
 */
export type UserRole = 'citizen' | 'professional' | 'technical';

/**
 * Visual feedback configuration
 */
export interface VisualFeedbackConfig {
  /** Control point styles */
  controlPoints: {
    normal: {
      size: number;
      color: string;
      borderColor: string;
      cursor: string;
    };
    highlighted: {
      size: number;
      color: string;
      borderColor: string;
      animation: string;
      shadow: string;
    };
    completed: {
      size: number;
      color: string;
      borderColor: string;
      cursor: string;
    };
  };

  /** Polygon line styles */
  lines: {
    drawing: {
      color: string;
      width: number;
      dashArray: number[];
    };
    completed: {
      color: string;
      width: number;
      dashArray: number[];
    };
  };

  /** Z-index configuration */
  zIndex: {
    controlPoints: number;
    lines: number;
    notifications: number;
  };
}

/**
 * Notification system configuration
 */
export interface NotificationConfig {
  position: string;
  autoRemoveDelay: number;
  styles: {
    success: string;
    warning: string;
    error: string;
  };
}

/**
 * Role-based polygon system configuration
 */
export interface RoleBasedConfig {
  role: UserRole;
  snapTolerance: number;
  enableSnapping: boolean;
  autoSave: boolean;
  debug: boolean;
  visualFeedback: VisualFeedbackConfig;
  notifications: NotificationConfig;
}

/**
 * Polygon system state
 */
export interface PolygonSystemState {
  /** Current user role */
  currentRole: UserRole;

  /** Active polygons */
  polygons: UniversalPolygon[];

  /** Drawing state */
  isDrawing: boolean;
  currentTool: PolygonType | null;
  currentDrawing: {
    type: PolygonType;
    config: {
      fillColor?: string;
      strokeColor?: string;
      strokeWidth?: number;
      pointMode?: boolean;
      radius?: number;
      [key: string]: unknown;
    }
  } | null;

  /** Legacy compatibility */
  isPolygonComplete: boolean;
  completedPolygon: any[] | null;

  /** Map integration */
  mapRef: React.RefObject<any> | null;
  mapLoaded: boolean;

  /** Coordinate picking */
  isPickingCoordinates: boolean;
  coordinatePickingBlocked: boolean;
}

/**
 * Polygon system actions
 */
export interface PolygonSystemActions {
  /** Role management */
  setRole: (role: UserRole) => void;

  /** Polygon operations */
  startDrawing: (type: PolygonType, config?: {
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    pointMode?: boolean;
    radius?: number;
    [key: string]: unknown;
  }) => void;
  finishDrawing: () => UniversalPolygon | null;
  cancelDrawing: () => void;
  clearAll: () => void;
  addPoint: (longitude: number, latitude: number) => void;

  /** Configuration updates */
  updatePolygonConfig: (polygonId: string, configUpdates: Partial<{
    fillColor: string;
    strokeColor: string;
    strokeWidth: number;
    pointMode: boolean;
    radius: number;
    [key: string]: unknown;
  }>) => void;

  /** Export functionality */
  exportAsGeoJSON: () => GeoJSON.FeatureCollection;

  /** Live preview functionality */
  getCurrentDrawing: () => UniversalPolygon | null;

  /** Legacy compatibility */
  handlePolygonClosure: () => void;

  /** Map integration */
  setMapRef: (ref: React.RefObject<any>) => void;
  setMapLoaded: (loaded: boolean) => void;

  /** Coordinate picking */
  setCoordinatePicking: (enabled: boolean) => void;
  blockCoordinatePicking: (blocked: boolean) => void;

  /** Notification system */
  showNotification: (message: string, type: 'success' | 'warning' | 'error') => void;
}

/**
 * Combined polygon system context
 */
export interface PolygonSystemContext {
  state: PolygonSystemState;
  actions: PolygonSystemActions;
  config: RoleBasedConfig;
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

/**
 * Polygon controls component props
 */
export interface PolygonControlsProps {
  onToolSelect?: (tool: PolygonType | null) => void;
  onComplete?: () => void;
  onCancel?: () => void;
  onClearAll?: () => void;
  className?: string;
}

/**
 * Polygon renderer component props
 */
export interface PolygonRendererProps {
  polygons?: UniversalPolygon[];
  visualConfig?: VisualFeedbackConfig;
  onPolygonClick?: (polygon: UniversalPolygon) => void;
  className?: string;
}

// ============================================================================
// HOOK RETURN TYPES
// ============================================================================

/**
 * Centralized polygon system hook return type
 */
export interface CentralizedPolygonSystemHook {
  /** Current polygons */
  polygons: UniversalPolygon[];

  /** Statistics */
  stats: {
    totalPolygons: number;
    activeDrawing: boolean;
    currentTool: PolygonType | null;
  };

  /** Actions */
  startDrawing: (type: PolygonType, config?: any) => void;
  finishDrawing: () => UniversalPolygon | null;
  cancelDrawing: () => void;
  clearAll: () => void;
  addPoint: (longitude: number, latitude: number) => void;

  /** Configuration updates */
  updatePolygonConfig: (polygonId: string, configUpdates: Partial<{
    fillColor: string;
    strokeColor: string;
    strokeWidth: number;
    pointMode: boolean;
    radius: number;
    [key: string]: unknown;
  }>) => void;

  /** Export functionality */
  exportAsGeoJSON: () => GeoJSON.FeatureCollection;

  /** Live preview functionality */
  getCurrentDrawing: () => UniversalPolygon | null;

  /** Map integration */
  setMapRef: (ref: React.RefObject<any>) => void;

  /** Legacy compatibility */
  handlePolygonClosure: () => void;
  isPolygonComplete: boolean;

  /** State */
  isDrawing: boolean;
  currentRole: UserRole;
}

// ============================================================================
// CONFIGURATION DEFAULTS
// ============================================================================

/**
 * Default visual feedback configuration
 */
export const DEFAULT_VISUAL_CONFIG: VisualFeedbackConfig = {
  controlPoints: {
    normal: {
      size: 16,
      color: '#ef4444',
      borderColor: '#fca5a5',
      cursor: 'pointer'
    },
    highlighted: {
      size: 32,
      color: '#4ade80',
      borderColor: '#bbf7d0',
      animation: 'animate-bounce',
      shadow: 'shadow-lg shadow-green-500/50'
    },
    completed: {
      size: 16,
      color: '#10b981',
      borderColor: '#6ee7b7',
      cursor: 'default'
    }
  },
  lines: {
    drawing: {
      color: '#3b82f6',
      width: 2,
      dashArray: [2, 2]
    },
    completed: {
      color: '#10b981',
      width: 3,
      dashArray: [1, 0]
    }
  },
  zIndex: {
    controlPoints: 9999,
    lines: 1000,
    notifications: 10000
  }
};

/**
 * Default notification configuration
 */
export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  position: 'fixed top-4 right-4',
  autoRemoveDelay: 3000,
  styles: {
    success: 'bg-green-500 text-white p-4 rounded-lg shadow-lg animate-pulse',
    warning: 'bg-yellow-500 text-white p-4 rounded-lg shadow-lg animate-pulse',
    error: 'bg-red-500 text-white p-4 rounded-lg shadow-lg animate-pulse'
  }
};