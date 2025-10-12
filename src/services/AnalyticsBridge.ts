/**
 * 📊 ANALYTICS BRIDGE SERVICE
 *
 * Connects GEO-ALERT components με το existing EventAnalyticsEngine
 * Centralizes user behavior tracking, performance monitoring, και error analytics
 *
 * Features:
 * - Bridge between ErrorTracker και EventAnalyticsEngine
 * - User behavior tracking για GEO-ALERT specific actions
 * - Performance monitoring integration
 * - Custom events για geo/mapping operations
 */

'use client';

// TODO: EventAnalyticsEngine not implemented yet - temporarily disabled
// import { EventAnalyticsEngine } from '@geo-alert/core/alert-engine/analytics/EventAnalyticsEngine';
import { errorTracker } from './ErrorTracker';

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
    metadata?: Record<string, any>;
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

// ============================================================================
// ANALYTICS BRIDGE CLASS
// ============================================================================

export class AnalyticsBridge {
  // TODO: Temporarily disabled until EventAnalyticsEngine is implemented
  // private analyticsEngine: EventAnalyticsEngine;
  private analyticsEngine: any; // Temporary placeholder
  private currentSession: UserSession | null = null;
  private eventQueue: GeoAlertEvent[] = [];
  private isOnline = true;
  private config: AnalyticsBridgeConfig;

