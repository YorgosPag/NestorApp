/**
 * Calendar sidebar with mini calendar for date navigation.
 *
 * Navigation arrows are rendered BELOW the calendar grid as custom buttons,
 * because the built-in nav arrows overflow in the narrow 280px sidebar.
 *
 * The `month` prop controls which month is displayed — synced bidirectionally
 * with the main calendar via `onMonthChange`.
 */

'use client';

import { useMemo, useCallback } from 'react';
import { isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
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
  const iconSizes = useIconSizes();

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

  const handlePrevMonth = useCallback(() => {
    onMonthChange(subMonths(displayMonth, 1));
  }, [displayMonth, onMonthChange]);

  const handleNextMonth = useCallback(() => {
    onMonthChange(addMonths(displayMonth, 1));
  }, [displayMonth, onMonthChange]);

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
          nav: "hidden",
        }}
      />
      {/* Navigation arrows BELOW the calendar */}
      <nav className="flex items-center justify-center gap-6 pt-2" aria-label="Month navigation">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
          <ChevronLeft className={iconSizes.sm} />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
          <ChevronRight className={iconSizes.sm} />
        </Button>
      </nav>
    </aside>
  );
}
