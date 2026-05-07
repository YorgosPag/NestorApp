/**
 * =============================================================================
 * ENTERPRISE: CRM CALENDAR COMPONENT
 * =============================================================================
 *
 * Wrapper around react-big-calendar with enterprise configuration:
 * - date-fns localizer (EL/EN)
 * - Color coding per event type
 * - Event detail dialog on click
 * - Create dialog on slot selection
 *
 * All values from centralized design system — zero hardcoded values.
 * Note: eventStyleGetter uses raw design token CSS values because
 * react-big-calendar requires CSSProperties objects (not Tailwind classes).
 *
 * @module components/crm/calendar/CrmCalendar
 */

'use client';

import { useState, useCallback, useMemo, useEffect, useRef, type CSSProperties, type ComponentType } from 'react';
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  Views,
  type View,
  type EventPropGetter,
  type SlotInfo,
} from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, isBefore, startOfDay, isSameDay, getISOWeek, subMonths, addMonths } from 'date-fns';
import { el, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

import type { CalendarEvent } from '@/types/calendar-event';
import type { DateCellWrapperProps, EventProps } from 'react-big-calendar';
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

// Enterprise design tokens — raw CSS values for CSSProperties usage
import { coreBorderRadius, borderWidth } from '@/styles/design-tokens';
import { typography as typographyTokens } from '@/styles/design-tokens';
import { spacing as spacingTokens } from '@/styles/design-tokens/core/spacing';

// ============================================================================
// DAY CELL HELPERS — weekend/past detection
// ============================================================================

/** Creates dayPropGetter with event-aware dot indicators */
function createDayPropGetter(events: CalendarEvent[], today: Date) {
  return function dayPropGetter(date: Date) {
    const classes: string[] = [];
    if (isBefore(date, today)) classes.push('rbc-calendar-past');
    return { className: classes.join(' ') };
  };
}

/** Adds CSS class to date cell numbers for past date styling */
function DateCellWrapper({ children, value, today }: DateCellWrapperProps & { today: Date }) {
  if (isBefore(value, today)) {
    return (
      <div className="rbc-calendar-past-date">
        {children}
      </div>
    );
  }
  return <>{children}</>;
}

// ============================================================================
// LOCALIZER SETUP
// ============================================================================

const locales = {
  el,
  en: enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

// ============================================================================
// DnD CALENDAR WRAPPER
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- withDragAndDrop has no exported type
const DnDCalendar = withDragAndDrop<CalendarEvent>(BigCalendar as React.ComponentType<any>);

interface DnDEventArgs {
  event: CalendarEvent;
  start: string | Date;
  end: string | Date;
}

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

  // Dialog state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState<Date | undefined>();

  // Edit task state
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // View state
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Track programmatic navigation to prevent feedback loop
  const isProgrammaticNav = useRef(false);

  // Navigate when sidebar date changes
  useEffect(() => {
    if (navigateToDate) {
      isProgrammaticNav.current = true;
      setCurrentDate(navigateToDate);
    }
  }, [navigateToDate]);

  // i18n messages for react-big-calendar
  // i18n.language as dependency ensures re-compute on language switch
  const messages = useMemo(() => ({
    today: t('calendarPage.today'),
    previous: '‹',
    next: '›',
    month: t('calendarPage.views.month'),
    week: t('calendarPage.views.week'),
    day: t('calendarPage.views.day'),
    agenda: t('calendarPage.views.agenda'),
    noEventsInRange: t('calendarPage.noEvents'),
  }), [t, i18n.language]);

  // Color coding via eventStyleGetter (official react-big-calendar API)
  // Uses raw design token CSS values because react-big-calendar requires CSSProperties
  const eventStyleGetter: EventPropGetter<CalendarEvent> = useCallback(
    (event: CalendarEvent) => {
      const colors = CALENDAR_EVENT_COLORS[event.eventType] ?? CALENDAR_EVENT_COLORS['other'];
      const style: CSSProperties = {
        backgroundColor: colors.bg,
        borderLeft: `${borderWidth.thick} solid ${colors.border}`,
        color: colors.text,
        borderRadius: coreBorderRadius.sm,
        padding: `${spacingTokens.xs} ${spacingTokens.sm}`,
        fontSize: typographyTokens.fontSize.xs,
      };
      return { style };
    },
    []
  );

  // Handle event click
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setEventDialogOpen(true);
  }, []);

  // Handle edit task from event dialog
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

  // Handle slot selection (create new event)
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setCreateInitialDate(slotInfo.start);
    setCreateDialogOpen(true);
  }, []);

  // Handle range change (when user navigates months/weeks)
  const handleRangeChange = useCallback(
    (range: Date[] | { start: Date; end: Date }) => {
      if (Array.isArray(range)) {
        onRangeChange({
          start: range[0],
          end: range[range.length - 1],
        });
      } else {
        onRangeChange(range);
      }
    },
    [onRangeChange]
  );

  // Today's date — recalculated on each render to stay current
  const today = startOfDay(new Date());

  // Event-aware dayPropGetter — memoized to avoid re-renders
  const dayPropGetter = useMemo(() => createDayPropGetter(events, today), [events, today]);

  // Current locale
  const culture = i18n.language === 'el' ? 'el' : 'en';

  // Week number formats for month view headers
  // react-big-calendar supports weekGutterFormat at runtime but @types doesn't include it
  const formats = useMemo((): Record<string, (date: Date) => string> => ({
    weekGutterFormat: (date: Date) => `W${getISOWeek(date)}`,
  }), []);

  // Keyboard shortcuts
  const handleNavigateToday = useCallback(() => setCurrentDate(new Date()), []);
  const handleNavigateBack = useCallback(() => {
    setCurrentDate((prev) => {
      if (currentView === Views.MONTH) return subMonths(prev, 1);
      if (currentView === Views.WEEK) return new Date(prev.getTime() - 7 * 24 * 60 * 60 * 1000);
      return new Date(prev.getTime() - 24 * 60 * 60 * 1000);
    });
  }, [currentView]);
  const handleNavigateNext = useCallback(() => {
    setCurrentDate((prev) => {
      if (currentView === Views.MONTH) return addMonths(prev, 1);
      if (currentView === Views.WEEK) return new Date(prev.getTime() + 7 * 24 * 60 * 60 * 1000);
      return new Date(prev.getTime() + 24 * 60 * 60 * 1000);
    });
  }, [currentView]);
  const handleNewEvent = useCallback(() => {
    if (onNewEvent) {
      onNewEvent();
    } else {
      setCreateInitialDate(new Date());
      setCreateDialogOpen(true);
    }
  }, [onNewEvent]);

  useCalendarKeyboardShortcuts({
    onViewChange: setCurrentView,
    onNavigateToday: handleNavigateToday,
    onNavigateBack: handleNavigateBack,
    onNavigateNext: handleNavigateNext,
    onNewEvent: handleNewEvent,
  });

  // Drag & Drop handler — update task date in Firestore
  const handleEventDrop = useCallback(
    async ({ event, start, end }: DnDEventArgs) => {
      if (event.source === 'appointment') {
        notifyError(t('calendarPage.dragDrop.appointmentReadOnly'));
        return;
      }
      try {
        const newStart = start instanceof Date ? start : new Date(start);
        const newEnd = end instanceof Date ? end : new Date(end);
        await updateTaskWithPolicy({
          taskId: event.entityId,
          updates: {
            dueDate: newStart.toISOString(),
            ...(event.allDay || newStart.toDateString() !== newEnd.toDateString()
              ? { endDate: newEnd.toISOString() }
              : {}),
          },
        });
        notifySuccess(t('calendarPage.dragDrop.moved'));
        onEventUpdated?.();
      } catch {
        notifyError(t('calendarPage.dialog.createError'));
      }
    },
    [t, notifySuccess, notifyError, onEventUpdated]
  );

  // Resize handler — same logic as drop
  const handleEventResize = useCallback(
    async ({ event, start, end }: DnDEventArgs) => {
      if (event.source === 'appointment') {
        notifyError(t('calendarPage.dragDrop.appointmentReadOnly'));
        return;
      }
      try {
        const newStart = start instanceof Date ? start : new Date(start);
        const newEnd = end instanceof Date ? end : new Date(end);
        await updateTaskWithPolicy({
          taskId: event.entityId,
          updates: {
            dueDate: newStart.toISOString(),
            endDate: newEnd.toISOString(),
          },
        });
        notifySuccess(t('calendarPage.dragDrop.resized'));
        onEventUpdated?.();
      } catch {
        notifyError(t('calendarPage.dialog.createError'));
      }
    },
    [t, notifySuccess, notifyError, onEventUpdated]
  );

  return (
    <>
      <TooltipProvider>
        <section
          className="rbc-wrapper"
          aria-label={t('calendarPage.title')}
          aria-busy={loading}
        >
          <DnDCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            titleAccessor="title"
            view={currentView}
            onView={setCurrentView}
            date={currentDate}
            onNavigate={(date: Date) => {
              if (!isProgrammaticNav.current) {
                setCurrentDate(date);
                onDateChange?.(date);
              }
              isProgrammaticNav.current = false;
            }}
            onRangeChange={handleRangeChange}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            selectable
            resizable
            eventPropGetter={eventStyleGetter}
            dayPropGetter={dayPropGetter}
            components={{
              dateCellWrapper: ((props) => <DateCellWrapper {...props} today={today} />) as ComponentType<DateCellWrapperProps>,
              event: CalendarEventTooltip as ComponentType<EventProps<CalendarEvent>>,
            }}
            messages={messages}
            culture={culture}
            views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
            popup
            formats={formats}
            className="min-h-[600px]"
          />
        </section>
      </TooltipProvider>

      {/* Event Detail Dialog */}
      <CalendarEventDialog
        event={selectedEvent}
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        onEditTask={handleEditTask}
      />

      {/* Create Event Dialog */}
      <CalendarCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        initialDate={createInitialDate}
        onCreated={onEventCreated}
      />

      {/* Edit Task Dialog */}
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
