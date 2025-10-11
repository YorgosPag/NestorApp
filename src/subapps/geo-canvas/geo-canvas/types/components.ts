/**
 * COMPONENT TYPES για GEO-CANVAS
 * Enterprise-class React component types
 */

import type { ReactNode } from 'react';

// ============================================================================
// MAIN APP PROPS
// ============================================================================

/**
 * Props για το κεντρικό GeoCanvasApp component
 */
export interface GeoCanvasAppProps {
  className?: string;
  children?: ReactNode;

  // Optional initial configuration
  initialConfig?: {
    mapCenter?: { lng: number; lat: number };
    mapZoom?: number;
    defaultCRS?: string;
  };

  // Feature flags για progressive enhancement
  features?: {
    enableDxfImport?: boolean;
    enableMapLibre?: boolean;
    enableAlerts?: boolean;
    enableSpatialQueries?: boolean;
  };

  // Callbacks για parent communication
  onStatusChange?: (status: AppStatus) => void;
  onError?: (error: Error) => void;
}

/**
 * Application Status για external monitoring
 */
export type AppStatus =
  | 'initializing'
  | 'ready'
  | 'loading'
  | 'processing'
  | 'error';

// ============================================================================
// CONTENT COMPONENT PROPS
// ============================================================================

/**
 * Props που περνάνε από App → Content
 */
export interface GeoCanvasContentProps extends GeoCanvasAppProps {
  // Internal props που προστίθενται από το App layer
  version?: string;
  buildInfo?: {
    phase: string;
    features: string[];
    timestamp: string;
  };
}

// ============================================================================
// ERROR BOUNDARY TYPES
// ============================================================================

/**
 * Error Boundary state interface
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: {
    componentStack: string;
  };
}

/**
 * Error Recovery actions
 */
export type ErrorRecoveryAction = 'retry' | 'reload' | 'fallback';

// ============================================================================
// PROVIDER TYPES (για μελλοντικές phases)
// ============================================================================

/**
 * Context Provider props pattern
 */
export interface ProviderProps {
  children: ReactNode;
  enabled?: boolean;
}

/**
 * Geo Transform Provider props (Phase 2)
 */
export interface GeoTransformProviderProps extends ProviderProps {
  defaultCRS?: string;
  accuracyThreshold?: number;
}

/**
 * Map Provider props (Phase 3)
 */
export interface MapProviderProps extends ProviderProps {
  mapStyle?: string | object;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
}

/**
 * Alert Engine Provider props (Phase 5)
 */
export interface AlertEngineProviderProps extends ProviderProps {
  maxActiveAlerts?: number;
  realtimeUpdates?: boolean;
}