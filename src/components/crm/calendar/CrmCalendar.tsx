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

import { useState, useCallback, useMemo, type CSSProperties } from 'react';
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  Views,
  type View,
  type EventPropGetter,
  type SlotInfo,
} from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { el, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import type { CalendarEvent } from '@/types/calendar-event';
import { CALENDAR_EVENT_COLORS } from './calendar-event-colors';
import { CalendarEventDialog } from './CalendarEventDialog';
import { CalendarCreateDialog } from './CalendarCreateDialog';

// Enterprise design tokens — raw CSS values for CSSProperties usage
import { coreBorderRadius, borderWidth } from '@/styles/design-tokens';
import { typography as typographyTokens } from '@/styles/design-tokens';
import { spacing as spacingTokens } from '@/styles/design-tokens/core/spacing';

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
// TYPES
// ============================================================================

interface CrmCalendarProps {
  events: CalendarEvent[];
  loading: boolean;
  onRangeChange: (range: { start: Date; end: Date }) => void;
  onEventCreated?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CrmCalendar({
  events,
  loading,
  onRangeChange,
  onEventCreated,
}: CrmCalendarProps) {
  const { t, i18n } = useTranslation('crm');

  // Dialog state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState<Date | undefined>();

  // View state
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);
  const [currentDate, setCurrentDate] = useState(new Date());

  // i18n messages for react-big-calendar
  const messages = useMemo(() => ({
    today: t('calendarPage.today'),
    previous: '‹',
    next: '›',
    month: t('calendarPage.views.month'),
    week: t('calendarPage.views.week'),
    day: t('calendarPage.views.day'),
    agenda: t('calendarPage.views.agenda'),
    noEventsInRange: t('calendarPage.noEvents'),
  }), [t]);

  // Color coding via eventStyleGetter (official react-big-calendar API)
  // Uses raw design token CSS values because react-big-calendar requires CSSProperties
  const eventStyleGetter: EventPropGetter<CalendarEvent> = useCallback(
    (event: CalendarEvent) => {
      const colors = CALENDAR_EVENT_COLORS[event.eventType];
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

  // Current locale
  const culture = i18n.language === 'el' ? 'el' : 'en';

  return (
    <>
      <section
        className="rbc-wrapper"
        aria-label={t('calendarPage.title')}
        aria-busy={loading}
      >
        <BigCalendar<CalendarEvent>
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          titleAccessor="title"
          view={currentView}
          onView={setCurrentView}
          date={currentDate}
          onNavigate={setCurrentDate}
          onRangeChange={handleRangeChange}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          eventPropGetter={eventStyleGetter}
          messages={messages}
          culture={culture}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          popup
          className="min-h-[600px]"
        />
      </section>

      {/* Event Detail Dialog */}
      <CalendarEventDialog
        event={selectedEvent}
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
      />

      {/* Create Event Dialog */}
      <CalendarCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        initialDate={createInitialDate}
        onCreated={onEventCreated}
      />
    </>
  );
}
