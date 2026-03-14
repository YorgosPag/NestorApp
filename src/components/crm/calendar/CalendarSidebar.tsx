/**
 * Calendar sidebar with mini calendar for date navigation.
 *
 * Navigation arrows are positioned BELOW the month caption
 * (not left/right absolute) to avoid overflow clipping in the narrow sidebar.
 *
 * The `month` prop controls which month is displayed — synced bidirectionally
 * with the main calendar via `onMonthChange`.
 */

'use client';

import { useMemo } from 'react';
import { isSameDay } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import type { CalendarEvent } from '@/types/calendar-event';

interface CalendarSidebarProps {
  events: CalendarEvent[];
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  /** Currently displayed month — synced from main calendar */
  displayMonth: Date;
  /** Called when user navigates months in the mini calendar */
  onMonthChange: (month: Date) => void;
}

export function CalendarSidebar({
  events,
  selectedDate,
  onDateSelect,
  displayMonth,
  onMonthChange,
}: CalendarSidebarProps) {
  // Dates that have events for highlighting
  const eventDates = useMemo(() => {
    const dates: Date[] = [];
    for (const event of events) {
      if (!dates.some((d) => isSameDay(d, event.start))) {
        dates.push(event.start);
      }
    }
    return dates;
  }, [events]);

  const handleSelect = (date: Date) => {
    onDateSelect(date);
  };

  return (
    <aside className="hidden lg:block w-[280px] shrink-0" aria-label="Mini Calendar">
      <Calendar
        mode="single"
        required
        selected={selectedDate}
        onSelect={handleSelect}
        month={displayMonth}
        onMonthChange={onMonthChange}
        showWeekNumber={false}
        modifiers={{ hasEvent: eventDates }}
        modifiersClassNames={{ hasEvent: 'calendar-sidebar-has-event' }}
        className="rounded-lg border"
        classNames={{
          month_caption: "flex justify-center pt-1 relative items-center mb-1",
          nav: "flex items-center justify-center gap-4 pb-2",
          button_previous: "relative left-auto",
          button_next: "relative right-auto",
        }}
      />
    </aside>
  );
}
