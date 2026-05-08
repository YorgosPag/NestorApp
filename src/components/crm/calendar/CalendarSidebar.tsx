/**
 * Calendar sidebar with 2 stacked mini-calendars (Outlook style).
 *
 * - Drag on days → select consecutive range (max 14)
 * - Ctrl+click → toggle non-consecutive days (max 14)
 * - Uses container-level event delegation on data-day attribute (more reliable than DayButton override)
 */

'use client';

import { useMemo, useCallback, useRef } from 'react';
import { isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
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
  const lastHoveredIsoRef = useRef<string | null>(null);

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

  // Container-level mousedown: read data-day attribute set by DayPicker on each <td>
  const handleContainerMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const dayEl = (e.target as Element).closest('[data-day]') as HTMLElement | null;
    if (!dayEl) return;
    const isoDate = dayEl.dataset.day;
    if (!isoDate) return;
    e.preventDefault();
    lastHoveredIsoRef.current = isoDate;
    onDayMouseDown(parseISO(isoDate), e);
  }, [onDayMouseDown]);

  // Container-level mousemove: fires reliably during drag (button held), unlike onMouseEnter on children
  const handleContainerMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!(e.buttons & 1)) return;
    const dayEl = (e.target as Element).closest('[data-day]') as HTMLElement | null;
    if (!dayEl) return;
    const isoDate = dayEl.dataset.day;
    if (!isoDate || isoDate === lastHoveredIsoRef.current) return;
    lastHoveredIsoRef.current = isoDate;
    onDayMouseEnter(parseISO(isoDate));
  }, [onDayMouseEnter]);

  return (
    <aside
      className="hidden lg:flex lg:flex-col w-[280px] shrink-0 gap-2 select-none"
      aria-label="Mini Calendars"
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleContainerMouseMove}
    >
      <Calendar
        mode="multiple"
        selected={selectedDays}
        onSelect={() => {}}
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
        mode="multiple"
        selected={selectedDays}
        onSelect={() => {}}
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
