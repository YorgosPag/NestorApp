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
  addDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { AttendanceEvent, AttendanceEventType, AttendanceMethod } from '../contracts';

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
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Fetch events for the selected date
  useEffect(() => {
    let mounted = true;

    async function fetchEvents() {
      if (!projectId) {
        setEvents([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const startOfDayStr = toStartOfDay(selectedDate);
        const endOfDayStr = toEndOfDay(selectedDate);

        const eventsQuery = query(
          collection(db, COLLECTIONS.ATTENDANCE_EVENTS),
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

        setEvents(fetchedEvents);
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load attendance events';
          setError(message);
          console.error('[useAttendanceEvents] Error:', message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchEvents();
    return () => { mounted = false; };
  }, [projectId, selectedDate, refreshKey]);

  // Create a new immutable attendance event
  const addEvent = useCallback(async (params: CreateAttendanceEventParams): Promise<boolean> => {
    try {
      const now = new Date().toISOString();

      const eventData = {
        projectId: params.projectId,
        contactId: params.contactId,
        eventType: params.eventType,
        method: params.method,
        timestamp: now,
        coordinates: params.coordinates ?? null,
        deviceId: params.deviceId ?? null,
        recordedBy: params.recordedBy,
        notes: params.notes ?? null,
        approvedBy: params.approvedBy ?? null,
        createdAt: now,
      };

      await addDoc(collection(db, COLLECTIONS.ATTENDANCE_EVENTS), eventData);

      // Refresh the events list
      refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create attendance event';
      setError(message);
      console.error('[useAttendanceEvents] Create error:', message);
      return false;
    }
  }, [refetch]);

  return { events, isLoading, error, addEvent, refetch };
}
