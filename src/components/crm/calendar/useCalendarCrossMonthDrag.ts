/**
 * =============================================================================
 * ENTERPRISE: Cross-Month Drag Hook for CRM Calendar
 * =============================================================================
 *
 * Enables dragging calendar events outside the current month view to move
 * them to the previous or next month. Uses FullCalendar's eventDragStop
 * (fires even for out-of-grid drops) + mouse position detection.
 *
 * Strategy:
 *   - eventDragStart → track the dragged event + start mouse position tracking
 *   - eventDragStop  → if drop was outside container bounds, compute target
 *                      month, update Firestore, navigate calendar there
 *   - Normal in-grid drops are handled by FullCalendar's eventDrop (unaffected)
 *
 * @module components/crm/calendar/useCalendarCrossMonthDrag
 */

'use client';

import { useState, useCallback, useRef, useEffect, type MutableRefObject, type ComponentRef } from 'react';
import type FullCalendar from '@fullcalendar/react';
import type { EventDragStartArg, EventDragStopArg } from '@fullcalendar/core';
import { updateTaskWithPolicy } from '@/services/crm/crm-mutation-gateway';
import type { CalendarEvent } from '@/types/calendar-event';

// ============================================================================
// TYPES
// ============================================================================

interface UseCalendarCrossMonthDragProps {
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
  handleEventDragStart: (arg: EventDragStartArg) => void;
  handleEventDragStop: (arg: EventDragStopArg) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EDGE_ZONE_PX = 80;

// ============================================================================
// HELPERS
// ============================================================================

function clampToMonth(original: Date, year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(
    year,
    month,
    Math.min(original.getDate(), lastDay),
    original.getHours(),
    original.getMinutes(),
    original.getSeconds()
  );
}

function addMonths(date: Date, delta: -1 | 1): Date {
  let month = date.getMonth() + delta;
  let year = date.getFullYear();
  if (month < 0) { month = 11; year--; }
  if (month > 11) { month = 0; year++; }
  return clampToMonth(date, year, month);
}

// ============================================================================
// HOOK
// ============================================================================

export function useCalendarCrossMonthDrag({
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

  const draggedEventRef = useRef<CalendarEvent | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const cleanupMouseMoveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { cleanupMouseMoveRef.current?.(); };
  }, []);

  const handleEventDragStart = useCallback((arg: EventDragStartArg) => {
    const ev = arg.event.extendedProps.calendarEvent as CalendarEvent | undefined;
    if (!ev || ev.source === 'appointment') return;

    draggedEventRef.current = ev;
    setIsDragging(true);

    const onMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setIsNearLeft(e.clientX < rect.left + EDGE_ZONE_PX);
      setIsNearRight(e.clientX > rect.right - EDGE_ZONE_PX);
    };

    document.addEventListener('mousemove', onMouseMove);
    cleanupMouseMoveRef.current = () => document.removeEventListener('mousemove', onMouseMove);
  }, []);

  const handleEventDragStop = useCallback(
    async (arg: EventDragStopArg) => {
      const ev = draggedEventRef.current;
      draggedEventRef.current = null;
      setIsDragging(false);
      setIsNearLeft(false);
      setIsNearRight(false);
      cleanupMouseMoveRef.current?.();
      cleanupMouseMoveRef.current = null;

      if (!ev || ev.source === 'appointment') return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (arg.jsEvent as MouseEvent).clientX;
      const isOutsideLeft = x < rect.left;
      const isOutsideRight = x > rect.right;
      if (!isOutsideLeft && !isOutsideRight) return;

      const newDate = addMonths(ev.start, isOutsideLeft ? -1 : 1);

      try {
        await updateTaskWithPolicy({
          taskId: ev.entityId,
          updates: { dueDate: newDate.toISOString() },
        });
        notifySuccess(movedMessage);
        onEventUpdated?.();
        isProgrammaticNav.current = true;
        calendarRef.current?.getApi().gotoDate(newDate);
      } catch {
        notifyError(errorMessage);
      }
    },
    [calendarRef, isProgrammaticNav, onEventUpdated, notifySuccess, notifyError, movedMessage, errorMessage]
  );

  return { isDragging, isNearLeft, isNearRight, containerRef, handleEventDragStart, handleEventDragStop };
}
