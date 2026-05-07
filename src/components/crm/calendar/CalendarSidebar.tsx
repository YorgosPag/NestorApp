/**
 * Calendar sidebar with 2 stacked mini-calendars (Outlook style).
 *
 * - First calendar = displayMonth
 * - Second calendar = displayMonth + 1
 * - Single pair of nav arrows below both calendars navigate together
 * - Selecting a date on either calendar fires onDateSelect
 * - Event dots appear on both calendars
 */

'use client';

import { useMemo, useCallback } from 'react';
import { isSameDay, addMonths, subMonths } from 'date-fns';
import { el as elLocale, enGB as enLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { CalendarEvent } from '@/types/calendar-event';
import '@/lib/design-system';

interface CalendarSidebarProps {
  events: CalendarEvent[];
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  /** Currently displayed month — synced from main calendar */
  displayMonth: Date;
  /** Called when user navigates months in the mini calendar */
  onMonthChange: (month: Date) => void;
}

const HIDDEN_NAV = { nav: 'hidden' } as const;

export function CalendarSidebar({
  events,
  selectedDate,
  onDateSelect,
  displayMonth,
  onMonthChange,
}: CalendarSidebarProps) {
  const { i18n } = useTranslation();
  const iconSizes = useIconSizes();

  const locale = i18n.language === 'el' ? elLocale : enLocale;
  const secondMonth = useMemo(() => addMonths(displayMonth, 1), [displayMonth]);

  const eventDates = useMemo(() => {
    const dates: Date[] = [];
    for (const event of events) {
      if (!dates.some((d) => isSameDay(d, event.start))) {
        dates.push(event.start);
      }
    }
    return dates;
  }, [events]);

  const handlePrevMonth = useCallback(() => {
    onMonthChange(subMonths(displayMonth, 1));
  }, [displayMonth, onMonthChange]);

  const handleNextMonth = useCallback(() => {
    onMonthChange(addMonths(displayMonth, 1));
  }, [displayMonth, onMonthChange]);

  // Second calendar offset: its month = displayMonth+1, so any change needs -1 to sync first calendar
  const handleSecondMonthChange = useCallback((month: Date) => {
    onMonthChange(subMonths(month, 1));
  }, [onMonthChange]);

  return (
    <aside className="hidden lg:flex lg:flex-col w-[280px] shrink-0 gap-2" aria-label="Mini Calendars">
      <Calendar
        mode="single"
        required
        selected={selectedDate}
        onSelect={onDateSelect}
        month={displayMonth}
        onMonthChange={onMonthChange}
        locale={locale}
        showWeekNumber={false}
        modifiers={{ hasEvent: eventDates }}
        modifiersClassNames={{ hasEvent: 'calendar-sidebar-has-event', today: 'mini-cal-today' }}
        className="rounded-lg border"
        classNames={HIDDEN_NAV}
      />

      <Calendar
        mode="single"
        required
        selected={selectedDate}
        onSelect={onDateSelect}
        month={secondMonth}
        onMonthChange={handleSecondMonthChange}
        locale={locale}
        showWeekNumber={false}
        modifiers={{ hasEvent: eventDates }}
        modifiersClassNames={{ hasEvent: 'calendar-sidebar-has-event', today: 'mini-cal-today' }}
        className="rounded-lg border"
        classNames={HIDDEN_NAV}
      />

      {/* Shared navigation arrows — navigate both calendars in sync */}
      <nav className="flex items-center justify-center gap-6" aria-label="Month navigation">
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
