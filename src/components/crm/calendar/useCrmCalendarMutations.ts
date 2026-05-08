'use client';

import { useCallback } from 'react';
import type { EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import type { CalendarEvent } from '@/types/calendar-event';
import { updateTaskWithPolicy } from '@/services/crm/crm-mutation-gateway';

interface UseCrmCalendarMutationsOptions {
  onEventUpdated?: () => void;
  notifySuccess: (msg: string) => void;
  notifyError: (msg: string) => void;
  t: (key: string) => string;
}

export function useCrmCalendarMutations({
  onEventUpdated,
  notifySuccess,
  notifyError,
  t,
}: UseCrmCalendarMutationsOptions) {
  const handleEventDrop = useCallback(
    async (arg: EventDropArg) => {
      const ev = arg.event.extendedProps.calendarEvent as CalendarEvent | undefined;
      if (!ev) return;
      if (ev.source === 'appointment') {
        arg.revert();
        notifyError(t('calendarPage.dragDrop.appointmentReadOnly'));
        return;
      }
      try {
        const newStart = arg.event.start;
        const newEnd = arg.event.end;
        if (!newStart) return;
        await updateTaskWithPolicy({
          taskId: ev.entityId,
          updates: {
            dueDate: newStart.toISOString(),
            ...(newEnd && (ev.allDay || newStart.toDateString() !== newEnd.toDateString())
              ? { endDate: newEnd.toISOString() }
              : {}),
          },
        });
        notifySuccess(t('calendarPage.dragDrop.moved'));
        onEventUpdated?.();
      } catch {
        arg.revert();
        notifyError(t('calendarPage.dialog.createError'));
      }
    },
    [t, notifySuccess, notifyError, onEventUpdated]
  );

  const handleEventResize = useCallback(
    async (arg: EventResizeDoneArg) => {
      const ev = arg.event.extendedProps.calendarEvent as CalendarEvent | undefined;
      if (!ev) return;
      if (ev.source === 'appointment') {
        arg.revert();
        notifyError(t('calendarPage.dragDrop.appointmentReadOnly'));
        return;
      }
      try {
        const newStart = arg.event.start;
        const newEnd = arg.event.end;
        if (!newStart || !newEnd) return;
        await updateTaskWithPolicy({
          taskId: ev.entityId,
          updates: {
            dueDate: newStart.toISOString(),
            endDate: newEnd.toISOString(),
          },
        });
        notifySuccess(t('calendarPage.dragDrop.resized'));
        onEventUpdated?.();
      } catch {
        arg.revert();
        notifyError(t('calendarPage.dialog.createError'));
      }
    },
    [t, notifySuccess, notifyError, onEventUpdated]
  );

  return { handleEventDrop, handleEventResize };
}
