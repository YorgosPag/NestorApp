/**
 * DASHBOARD REACT HOOK
 * Geo-Alert System - Phase 5: Enterprise React Hook για Dashboard
 *
 * Custom React hook για dashboard state management και real-time updates.
 * Implements enterprise React patterns με optimized re-rendering.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DashboardService,
  DashboardMetrics,
  RealTimeEvent,
  DashboardConfig
} from './DashboardService';
import { Alert } from '../detection/AlertDetectionSystem';

// ============================================================================
// HOOK TYPES
// ============================================================================

export interface UseDashboardOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  maxEvents?: number;
  enableRealTimeUpdates?: boolean;
  onError?: (error: Error) => void;
  onMetricsUpdate?: (metrics: DashboardMetrics) => void;
  onNewEvent?: (event: RealTimeEvent) => void;
}

export interface UseDashboardResult {
  // Data
  metrics: DashboardMetrics | null;
  events: RealTimeEvent[];
  recentAlerts: Alert[];

  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;

  // Actions
  refresh: () => Promise<void>;
  clearEvents: () => void;
  toggleAutoRefresh: () => void;
  updateConfig: (config: Partial<DashboardConfig>) => void;

  // State
  autoRefresh: boolean;
  lastUpdated: Date | null;

  // Performance
  performanceMetrics: {
    lastUpdateDuration: number;
    cacheHitRate: number;
    eventsCount: number;
    uptime: number;
  };
}

// ============================================================================
// DASHBOARD HOOK
// ============================================================================

export function useDashboard(options: UseDashboardOptions = {}): UseDashboardResult {
  const {
    autoRefresh: initialAutoRefresh = true,
    refreshInterval = 5000,
    maxEvents = 50,
    enableRealTimeUpdates = true,
    onError,
    onMetricsUpdate,
    onNewEvent
  } = options;

  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [events, setEvents] = useState<RealTimeEvent[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(initialAutoRefresh);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ========================================================================
  // REFS για SERVICE ACCESS και INTERVALS
  // ========================================================================

  const dashboardService = useRef(DashboardService.getInstance());
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // ========================================================================
  // PERFORMANCE TRACKING
  // ========================================================================

  const [performanceMetrics, setPerformanceMetrics] = useState({
    lastUpdateDuration: 0,
    cacheHitRate: 0,
    eventsCount: 0,
    uptime: 0
  });

  // ========================================================================
  // DATA FETCHING FUNCTIONS
  // ========================================================================

  const fetchMetrics = useCallback(async (forceRefresh: boolean = false): Promise<void> => {
    if (!isMountedRef.current) return;

    try {
      if (!isLoading) {
        setIsRefreshing(true);
      }

      const newMetrics = await dashboardService.current.getDashboardMetrics(forceRefresh);

      if (!isMountedRef.current) return;

      setMetrics(newMetrics);
      setError(null);
      setLastUpdated(new Date());

      // Update performance metrics
      const perfMetrics = dashboardService.current.getPerformanceMetrics();
      setPerformanceMetrics(perfMetrics);

      // Callback notification
      onMetricsUpdate?.(newMetrics);

    } catch (err) {
      if (!isMountedRef.current) return;

      const error = err instanceof Error ? err : new Error('Dashboard metrics fetch failed');
      setError(error);
      onError?.(error);

      console.error('Dashboard metrics fetch error:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [isLoading, onError, onMetricsUpdate]);

  const fetchEvents = useCallback((): void => {
    if (!isMountedRef.current) return;

    try {
      const newEvents = dashboardService.current.getRealtimeEvents(maxEvents);

      if (!isMountedRef.current) return;

      // Check για νέα events
      if (events.length > 0 && newEvents.length > 0) {
        const lastEventId = events[0]?.id;
        const newEvent = newEvents.find(e => e.id !== lastEventId);

        if (newEvent && onNewEvent) {
          onNewEvent(newEvent);
        }
      }

      setEvents(newEvents);

    } catch (err) {
      console.error('Dashboard events fetch error:', err);
    }
  }, [events, maxEvents, onNewEvent]);

  const fetchRecentAlerts = useCallback(async (): Promise<void> => {
    try {
      // Mock data για recent alerts (στην πραγματικότητα θα έρχεται από AlertDetectionSystem)
      const mockAlerts: Alert[] = []; // Empty for now

      if (isMountedRef.current) {
        setRecentAlerts(mockAlerts);
      }
    } catch (err) {
      console.error('Recent alerts fetch error:', err);
    }
  }, []);

  // ========================================================================
  // REFRESH FUNCTION
  // ========================================================================

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([
      fetchMetrics(true),
      fetchRecentAlerts()
    ]);
    fetchEvents();
  }, [fetchMetrics, fetchRecentAlerts, fetchEvents]);

  // ========================================================================
  // ACTION HANDLERS
  // ========================================================================

  const clearEvents = useCallback((): void => {
    dashboardService.current.clearEvents();
    fetchEvents();
  }, [fetchEvents]);

  const toggleAutoRefresh = useCallback((): void => {
    setAutoRefresh(prev => !prev);
  }, []);

  const updateConfig = useCallback((config: Partial<DashboardConfig>): void => {
    dashboardService.current.updateConfig(config);

    // Restart intervals αν χρειάζεται
    if (config.refreshInterval && autoRefresh) {
      setAutoRefresh(false);
      setTimeout(() => setAutoRefresh(true), 100);
    }
  }, [autoRefresh]);

  // ========================================================================
  // AUTO-REFRESH SETUP
  // ========================================================================

  useEffect(() => {
    // Clear existing intervals
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    if (eventsIntervalRef.current) {
      clearInterval(eventsIntervalRef.current);
    }

    // Setup new intervals αν auto-refresh είναι enabled
    if (autoRefresh) {
      // Metrics refresh (λιγότερο συχνά)
      refreshIntervalRef.current = setInterval(() => {
        fetchMetrics(false);
      }, refreshInterval);

      // Events refresh (πιο συχνά για real-time feel)
      if (enableRealTimeUpdates) {
        eventsIntervalRef.current = setInterval(() => {
          fetchEvents();
        }, Math.min(refreshInterval / 2, 2000)); // Max 2 seconds
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (eventsIntervalRef.current) {
        clearInterval(eventsIntervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, enableRealTimeUpdates, fetchMetrics, fetchEvents]);

  // ========================================================================
  // INITIAL DATA LOAD
  // ========================================================================

  useEffect(() => {
    // Initial load
    refresh();

    return () => {
      isMountedRef.current = false;
    };
  }, []); // Εκτελείται μόνο μία φορά

  // ========================================================================
  // CLEANUP ON UNMOUNT
  // ========================================================================

  useEffect(() => {
    return () => {
      isMountedRef.current = false;

      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (eventsIntervalRef.current) {
        clearInterval(eventsIntervalRef.current);
      }
    };
  }, []);

  // ========================================================================
  // RETURN HOOK RESULT
  // ========================================================================

  return {
    // Data
    metrics,
    events,
    recentAlerts,

    // Loading states
    isLoading,
    isRefreshing,
    error,

    // Actions
    refresh,
    clearEvents,
    toggleAutoRefresh,
    updateConfig,

    // State
    autoRefresh,
    lastUpdated,

    // Performance
    performanceMetrics
  };
}

// ============================================================================
// SPECIALIZED HOOKS
// ============================================================================

/**
 * Hook για μόνο metrics (χωρίς events)
 */
