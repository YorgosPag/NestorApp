/**
 * =============================================================================
 * ENTERPRISE: useCalendarEvents Hook
 * =============================================================================
 *
 * Custom React hook for fetching and managing calendar events.
 * Uses centralized useAsyncData hook (ADR-223).
 *
 * @module hooks/useCalendarEvents
 */

'use client';

import { useMemo, useRef } from 'react';
import { useAuth } from '@/auth/contexts/AuthContext';
import { getCalendarEvents } from '@/services/calendar/CalendarEventService';
import type { CalendarEvent, CalendarEventType } from '@/types/calendar-event';
import { useAsyncData } from '@/hooks/useAsyncData';

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

  const { data, loading, error, refetch } = useAsyncData({
    fetcher: async () => {
      const result = await getCalendarEvents(
        options.dateRange.start,
        options.dateRange.end,
        options.userId
      );

      // Filter by event types if specified
      if (options.eventTypes && options.eventTypes.length > 0) {
        return result.filter((e) => options.eventTypes!.includes(e.eventType));
      }
      return result;
    },
    deps: [
      options.dateRange.start.getTime(),
      options.dateRange.end.getTime(),
      options.userId,
      options.eventTypes?.join(','),
    ],
    enabled: !authLoading && isAuthenticated,
  });

  // Stabilize events reference — avoid creating new [] on every render when data is null
  const EMPTY_EVENTS: CalendarEvent[] = useRef<CalendarEvent[]>([]).current;
  const events = data ?? EMPTY_EVENTS;

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
    refresh: refetch,
    stats,
  };
}