  constructor(config: Partial<AnalyticsBridgeConfig> = {}) {
    this.config = {
      enabled: true,
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      enablePerformanceMonitoring: true,
      enableUserBehaviorTracking: true,
      enableErrorTracking: true,
      debug: process.env.NODE_ENV === 'development',
      ...config
    };

    // TODO: EventAnalyticsEngine to be implemented
    // this.analyticsEngine = new EventAnalyticsEngine();
    this.analyticsEngine = null; // Temporary placeholder

    // Defer initialization to prevent setState during render warning
    if (typeof window !== 'undefined') {
      // Use setTimeout to defer initialization until after current render cycle
      setTimeout(() => {
        this.initializeSession();
        this.setupEventListeners();
        this.startPerformanceMonitoring();
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

    // Track session start
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
    return `geo_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentUserId(): string | undefined {
    try {
      const userData = localStorage.getItem('user') || localStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        return user.id || user.email;
      }
    } catch {
      // Ignore localStorage errors
    }
    return undefined;
  }

  private getCurrentUserType(): UserType | undefined {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        return user.userType;
      }
    } catch {
      // Ignore localStorage errors
    }
    return undefined;
  }

  // ============================================================================
  // EVENT TRACKING
  // ============================================================================

  /**
   * Track a GEO-ALERT specific event
   */
  trackEvent(
    type: GeoAlertEventType,
    data: GeoAlertEvent['data'],
    performance?: GeoAlertEvent['performance'],
    geoContext?: GeoAlertEvent['geoContext']
  ): string {
    if (!this.config.enabled) return '';

    // If session not initialized yet (deferred initialization), create minimal session
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

    // Add to session
    this.currentSession.events.push(event);

    // Add to queue για batch processing
    this.eventQueue.push(event);

    // Track feature usage
    if (data.feature && !this.currentSession.features.includes(data.feature)) {
      this.currentSession.features.push(data.feature);
    }

    this.log('Event tracked', { type, eventId: event.id });

    // Flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flushEvents();
    }

    return event.id;
  }

  /**
   * Track user behavior events
   */
  trackUserBehavior(action: string, component: string, metadata?: Record<string, any>): string {
    return this.trackEvent('feature_used', {
      component,
      action,
      feature: `${component}.${action}`,
      metadata
    });
  }

  /**
   * Track polygon drawing events
   */
  trackPolygonEvent(action: 'start' | 'point_added' | 'completed' | 'cancelled', metadata?: Record<string, any>): string {
    const type = action === 'completed' ? 'polygon_completed' : 'polygon_drawn';

    return this.trackEvent(type, {
      component: 'PolygonDrawing',
      action,
      feature: 'polygon_system',
      success: action === 'completed',
      metadata
    });
  }

  /**
   * Track map interactions
   */
  trackMapInteraction(
    action: string,
    coordinates?: [number, number],
    zoom?: number,
    metadata?: Record<string, any>
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

  /**
   * Track error events (integration με ErrorTracker)
   */
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
        errorStack: error.stack?.substring(0, 500) // Truncate για performance
      }
    });
  }

  /**
   * Track performance issues
   */
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
  // PERFORMANCE MONITORING
  // ============================================================================

  private startPerformanceMonitoring(): void {
    if (!this.config.enablePerformanceMonitoring || typeof window === 'undefined') return;

    // Monitor Web Vitals
    this.monitorWebVitals();

    // Monitor memory usage
    setInterval(() => {
      this.monitorMemoryUsage();
    }, 60000); // Every minute

    // Monitor network performance
    this.monitorNetworkPerformance();
  }

  private monitorWebVitals(): void {
    // First Contentful Paint
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
          this.trackEvent('performance_issue', {
            component: 'WebVitals',
            action: 'First Contentful Paint',
            feature: 'performance_monitoring',
            metadata: { value: entry.startTime }
          }, { loadTime: entry.startTime });
        }
      }
    });

    observer.observe({ entryTypes: ['paint'] });

    // Page Load Time
    window.addEventListener('load', () => {
      const pageLoadTime = performance.now();
      this.trackEvent('feature_used', {
        component: 'PageLoad',
        action: 'Page Loaded',
        feature: 'page_navigation',
        duration: pageLoadTime,
        metadata: { loadTime: pageLoadTime }
      }, { loadTime: pageLoadTime });
    });
  }

  private monitorMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryUsage = memory.usedJSHeapSize;
      const threshold = 50 * 1024 * 1024; // 50MB

      if (memoryUsage > threshold) {
        this.trackPerformanceIssue('memoryUsage', memoryUsage, threshold);
      }
    }
  }

  private monitorNetworkPerformance(): void {
    // Monitor fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        const duration = endTime - startTime;

        this.trackEvent('feature_used', {
          component: 'NetworkRequest',
          action: 'API Call',
          feature: 'network_request',
          duration,
          success: response.ok,
          metadata: {
            url: args[0]?.toString(),
            status: response.status,
            duration
          }
        });

        return response;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        this.trackEvent('error_occurred', {
          component: 'NetworkRequest',
          action: 'API Call Failed',
          feature: 'network_request',
          duration,
          success: false,
          metadata: {
            url: args[0]?.toString(),
            error: error instanceof Error ? error.message : String(error),
            duration
          }
        });

        throw error;
      }
    };
  }

  // ============================================================================
  // EVENT PROCESSING
  // ============================================================================

  private flushEvents(): void {
    if (this.eventQueue.length === 0) return;

    try {
      // Convert GeoAlertEvents to format που δέχεται το EventAnalyticsEngine
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

      // Send to analytics engine
      // TODO: Re-enable when EventAnalyticsEngine is implemented
      // analyticsEvents.forEach(event => {
      //   this.analyticsEngine.logEvent(event);
      // });

      // For now, just log to console in dev mode
      if (this.config.debug) {
        console.log('[AnalyticsBridge] Would send events:', analyticsEvents);
      }

      this.log('Events flushed', { count: this.eventQueue.length });

      // Clear queue
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
        return 'warning';
      case 'alert_triggered':
        return 'warning';
      default:
        return 'info';
    }
  }

  private setupEventListeners(): void {
    // Flush events before page unload
    window.addEventListener('beforeunload', () => {
      this.endSession();
      this.flushEvents();
    });

    // Online/offline detection
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushEvents();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Auto-flush interval
    setInterval(() => {
      if (this.isOnline) {
        this.flushEvents();
      }
    }, this.config.flushInterval);
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

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
    return `geo_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[AnalyticsBridge] ${message}`, data || '');
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Get current session information
   */
  getCurrentSession(): UserSession | null {
    return this.currentSession;
  }

  /**
   * Get analytics engine instance
   */
  getAnalyticsEngine(): any { // TODO: Return type to be EventAnalyticsEngine when implemented
    return this.analyticsEngine;
  }

  /**
   * Update user information
   */
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

  /**
   * Clear all analytics data
   */
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
// CONFIGURATION
// ============================================================================

interface AnalyticsBridgeConfig {
  enabled: boolean;
  batchSize: number;
  flushInterval: number;
  enablePerformanceMonitoring: boolean;
  enableUserBehaviorTracking: boolean;
  enableErrorTracking: boolean;
  debug: boolean;
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
// REACT HOOKS
// ============================================================================

/**
 * React hook για analytics tracking
 */
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