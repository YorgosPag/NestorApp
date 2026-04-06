/**
 * 📊 ANALYTICS BRIDGE — TYPES & INTERFACES
 *
 * Extracted from AnalyticsBridge.ts (ADR-065 Phase 5)
 * Types for GEO-ALERT analytics tracking system
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type UserType = 'citizen' | 'professional' | 'technical';

export type GeoAlertEventType =
  | 'user_login'
  | 'user_type_selected'
  | 'polygon_drawn'
  | 'polygon_completed'
  | 'map_interaction'
  | 'floor_plan_uploaded'
  | 'alert_created'
  | 'alert_triggered'
  | 'dashboard_opened'
  | 'error_occurred'
  | 'performance_issue'
  | 'feature_used'
  | 'session_started'
  | 'session_ended';

export interface GeoAlertEvent {
  id: string;
  type: GeoAlertEventType;
  timestamp: Date;
  userId?: string;
  userType?: UserType;
  sessionId: string;

  // Event specific data
  data: {
    component?: string;
    action?: string;
    feature?: string;
    duration?: number;
    success?: boolean;
    errorId?: string;
    metadata?: Record<string, unknown>;
  };

  // Performance data
  performance?: {
    loadTime?: number;
    renderTime?: number;
    memoryUsage?: number;
    networkLatency?: number;
  };

  // Geographic context
  geoContext?: {
    coordinates?: [number, number];
    zoom?: number;
    bounds?: [[number, number], [number, number]];
    mapProvider?: string;
  };
}

export interface UserSession {
  sessionId: string;
  userId?: string;
  userType?: UserType;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  pageViews: number;
  events: GeoAlertEvent[];
  errors: string[];
  features: string[];
}

export interface PerformanceMetrics {
  pageLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToInteractive: number;
  memoryUsage: number;
  jsHeapSizeUsed: number;
  jsHeapSizeTotal: number;
}

export interface AnalyticsBridgeConfig {
  enabled: boolean;
  batchSize: number;
  flushInterval: number;
  enablePerformanceMonitoring: boolean;
  enableUserBehaviorTracking: boolean;
  enableErrorTracking: boolean;
  debug: boolean;
}

/** Placeholder type for future EventAnalyticsEngine */
export interface EventAnalyticsEnginePlaceholder {
  logEvent?: (event: unknown) => void;
}

/**
 * Interface for dependency injection in monitoring functions.
 * Allows monitoring module to call tracking methods without circular dependency.
 */
export interface PerformanceTrackable {
  trackEvent(
    type: GeoAlertEventType,
    data: GeoAlertEvent['data'],
    performance?: GeoAlertEvent['performance'],
    geoContext?: GeoAlertEvent['geoContext']
  ): string;
  trackPerformanceIssue(metric: string, value: number, threshold: number): string;
}
