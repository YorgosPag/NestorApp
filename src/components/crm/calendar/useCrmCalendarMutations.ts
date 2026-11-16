'use client';

import { useCallback } from 'react';
import type { EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import type { CalendarEvent } from '@/types/calendar-event';
import { isCalendarEventEditable } from '@/services/calendar/calendar-event-editability';
import { updateTaskWithPolicy } from '@/services/crm/crm-mutation-gateway';

interface UseCrmCalendarMutationsOptions {
  onEventUpdated?: () => void;
  notifySuccess: (msg: string) => void;
  notifyError: (msg: string) => void;
  t: (key: string) => string;
}

type MutationArg = EventDropArg | EventResizeDoneArg;
type TaskUpdates = Parameters<typeof updateTaskWithPolicy>[0]['updates'];

export function useCrmCalendarMutations({
  onEventUpdated,
  notifySuccess,
  notifyError,
  t,
}: UseCrmCalendarMutationsOptions) {
  /** Το γεγονός, **μόνο** αν μετακινείται από εδώ (ADR-089 · `isCalendarEventEditable`) — αλλιώς επαναφορά + μήνυμα. */
  const editableEventOf = useCallback((arg: MutationArg): CalendarEvent | null => {
    const ev = arg.event.extendedProps.calendarEvent as CalendarEvent | undefined;
    if (!ev) return null;
    if (isCalendarEventEditable(ev.source)) return ev;
    arg.revert();
    notifyError(t('calendarPage.dragDrop.appointmentReadOnly'));
    return null;
  }, [t, notifyError]);

  /** Η ΜΙΑ εγγραφή της μετακίνησης/αλλαγής διάρκειας — αποτυχία ⇒ το γεγονός γυρίζει πίσω. */
  const persist = useCallback(async (arg: MutationArg, ev: CalendarEvent, updates: TaskUpdates, successKey: string) => {
    try {
      await updateTaskWithPolicy({ taskId: ev.entityId, updates });
      notifySuccess(t(successKey));
      onEventUpdated?.();
    } catch {
      arg.revert();
      notifyError(t('calendarPage.dialog.createError'));
    }
  }, [t, notifySuccess, notifyError, onEventUpdated]);

  const handleEventDrop = useCallback(
    async (arg: EventDropArg) => {
      const ev = editableEventOf(arg);
      const newStart = arg.event.start;
      if (!ev || !newStart) return;
      const newEnd = arg.event.end;
      await persist(arg, ev, {
        dueDate: newStart.toISOString(),
        ...(newEnd && (ev.allDay || newStart.toDateString() !== newEnd.toDateString())
          ? { endDate: newEnd.toISOString() }
          : {}),
      }, 'calendarPage.dragDrop.moved');
    },
    [editableEventOf, persist]
  );

  const handleEventResize = useCallback(
    async (arg: EventResizeDoneArg) => {
      const ev = editableEventOf(arg);
      const newStart = arg.event.start;
      const newEnd = arg.event.end;
      if (!ev || !newStart || !newEnd) return;
      await persist(arg, ev, { dueDate: newStart.toISOString(), endDate: newEnd.toISOString() }, 'calendarPage.dragDrop.resized');
    },
    [editableEventOf, persist]
  );

  return { handleEventDrop, handleEventResize };
}
