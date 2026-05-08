/**
 * Calendar sidebar with 2 stacked mini-calendars (Outlook style).
 *
 * - First calendar = displayMonth
 * - Second calendar = displayMonth + 1
 * - Single pair of nav arrows below both calendars navigate together
 * - Drag on days → select consecutive range
 * - Ctrl+click → toggle non-consecutive days
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
  selectedDays: Date[];
  onDayMouseDown: (day: Date, e: React.MouseEvent) => void;
  onDayMouseEnter: (day: Date) => void;
  displayMonth: Date;
  onMonthChange: (month: Date) => void;
}

const HIDDEN_NAV = { nav: 'hidden' } as const;

export function CalendarSidebar({
  events,
  selectedDays,
  onDayMouseDown,
  onDayMouseEnter,
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

  const handleSecondMonthChange = useCallback((month: Date) => {
    onMonthChange(subMonths(month, 1));
  }, [onMonthChange]);

  // Intercept DayPicker's default click handler; handle selection via mouseDown
  const DayButtonComponent = useCallback(
    ({
      day,
      modifiers: _m,
      className,
      children,
      onClick: _suppressed,
      ...rest
    }: {
      day: { date: Date };
      modifiers: Record<string, boolean>;
      className?: string;
      children?: React.ReactNode;
      onClick?: React.MouseEventHandler<HTMLButtonElement>;
    } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) => (
      <button
        {...rest}
        className={className}
        onMouseDown={(e) => { e.preventDefault(); onDayMouseDown(day.date, e); }}
        onMouseEnter={() => onDayMouseEnter(day.date)}
      >
        {children}
      </button>
    ),
    [onDayMouseDown, onDayMouseEnter]
  );

  const calendarComponents = useMemo(
    () => ({ DayButton: DayButtonComponent }),
    [DayButtonComponent]
  );

  return (
    <aside className="hidden lg:flex lg:flex-col w-[280px] shrink-0 gap-2" aria-label="Mini Calendars">
      <Calendar
        mode="multiple"
        selected={selectedDays}
        month={displayMonth}
        onMonthChange={onMonthChange}
        locale={locale}
        showWeekNumber={false}
        modifiers={{ hasEvent: eventDates }}
        modifiersClassNames={{ hasEvent: 'calendar-sidebar-has-event', today: 'mini-cal-today' }}
        className="rounded-lg border"
        classNames={HIDDEN_NAV}
        components={calendarComponents}
      />

      <Calendar
        mode="multiple"
        selected={selectedDays}
        month={secondMonth}
        onMonthChange={handleSecondMonthChange}
        locale={locale}
        showWeekNumber={false}
        modifiers={{ hasEvent: eventDates }}
        modifiersClassNames={{ hasEvent: 'calendar-sidebar-has-event', today: 'mini-cal-today' }}
        className="rounded-lg border"
        classNames={HIDDEN_NAV}
        components={calendarComponents}
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
