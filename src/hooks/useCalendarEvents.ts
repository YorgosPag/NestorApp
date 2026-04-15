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
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

// ADR-300: Module-level cache survives React unmount/remount (navigation)
// Keyed by dateRange+userId+eventTypes so different views don't collide
const calendarEventsCache = createStaleCache<CalendarEvent[]>('calendar-events');

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

  // ADR-300: Cache key encodes all params so different views don't collide
  const cacheKey = `${options.dateRange.start.getTime()}-${options.dateRange.end.getTime()}-${options.userId ?? 'all'}-${options.eventTypes?.join(',') ?? 'all'}`;

  const { data, loading, error, refetch } = useAsyncData({
    fetcher: async () => {
      const result = await getCalendarEvents(
        options.dateRange.start,
        options.dateRange.end,
        options.userId
      );

      // Filter by event types if specified
      const filtered = options.eventTypes && options.eventTypes.length > 0
        ? result.filter((e) => options.eventTypes!.includes(e.eventType))
        : result;

      // ADR-300: Write to module-level cache so next remount skips spinner
      calendarEventsCache.set(filtered, cacheKey);
      return filtered;
    },
    deps: [
      options.dateRange.start.getTime(),
      options.dateRange.end.getTime(),
      options.userId,
      options.eventTypes?.join(','),
    ],
    enabled: !authLoading && isAuthenticated,
    initialData: calendarEventsCache.get(cacheKey),
    silentInitialFetch: calendarEventsCache.hasLoaded(cacheKey),
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
