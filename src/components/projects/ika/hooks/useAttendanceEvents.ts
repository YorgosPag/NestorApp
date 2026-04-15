'use client';

/**
 * =============================================================================
 * useAttendanceEvents — Hook for querying & creating attendance events
 * =============================================================================
 *
 * Reads attendance events from Firestore for a project within a date range.
 * Creates new events (append-only — NO update or delete).
 *
 * @module components/projects/ika/hooks/useAttendanceEvents
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 2)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { useCompanyId } from '@/hooks/useCompanyId';
import type { AttendanceEvent, AttendanceEventType, AttendanceMethod } from '../contracts';
import { createModuleLogger } from '@/lib/telemetry';
import { createStaleCache } from '@/lib/stale-cache';
import { createAttendanceEventWithPolicy } from '@/services/ika/ika-mutation-gateway';

const logger = createModuleLogger('useAttendanceEvents');

// ADR-300: Module-level cache — keyed by projectId+date, survives re-navigation
const attendanceEventsCache = createStaleCache<AttendanceEvent[]>('project-attendance-events');

/** Parameters for creating a new attendance event */
export interface CreateAttendanceEventParams {
  projectId: string;
  contactId: string;
  eventType: AttendanceEventType;
  method: AttendanceMethod;
  recordedBy: string;
  notes?: string;
  coordinates?: { lat: number; lng: number };
  deviceId?: string;
  approvedBy?: string;
}

interface UseAttendanceEventsReturn {
  /** Attendance events for the selected date range */
  events: AttendanceEvent[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Create a new immutable attendance event */
  addEvent: (params: CreateAttendanceEventParams) => Promise<boolean>;
  /** Force refetch events */
  refetch: () => void;
}

/**
 * Converts a Date to start-of-day ISO string (00:00:00.000)
 */
function toStartOfDay(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Converts a Date to end-of-day ISO string (23:59:59.999)
 */
function toEndOfDay(date: Date): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/**
 * Hook for querying and creating attendance events.
 *
 * Events are immutable — once created, they cannot be modified or deleted.
 * This is a legal requirement for construction site compliance (ΣΕΠΕ).
 */
export function useAttendanceEvents(
  projectId: string | undefined,
  selectedDate: Date
): UseAttendanceEventsReturn {
  const companyId = useCompanyId()?.companyId;
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const dateCacheKey = `${projectId ?? 'none'}-${selectedDate.toISOString().substring(0, 10)}`;
  const [events, setEvents] = useState<AttendanceEvent[]>(attendanceEventsCache.get(dateCacheKey) ?? []);
  const [isLoading, setIsLoading] = useState(!attendanceEventsCache.hasLoaded(dateCacheKey));
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Fetch events for the selected date
  useEffect(() => {
    let mounted = true;

    async function fetchEvents() {
      if (!projectId || !companyId) {
        setEvents([]);
        setIsLoading(false);
        return;
      }

      const key = `${projectId}-${selectedDate.toISOString().substring(0, 10)}`;
      try {
        // ADR-300: Only show spinner on first load — not on re-navigation
        if (!attendanceEventsCache.hasLoaded(key)) setIsLoading(true);
        setError(null);

        const startOfDayStr = toStartOfDay(selectedDate);
        const endOfDayStr = toEndOfDay(selectedDate);

        const eventsQuery = query(
          collection(db, COLLECTIONS.ATTENDANCE_EVENTS),
          where('companyId', '==', companyId),
          where('projectId', '==', projectId),
          where('timestamp', '>=', startOfDayStr),
          where('timestamp', '<=', endOfDayStr),
          orderBy('timestamp', 'asc')
        );

        const snapshot = await getDocs(eventsQuery);

        if (!mounted) return;

        const fetchedEvents: AttendanceEvent[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            projectId: data.projectId as string,
            contactId: data.contactId as string,
            eventType: data.eventType as AttendanceEventType,
            method: data.method as AttendanceMethod,
            timestamp: data.timestamp as string,
            coordinates: data.coordinates ?? null,
            deviceId: data.deviceId ?? null,
            recordedBy: data.recordedBy as string,
            notes: data.notes ?? null,
            approvedBy: data.approvedBy ?? null,
            createdAt: data.createdAt as string,
          };
        });

        // ADR-300: Write to module-level cache so next remount skips spinner
        attendanceEventsCache.set(fetchedEvents, key);
        setEvents(fetchedEvents);
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load attendance events';
          setError(message);
          logger.error('Failed to load attendance events', { error: message });
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchEvents();
    return () => { mounted = false; };
  }, [projectId, companyId, selectedDate, refreshKey]);

  // Create a new immutable attendance event (server-side — SPEC-255C)
  const addEvent = useCallback(async (params: CreateAttendanceEventParams): Promise<boolean> => {
    try {
      await createAttendanceEventWithPolicy({
        projectId: params.projectId,
        contactId: params.contactId,
        eventType: params.eventType,
        method: params.method,
        notes: params.notes,
        coordinates: params.coordinates,
        deviceId: params.deviceId,
        approvedBy: params.approvedBy,
      });

      refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create attendance event';
      setError(message);
      logger.error('Failed to create attendance event', { error: message });
      return false;
    }
  }, [refetch]);

  return { events, isLoading, error, addEvent, refetch };
}
