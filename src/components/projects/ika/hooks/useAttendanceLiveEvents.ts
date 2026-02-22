'use client';

/**
 * =============================================================================
 * useAttendanceLiveEvents — Real-Time Attendance Events via Firestore onSnapshot
 * =============================================================================
 *
 * Live subscription to attendance events for a project.
 * Uses Firestore onSnapshot instead of getDocs for instant updates.
 *
 * When a worker scans a QR code and checks in, the event appears immediately
 * on the admin dashboard without manual refresh.
 *
 * @module components/projects/ika/hooks/useAttendanceLiveEvents
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { AttendanceEvent, AttendanceEventType, AttendanceMethod } from '../contracts';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useAttendanceLiveEvents');

// =============================================================================
// TYPES
// =============================================================================

interface UseAttendanceLiveEventsReturn {
  /** All events for the selected date (ordered by timestamp asc) */
  events: AttendanceEvent[];
  /** The most recently arrived event (for toast alerts) */
  latestEvent: AttendanceEvent | null;
  /** Whether the listener is active */
  isLive: boolean;
  /** Loading state (initial fetch) */
  isLoading: boolean;
  /** Error message */
  error: string | null;
}

// =============================================================================
// HELPERS
// =============================================================================

function toStartOfDay(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function toEndOfDay(date: Date): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function parseEventDoc(docId: string, data: Record<string, unknown>): AttendanceEvent {
  return {
    id: docId,
    projectId: data.projectId as string,
    contactId: data.contactId as string,
    eventType: data.eventType as AttendanceEventType,
    method: data.method as AttendanceMethod,
    timestamp: data.timestamp as string,
    coordinates: (data.coordinates as { lat: number; lng: number } | null) ?? null,
    deviceId: (data.deviceId as string | null) ?? null,
    recordedBy: data.recordedBy as string,
    notes: (data.notes as string | null) ?? null,
    approvedBy: (data.approvedBy as string | null) ?? null,
    createdAt: data.createdAt as string,
  };
}

// =============================================================================
// HOOK
// =============================================================================

export function useAttendanceLiveEvents(
  projectId: string | undefined,
  selectedDate: Date
): UseAttendanceLiveEventsReturn {
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [latestEvent, setLatestEvent] = useState<AttendanceEvent | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track previous event count to detect new arrivals
  const prevEventCountRef = useRef(0);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (!projectId) {
      setEvents([]);
      setLatestEvent(null);
      setIsLive(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    isInitialLoadRef.current = true;

    const startOfDayStr = toStartOfDay(selectedDate);
    const endOfDayStr = toEndOfDay(selectedDate);

    const eventsQuery = query(
      collection(db, COLLECTIONS.ATTENDANCE_EVENTS),
      where('projectId', '==', projectId),
      where('timestamp', '>=', startOfDayStr),
      where('timestamp', '<=', endOfDayStr),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const fetchedEvents: AttendanceEvent[] = snapshot.docs.map((doc) =>
          parseEventDoc(doc.id, doc.data() as Record<string, unknown>)
        );

        setEvents(fetchedEvents);
        setIsLive(true);
        setIsLoading(false);
        setError(null);

        // Detect newly arrived events (after initial load)
        if (!isInitialLoadRef.current && fetchedEvents.length > prevEventCountRef.current) {
          const newest = fetchedEvents[fetchedEvents.length - 1];
          setLatestEvent(newest);
        }

        prevEventCountRef.current = fetchedEvents.length;
        isInitialLoadRef.current = false;
      },
      (err) => {
        const message = err instanceof Error ? err.message : 'Real-time listener failed';
        setError(message);
        setIsLive(false);
        setIsLoading(false);
        logger.error('onSnapshot error', { error: message, projectId });
      }
    );

    return () => {
      unsubscribe();
      setIsLive(false);
    };
  }, [projectId, selectedDate]);

  return { events, latestEvent, isLive, isLoading, error };
}