export function useDashboardMetrics(refreshInterval: number = 10000): {
  metrics: DashboardMetrics | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
} {
  const { metrics, isLoading, error, refresh } = useDashboard({
    refreshInterval,
    enableRealTimeUpdates: false,
    maxEvents: 0
  });

  return { metrics, isLoading, error, refresh };
}

/**
 * Hook για μόνο real-time events
 */
export function useDashboardEvents(maxEvents: number = 20): {
  events: RealTimeEvent[];
  clearEvents: () => void;
  lastUpdated: Date | null;
} {
  const { events, clearEvents, lastUpdated } = useDashboard({
    autoRefresh: false,
    enableRealTimeUpdates: true,
    maxEvents
  });

  return { events, clearEvents, lastUpdated };
}

/**
 * Hook για system status monitoring
 */
export function useSystemStatus(): {
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  uptime: number;
  isLoading: boolean;
  lastCheck: Date | null;
} {
  const { metrics, isLoading, lastUpdated } = useDashboard({
    refreshInterval: 3000, // Πιο συχνά για system status
    enableRealTimeUpdates: false
  });

  return {
    status: metrics?.system.status || 'unknown',
    uptime: metrics?.system.uptime || 0,
    isLoading,
    lastCheck: lastUpdated
  };
}

export default useDashboard;