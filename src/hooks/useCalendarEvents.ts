/**
 * =============================================================================
 * ENTERPRISE: useCalendarEvents Hook
 * =============================================================================
 *
 * Custom React hook for fetching and managing calendar events.
 * Follows the auth-guard pattern from `app/crm/tasks/page.tsx`.
 *
 * @module hooks/useCalendarEvents
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/contexts/AuthContext';
import { getCalendarEvents } from '@/services/calendar/CalendarEventService';
import type { CalendarEvent, CalendarEventType } from '@/types/calendar-event';

// ============================================================================
// TYPES
// ============================================================================

export interface UseCalendarEventsOptions {
  /** Date range to fetch */
  dateRange: { start: Date; end: Date };
  /** Filter by user ID (optional) */
  userId?: string;
  /** Filter by event types (optional — if empty, show all) */
  eventTypes?: CalendarEventType[];
}

export interface CalendarEventStats {
  total: number;
  tasks: number;
  appointments: number;
}

export interface UseCalendarEventsReturn {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  stats: CalendarEventStats;
}

// ============================================================================
// HOOK
// ============================================================================

export function useCalendarEvents(options: UseCalendarEventsOptions): UseCalendarEventsReturn {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getCalendarEvents(
        options.dateRange.start,
        options.dateRange.end,
        options.userId
      );

      // Filter by event types if specified
      const filtered = options.eventTypes && options.eventTypes.length > 0
        ? result.filter((e) => options.eventTypes!.includes(e.eventType))
        : result;

      setEvents(filtered);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load calendar events';
      setError(message);
      console.error('[useCalendarEvents] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [
    isAuthenticated,
    options.dateRange.start.getTime(),
    options.dateRange.end.getTime(),
    options.userId,
    // Serialize eventTypes for dependency comparison
    options.eventTypes?.join(','),
  ]);

  // Fetch when authenticated and dependencies change
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchEvents();
    }
  }, [authLoading, isAuthenticated, fetchEvents]);

  // Compute stats
  const stats = useMemo<CalendarEventStats>(() => ({
    total: events.length,
    tasks: events.filter((e) => e.source === 'task').length,
    appointments: events.filter((e) => e.source === 'appointment').length,
  }), [events]);

  return {
    events,
    loading,
    error,
    refresh: fetchEvents,
    stats,
  };
}
