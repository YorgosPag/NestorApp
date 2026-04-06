/**
 * 📊 ANALYTICS BRIDGE SERVICE
 *
 * Connects GEO-ALERT components με το existing EventAnalyticsEngine
 * Centralizes user behavior tracking, performance monitoring, και error analytics
 *
 * Split (ADR-065 Phase 5):
 * - analytics-bridge-types.ts      → Types, interfaces, config
 * - analytics-bridge-monitoring.ts  → Performance/network monitoring (DI)
 * - AnalyticsBridge.ts (this file) → Core class, singleton, hook
 */

'use client';

import { safeJsonParse } from '@/lib/json-utils';
import { generateSessionId as generateEnterpriseSessionId, generateEventId as generateEnterpriseEventId } from '@/services/enterprise-id.service';
import { startPerformanceMonitoring } from './analytics-bridge-monitoring';

// Re-export all types for backward compatibility
export type {
  UserType,
  GeoAlertEventType,
  GeoAlertEvent,
  UserSession,
  PerformanceMetrics,
  AnalyticsBridgeConfig,
  EventAnalyticsEnginePlaceholder,
  PerformanceTrackable,
} from './analytics-bridge-types';

import type {
  UserType,
  GeoAlertEventType,
  GeoAlertEvent,
  UserSession,
  AnalyticsBridgeConfig,
  EventAnalyticsEnginePlaceholder,
} from './analytics-bridge-types';

// ============================================================================
// ANALYTICS BRIDGE CLASS
// ============================================================================

export class AnalyticsBridge {
  private analyticsEngine: EventAnalyticsEnginePlaceholder | null;
  private currentSession: UserSession | null = null;
  private eventQueue: GeoAlertEvent[] = [];
  private isOnline = true;
  private config: AnalyticsBridgeConfig;

