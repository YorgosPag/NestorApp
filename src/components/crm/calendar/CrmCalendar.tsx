/**
 * =============================================================================
 * ENTERPRISE: CRM CALENDAR COMPONENT (FullCalendar v6)
 * =============================================================================
 *
 * Wrapper around @fullcalendar/react with enterprise configuration:
 * - Locales (EL/EN)
 * - Color coding per event type
 * - Drag & drop + resize via @fullcalendar/interaction
 * - Multiple views: Month, Week, Day, Agenda (list)
 * - Event detail dialog on click
 * - Create dialog on slot selection
 *
 * @module components/crm/calendar/CrmCalendar
 */

'use client';

import { useState, useCallback, useMemo, useEffect, useRef, type ComponentRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import rrulePlugin from '@fullcalendar/rrule';
import elLocale from '@fullcalendar/core/locales/el';
import enLocale from '@fullcalendar/core/locales/en-gb';
import { useTranslation } from 'react-i18next';
import type {
  EventInput,
  EventClickArg,
  DateSelectArg,
  DatesSetArg,
  EventContentArg,
} from '@fullcalendar/core';
import type { EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';

import type { CalendarEvent } from '@/types/calendar-event';
import { CALENDAR_EVENT_COLORS } from './calendar-event-colors';
import { CalendarEventDialog } from './CalendarEventDialog';
import { CalendarCreateDialog } from './CalendarCreateDialog';
import { CalendarEventTooltip } from './CalendarEventTooltip';
import { useCalendarKeyboardShortcuts } from './useCalendarKeyboardShortcuts';
import { updateTaskWithPolicy } from '@/services/crm/crm-mutation-gateway';
import { TaskEditDialog } from '@/components/crm/dashboard/dialogs/TaskEditDialog';
import type { CrmTask } from '@/types/crm';
import { useNotifications } from '@/providers/NotificationProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCalendarCrossMonthDrag } from './useCalendarCrossMonthDrag';

// ============================================================================
// TYPES
// ============================================================================

interface CrmCalendarProps {
  events: CalendarEvent[];
  loading: boolean;
  onRangeChange: (range: { start: Date; end: Date }) => void;
  onEventCreated?: () => void;
  onNewEvent?: () => void;
  onEventUpdated?: () => void;
  navigateToDate?: Date;
  /** Called when the main calendar date changes (navigation arrows, today button) */
  onDateChange?: (date: Date) => void;
}

type FullCalendarRef = ComponentRef<typeof FullCalendar>;

// ============================================================================
// COMPONENT
// ============================================================================

export function CrmCalendar({
  events,
  loading,
  onRangeChange,
  onEventCreated,
  onNewEvent,
  onEventUpdated,
  navigateToDate,
  onDateChange,
}: CrmCalendarProps) {
  const { t, i18n } = useTranslation(['crm', 'crm-inbox']);
  const { success: notifySuccess, error: notifyError } = useNotifications();
  const calendarRef = useRef<FullCalendarRef>(null);
  const isProgrammaticNav = useRef(false);
  const lastReportedDateRef = useRef<string | null>(null);

  // Cross-month drag
  const {
    isDragging,
    isNearLeft,
    isNearRight,
    containerRef,
    handleEventDidMount,
  } = useCalendarCrossMonthDrag({
    events,
    calendarRef,
    isProgrammaticNav,
    onEventUpdated,
    notifySuccess,
    notifyError,
    movedMessage: t('calendarPage.dragDrop.moved'),
    errorMessage: t('calendarPage.dialog.createError'),
  });

  // Dialog state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState<Date | undefined>();

  // Edit task state
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Map CalendarEvent → FullCalendar EventInput
  const fcEvents: EventInput[] = useMemo(
    () =>
      events.map((e) => {
        const colors = CALENDAR_EVENT_COLORS[e.eventType] ?? CALENDAR_EVENT_COLORS.other;
        return {
          id: e.id,
          title: e.title,
          start: e.start,
          end: e.end,
          allDay: e.allDay,
          editable: e.source !== 'appointment',
          backgroundColor: colors.bg,
          borderColor: colors.border,
          textColor: colors.text,
          extendedProps: { calendarEvent: e },
        };
      }),
    [events]
  );

  // Programmatic navigation when sidebar date changes
  useEffect(() => {
    if (!navigateToDate || !calendarRef.current) return;
    const api = calendarRef.current.getApi();
    if (api.getDate().getTime() === navigateToDate.getTime()) return;
    isProgrammaticNav.current = true;
    api.gotoDate(navigateToDate);
  }, [navigateToDate]);

  // Date range change → fetch events; notify parent only on user navigation
  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      onRangeChange({ start: arg.start, end: arg.end });
      const currentIso = arg.view.currentStart.toISOString();
      if (isProgrammaticNav.current) {
        isProgrammaticNav.current = false;
        lastReportedDateRef.current = currentIso;
        return;
      }
      if (lastReportedDateRef.current === currentIso) return;
      lastReportedDateRef.current = currentIso;
      onDateChange?.(arg.view.currentStart);
    },
    [onRangeChange, onDateChange]
  );

  // Event click → open detail dialog
  const handleEventClick = useCallback((arg: EventClickArg) => {
    const ev = arg.event.extendedProps.calendarEvent as CalendarEvent | undefined;
    if (!ev) return;
    setSelectedEvent(ev);
    setEventDialogOpen(true);
  }, []);

  // Date select → open create dialog
  const handleSelect = useCallback((arg: DateSelectArg) => {
    setCreateInitialDate(arg.start);
    setCreateDialogOpen(true);
  }, []);

  // Edit task handler
  const handleEditTask = useCallback((event: CalendarEvent) => {
    const taskForEdit: CrmTask = {
      id: event.entityId,
      title: event.title,
      type: event.eventType as CrmTask['type'],
      status: event.status as CrmTask['status'],
      priority: (event.priority ?? 'medium') as CrmTask['priority'],
      dueDate: event.start.toISOString(),
      description: event.description ?? null,
      assignedTo: event.assignedTo ?? '',
      contactId: event.contactId ?? null,
      projectId: event.projectId ?? null,
      createdAt: event.start.toISOString(),
      updatedAt: event.start.toISOString(),
    };
    setEditingTask(taskForEdit);
    setEditDialogOpen(true);
  }, []);

  // Drag-drop handler — update task date in Firestore
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

  // Resize handler — same logic as drop
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

  // Custom event content with tooltip
  const renderEventContent = useCallback((arg: EventContentArg) => {
    const ev = arg.event.extendedProps.calendarEvent as CalendarEvent | undefined;
    if (!ev) {
      return <span className="block truncate text-xs leading-tight px-1">{arg.event.title}</span>;
    }
    return <CalendarEventTooltip event={ev} timeText={arg.timeText} />;
  }, []);

  // Keyboard shortcut handlers
  const goToView = useCallback((view: string) => {
    calendarRef.current?.getApi().changeView(view);
  }, []);
  const handleNewEvent = useCallback(() => {
    if (onNewEvent) {
      onNewEvent();
    } else {
      setCreateInitialDate(new Date());
      setCreateDialogOpen(true);
    }
  }, [onNewEvent]);

  useCalendarKeyboardShortcuts({
    onMonth: useCallback(() => goToView('dayGridMonth'), [goToView]),
    onWeek: useCallback(() => goToView('timeGridWeek'), [goToView]),
    onDay: useCallback(() => goToView('timeGridDay'), [goToView]),
    onAgenda: useCallback(() => goToView('listWeek'), [goToView]),
    onToday: useCallback(() => calendarRef.current?.getApi().today(), []),
    onBack: useCallback(() => calendarRef.current?.getApi().prev(), []),
    onNext: useCallback(() => calendarRef.current?.getApi().next(), []),
    onNewEvent: handleNewEvent,
  });

  return (
    <>
      <TooltipProvider>
        <section
          ref={containerRef}
          className="fc-wrapper relative"
          aria-label={t('calendarPage.title')}
          aria-busy={loading}
        >
          {isDragging && (
            <div
              aria-hidden="true"
              className={`fc-cross-month-zone fc-cross-month-zone--prev${isNearLeft ? ' fc-cross-month-zone--active' : ''}`}
            >
              ←
            </div>
          )}
          {isDragging && (
            <div
              aria-hidden="true"
              className={`fc-cross-month-zone fc-cross-month-zone--next${isNearRight ? ' fc-cross-month-zone--active' : ''}`}
            >
              →
            </div>
          )}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, rrulePlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            }}
            buttonText={{
              today: t('calendarPage.today'),
              month: t('calendarPage.views.month'),
              week: t('calendarPage.views.week'),
              day: t('calendarPage.views.day'),
              list: t('calendarPage.views.agenda'),
            }}
            events={fcEvents}
            editable
            selectable
            selectMirror
            dayMaxEvents
            firstDay={1}
            weekNumbers
            weekNumberFormat={{ week: 'numeric' }}
            nowIndicator
            height="auto"
            locale={i18n.language === 'el' ? elLocale : enLocale}
            datesSet={handleDatesSet}
            eventClick={handleEventClick}
            select={handleSelect}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventDidMount={handleEventDidMount}
            eventContent={renderEventContent}
            eventDisplay="block"
          />
        </section>
      </TooltipProvider>

      <CalendarEventDialog
        event={selectedEvent}
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        onEditTask={handleEditTask}
      />

      <CalendarCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        initialDate={createInitialDate}
        onCreated={onEventCreated}
      />

      {editingTask && (
        <TaskEditDialog
          task={editingTask}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onUpdated={onEventUpdated}
        />
      )}
    </>
  );
}
