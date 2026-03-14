/**
 * Calendar sidebar with mini calendar for date navigation.
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
}

export function CalendarSidebar({ events, selectedDate, onDateSelect }: CalendarSidebarProps) {
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
        showWeekNumber={false}
        modifiers={{ hasEvent: eventDates }}
        modifiersClassNames={{ hasEvent: 'calendar-sidebar-has-event' }}
        className="rounded-lg border"
      />
    </aside>
  );
}