  constructor(config: Partial<AnalyticsBridgeConfig> = {}) {
    this.config = {
      enabled: true,
      batchSize: 10,
      flushInterval: 30000,
      enablePerformanceMonitoring: true,
      enableUserBehaviorTracking: true,
      enableErrorTracking: true,
      debug: process.env.NODE_ENV === 'development',
      ...config
    };

    this.analyticsEngine = null;

    // Defer initialization to prevent setState during render warning
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.initializeSession();
        this.setupEventListeners();
        startPerformanceMonitoring(this, this.config);
      }, 0);
    }
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  private initializeSession(): void {
    if (!this.config.enabled) return;

    const sessionId = this.generateSessionId();
    const userId = this.getCurrentUserId();
    const userType = this.getCurrentUserType();

    this.currentSession = {
      sessionId,
      userId,
      userType,
      startTime: new Date(),
      pageViews: 1,
      events: [],
      errors: [],
      features: []
    };

    this.trackEvent('session_started', {
      component: 'AnalyticsBridge',
      action: 'Session Initialization',
      metadata: {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });

    this.log('Session initialized', { sessionId, userId, userType });
  }

  private generateSessionId(): string {
    return generateEnterpriseSessionId();
  }

  private getCurrentUserId(): string | undefined {
    const userData = localStorage.getItem('user') || localStorage.getItem('currentUser');
    if (userData) {
      const user = safeJsonParse<{ id?: string; email?: string }>(userData, { });
      return user.id || user.email;
    }
    return undefined;
  }

  private getCurrentUserType(): UserType | undefined {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = safeJsonParse<{ userType?: UserType }>(userData, { });
      return user.userType;
    }
    return undefined;
  }

  // ============================================================================
  // EVENT TRACKING
  // ============================================================================

  trackEvent(
    type: GeoAlertEventType,
    data: GeoAlertEvent['data'],
    performance?: GeoAlertEvent['performance'],
    geoContext?: GeoAlertEvent['geoContext']
  ): string {
    if (!this.config.enabled) return '';

    if (!this.currentSession) {
      this.currentSession = {
        sessionId: this.generateSessionId(),
        userId: undefined,
        userType: undefined,
        startTime: new Date(),
        pageViews: 1,
        events: [],
        errors: [],
        features: []
      };
    }

    const event: GeoAlertEvent = {
      id: this.generateEventId(),
      type,
      timestamp: new Date(),
      userId: this.currentSession.userId,
      userType: this.currentSession.userType,
      sessionId: this.currentSession.sessionId,
      data,
      performance,
      geoContext
    };

    this.currentSession.events.push(event);
    this.eventQueue.push(event);

    if (data.feature && !this.currentSession.features.includes(data.feature)) {
      this.currentSession.features.push(data.feature);
    }

    this.log('Event tracked', { type, eventId: event.id });

    if (this.eventQueue.length >= this.config.batchSize) {
      this.flushEvents();
    }

    return event.id;
  }

  trackUserBehavior(action: string, component: string, metadata?: Record<string, unknown>): string {
    return this.trackEvent('feature_used', {
      component,
      action,
      feature: `${component}.${action}`,
      metadata
    });
  }

  trackPolygonEvent(action: 'start' | 'point_added' | 'completed' | 'cancelled', metadata?: Record<string, unknown>): string {
    const type = action === 'completed' ? 'polygon_completed' : 'polygon_drawn';

    return this.trackEvent(type, {
      component: 'PolygonDrawing',
      action,
      feature: 'polygon_system',
      success: action === 'completed',
      metadata
    });
  }

  trackMapInteraction(
    action: string,
    coordinates?: [number, number],
    zoom?: number,
    metadata?: Record<string, unknown>
  ): string {
    return this.trackEvent('map_interaction', {
      component: 'InteractiveMap',
      action,
      feature: 'map_interaction',
      metadata
    }, undefined, {
      coordinates,
      zoom,
      mapProvider: 'MapLibre'
    });
  }

  trackError(errorId: string, error: Error, component?: string): string {
    if (this.currentSession) {
      this.currentSession.errors.push(errorId);
    }

    return this.trackEvent('error_occurred', {
      component: component || 'Unknown',
      action: 'Error Occurred',
      feature: 'error_tracking',
      success: false,
      errorId,
      metadata: {
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack?.substring(0, 500)
      }
    });
  }

  trackPerformanceIssue(metric: string, value: number, threshold: number): string {
    return this.trackEvent('performance_issue', {
      component: 'PerformanceMonitor',
      action: 'Threshold Exceeded',
      feature: 'performance_monitoring',
      success: false,
      metadata: {
        metric,
        value,
        threshold,
        exceedanceRatio: value / threshold
      }
    }, {
      loadTime: metric === 'pageLoadTime' ? value : undefined,
      renderTime: metric === 'componentRenderTime' ? value : undefined,
      memoryUsage: metric === 'memoryUsage' ? value : undefined
    });
  }

  // ============================================================================
  // EVENT PROCESSING
  // ============================================================================

  private flushEvents(): void {
    if (this.eventQueue.length === 0) return;

    try {
      const analyticsEvents = this.eventQueue.map(event => ({
        id: event.id,
        type: event.type,
        timestamp: event.timestamp,
        severity: this.getEventSeverity(event.type),
        source: `GEO-ALERT.${event.data.component || 'Unknown'}`,
        data: {
          ...event.data,
          userId: event.userId,
          userType: event.userType,
          sessionId: event.sessionId,
          performance: event.performance,
          geoContext: event.geoContext
        }
      }));

      // TODO: Re-enable when EventAnalyticsEngine is implemented
      // analyticsEvents.forEach(event => {
      //   this.analyticsEngine.logEvent(event);
      // });

      if (this.config.debug) {
        void analyticsEvents; // suppress unused variable in debug builds
      }

      this.log('Events flushed', { count: this.eventQueue.length });
      this.eventQueue = [];
    } catch (error) {
      this.log('Failed to flush events', error);
    }
  }

  private getEventSeverity(type: GeoAlertEventType): 'info' | 'warning' | 'error' | 'critical' {
    switch (type) {
      case 'error_occurred':
        return 'error';
      case 'performance_issue':
      case 'alert_triggered':
        return 'warning';
      default:
        return 'info';
    }
  }

  private setupEventListeners(): void {
    window.addEventListener('beforeunload', () => {
      this.endSession();
      this.flushEvents();
    });

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushEvents();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    setInterval(() => {
      if (this.isOnline) {
        this.flushEvents();
      }
    }, this.config.flushInterval);
  }

  private endSession(): void {
    if (!this.currentSession) return;

    this.currentSession.endTime = new Date();
    this.currentSession.duration = this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime();

    this.trackEvent('session_ended', {
      component: 'AnalyticsBridge',
      action: 'Session Ended',
      duration: this.currentSession.duration,
      metadata: {
        pageViews: this.currentSession.pageViews,
        eventsTracked: this.currentSession.events.length,
        errorsOccurred: this.currentSession.errors.length,
        featuresUsed: this.currentSession.features.length
      }
    });

    this.log('Session ended', {
      sessionId: this.currentSession.sessionId,
      duration: this.currentSession.duration
    });
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private generateEventId(): string {
    return generateEnterpriseEventId();
  }

  private log(message: string, data?: unknown): void {
    if (this.config.debug) {
      void message;
      void data;
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  getCurrentSession(): UserSession | null {
    return this.currentSession;
  }

  getAnalyticsEngine(): EventAnalyticsEnginePlaceholder | null {
    return this.analyticsEngine;
  }

  updateUser(userId: string, userType?: UserType): void {
    if (this.currentSession) {
      this.currentSession.userId = userId;
      if (userType) {
        this.currentSession.userType = userType;
      }

      this.trackEvent('user_type_selected', {
        component: 'UserTypeSelector',
        action: 'User Type Updated',
        feature: 'user_management',
        metadata: { newUserType: userType }
      });
    }
  }

  clearData(): void {
    this.eventQueue = [];
    if (this.currentSession) {
      this.currentSession.events = [];
      this.currentSession.errors = [];
      this.currentSession.features = [];
    }
    this.log('Analytics data cleared');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const analyticsBridge = new AnalyticsBridge({
  enabled: true,
  batchSize: 10,
  flushInterval: 30000,
  enablePerformanceMonitoring: true,
  enableUserBehaviorTracking: true,
  enableErrorTracking: true,
  debug: process.env.NODE_ENV === 'development'
});

// ============================================================================
// REACT HOOK
// ============================================================================

export function useAnalytics() {
  return {
    trackEvent: analyticsBridge.trackEvent.bind(analyticsBridge),
    trackUserBehavior: analyticsBridge.trackUserBehavior.bind(analyticsBridge),
    trackPolygonEvent: analyticsBridge.trackPolygonEvent.bind(analyticsBridge),
    trackMapInteraction: analyticsBridge.trackMapInteraction.bind(analyticsBridge),
    trackError: analyticsBridge.trackError.bind(analyticsBridge),
    trackPerformanceIssue: analyticsBridge.trackPerformanceIssue.bind(analyticsBridge),
    getCurrentSession: () => analyticsBridge.getCurrentSession(),
    updateUser: analyticsBridge.updateUser.bind(analyticsBridge)
  };
}
