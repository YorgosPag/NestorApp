/**
 * =============================================================================
 * ENTERPRISE: Cross-Month Drag Hook for CRM Calendar
 * =============================================================================
 *
 * Enables dragging events to prev/next month by dropping outside the calendar.
 *
 * Strategy (DOM-based, no FullCalendar callback dependency):
 *   - eventDidMount → marks each event el with data-calendar-event-id
 *   - document mousemove → detects drag start via .fc-event-dragging mirror
 *     (FullCalendar appends this fixed-position clone to <body>)
 *   - document mouseup → if drop is outside container X-range → cross-month
 *
 * Why not FullCalendar eventDragStart/eventDragStop props:
 *   eventDragStop fires AFTER FullCalendar reverts the event internally,
 *   and FullCalendar mirrors are fixed on body — outside container scope.
 *
 * @module components/crm/calendar/useCalendarCrossMonthDrag
 */

'use client';

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type MutableRefObject,
  type ComponentRef,
} from 'react';
import type FullCalendar from '@fullcalendar/react';
import type { EventMountArg } from '@fullcalendar/core';
import { updateTaskWithPolicy } from '@/services/crm/crm-mutation-gateway';
import type { CalendarEvent } from '@/types/calendar-event';

// ============================================================================
// TYPES
// ============================================================================

interface UseCalendarCrossMonthDragProps {
  events: CalendarEvent[];
  calendarRef: MutableRefObject<ComponentRef<typeof FullCalendar> | null>;
  isProgrammaticNav: MutableRefObject<boolean>;
  onEventUpdated?: () => void;
  notifySuccess: (msg: string) => void;
  notifyError: (msg: string) => void;
  movedMessage: string;
  errorMessage: string;
}

export interface UseCalendarCrossMonthDragReturn {
  isDragging: boolean;
  isNearLeft: boolean;
  isNearRight: boolean;
  containerRef: MutableRefObject<HTMLElement | null>;
  handleEventDidMount: (arg: EventMountArg) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EDGE_ZONE_PX = 80;
const FC_DRAG_MIRROR_SELECTOR = '.fc-event-dragging';

// ============================================================================
// HELPERS
// ============================================================================

function addMonths(date: Date, delta: -1 | 1): Date {
  let month = date.getMonth() + delta;
  let year = date.getFullYear();
  if (month < 0) { month = 11; year--; }
  if (month > 11) { month = 0; year++; }
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(
    year,
    month,
    Math.min(date.getDate(), lastDay),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useCalendarCrossMonthDrag({
  events,
  calendarRef,
  isProgrammaticNav,
  onEventUpdated,
  notifySuccess,
  notifyError,
  movedMessage,
  errorMessage,
}: UseCalendarCrossMonthDragProps): UseCalendarCrossMonthDragReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [isNearLeft, setIsNearLeft] = useState(false);
  const [isNearRight, setIsNearRight] = useState(false);

  const containerRef = useRef<HTMLElement | null>(null);
  const isDraggingRef = useRef(false);
  const draggedEventIdRef = useRef<string | null>(null);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navDirectionRef = useRef<-1 | 1 | null>(null);

  // Keep latest callbacks in refs to avoid stale closures
  const eventsRef = useRef(events);
  const onEventUpdatedRef = useRef(onEventUpdated);
  const notifySuccessRef = useRef(notifySuccess);
  const notifyErrorRef = useRef(notifyError);
  const movedMessageRef = useRef(movedMessage);
  const errorMessageRef = useRef(errorMessage);

  useEffect(() => {
    eventsRef.current = events;
    onEventUpdatedRef.current = onEventUpdated;
    notifySuccessRef.current = notifySuccess;
    notifyErrorRef.current = notifyError;
    movedMessageRef.current = movedMessage;
    errorMessageRef.current = errorMessage;
  });

  useEffect(() => {
    const clearNavTimer = () => {
      if (navTimerRef.current !== null) {
        clearTimeout(navTimerRef.current);
        navTimerRef.current = null;
      }
      navDirectionRef.current = null;
    };

    const startNavTimer = (dir: -1 | 1) => {
      if (navDirectionRef.current === dir) return;
      clearNavTimer();
      navDirectionRef.current = dir;
      const tick = () => {
        if (navDirectionRef.current !== dir) return;
        const api = calendarRef.current?.getApi();
        if (api) { if (dir === -1) api.prev(); else api.next(); }
        navTimerRef.current = setTimeout(tick, 1500);
      };
      navTimerRef.current = setTimeout(tick, 1500);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) {
        const mirrorEl = document.querySelector(FC_DRAG_MIRROR_SELECTOR);
        if (!mirrorEl) return;
        const eventId = mirrorEl.getAttribute('data-calendar-event-id');
        draggedEventIdRef.current = eventId;
        isDraggingRef.current = true;
        setIsDragging(true);
      }
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const nearLeft = e.clientX < rect.left + EDGE_ZONE_PX;
      const nearRight = e.clientX > rect.right - EDGE_ZONE_PX;
      setIsNearLeft(nearLeft);
      setIsNearRight(nearRight);
      if (nearLeft) startNavTimer(-1);
      else if (nearRight) startNavTimer(1);
      else clearNavTimer();
    };

    const handleMouseUp = async (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      clearNavTimer();
      const container = containerRef.current;
      isDraggingRef.current = false;
      setIsDragging(false);
      setIsNearLeft(false);
      setIsNearRight(false);

      const eventId = draggedEventIdRef.current;
      draggedEventIdRef.current = null;

      if (!container || !eventId) return;
      const rect = container.getBoundingClientRect();
      const isOutsideLeft = e.clientX < rect.left;
      const isOutsideRight = e.clientX > rect.right;
      if (!isOutsideLeft && !isOutsideRight) return;

      const ev = eventsRef.current.find((ce) => ce.id === eventId);
      if (!ev || ev.source === 'appointment') return;

      const newDate = addMonths(ev.start, isOutsideLeft ? -1 : 1);

      try {
        await updateTaskWithPolicy({
          taskId: ev.entityId,
          updates: { dueDate: newDate.toISOString() },
        });
        notifySuccessRef.current(movedMessageRef.current);
        onEventUpdatedRef.current?.();
        isProgrammaticNav.current = true;
        calendarRef.current?.getApi().gotoDate(newDate);
      } catch {
        notifyErrorRef.current(errorMessageRef.current);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      clearNavTimer();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [calendarRef, isProgrammaticNav]);

  // Mark each event DOM element with its CalendarEvent ID so mirror clone carries it
  const handleEventDidMount = useCallback((arg: EventMountArg) => {
    const ev = arg.event.extendedProps.calendarEvent as CalendarEvent | undefined;
    if (ev) arg.el.setAttribute('data-calendar-event-id', ev.id);
  }, []);

  return {
    isDragging,
    isNearLeft,
    isNearRight,
    containerRef,
    handleEventDidMount,
  };
}
