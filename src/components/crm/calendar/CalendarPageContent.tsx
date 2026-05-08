'use client';

/**
 * =============================================================================
 * ENTERPRISE: CRM CALENDAR PAGE CONTENT
 * =============================================================================
 * @lazy ADR-294 — Extracted from page.tsx for dynamic import
 *
 * Full-page calendar view with Month/Week/Day/Agenda views.
 * Displays Tasks + Appointments from Firestore.
 *
 * Pattern: PageHeader + UnifiedDashboard + AdvancedFiltersPanel (ADR-229)
 * All values from centralized design system hooks — zero hardcoded values.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { startOfMonth, endOfMonth, addMonths, subMonths, isToday, isBefore, startOfDay, endOfDay, addDays, endOfWeek } from 'date-fns';
import { CalendarDays, Plus, CheckSquare, Clock, CalendarClock } from 'lucide-react';

import { cn } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { Skeleton } from '@/components/ui/skeleton';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import type { CalendarEvent } from '@/types/calendar-event';
import { CrmCalendar } from '@/components/crm/calendar/CrmCalendar';
import { CalendarCreateDialog } from '@/components/crm/calendar/CalendarCreateDialog';
import { CalendarSidebar } from '@/components/crm/calendar/CalendarSidebar';
import { useMiniCalendarSelection } from '@/components/crm/calendar/useMiniCalendarSelection';
import { CalendarSearchInput } from '@/components/crm/calendar/CalendarSearchInput';
import { CalendarExportButton } from '@/components/crm/calendar/CalendarExportButton';

import { PageHeader } from '@/core/headers';
import { PageContainer } from '@/core/containers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  AdvancedFiltersPanel,
  taskFiltersConfig,
  defaultTaskFilters,
  type TaskFilterState,
} from '@/components/core/AdvancedFilters';

export function CalendarPageContent() {
  const { t } = useTranslation(['crm', 'crm-inbox']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const { loading: authLoading } = useAuth();

  const [dateRange, setDateRange] = useState(() => ({
    start: startOfMonth(subMonths(new Date(), 1)),
    end: endOfMonth(addMonths(new Date(), 1)),
  }));

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [filters, setFilters] = useState<TaskFilterState>(defaultTaskFilters);
  const [searchFilteredEvents, setSearchFilteredEvents] = useState<CalendarEvent[] | null>(null);
  const [sidebarDisplayMonth, setSidebarDisplayMonth] = useState(new Date());

  const {
    selectedDays,
    setSelectedDays,
    handleDayMouseDown: handleSidebarDayMouseDown,
    handleDayMouseEnter: handleSidebarDayMouseEnter,
  } = useMiniCalendarSelection();

  const { events, loading, stats, refresh } = useCalendarEvents({
    dateRange,
  });

  const todayCount = useMemo(
    () => events.filter((event) => isToday(event.start)).length,
    [events]
  );

  const dashboardStats: DashboardStat[] = useMemo(
    () => [
      { title: t('calendarPage.stats.totalEvents'), value: events.length, icon: CalendarDays, color: 'blue' as const },
      { title: t('tasks.title'), value: stats.tasks, icon: CheckSquare, color: 'purple' as const },
      { title: t('calendarPage.eventTypes.appointment'), value: stats.appointments, icon: Clock, color: 'green' as const },
      { title: t('calendarPage.today'), value: todayCount, icon: CalendarClock, color: 'orange' as const },
    ],
    [events.length, stats.tasks, stats.appointments, todayCount, t]
  );

  const handleRangeChange = useCallback((range: { start: Date; end: Date }) => {
    setDateRange({
      start: startOfMonth(subMonths(range.start, 1)),
      end: endOfMonth(addMonths(range.end, 1)),
    });
  }, []);

  const handleEventCreated = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleSidebarMonthChange = useCallback((date: Date) => {
    setSidebarDisplayMonth(date);
  }, []);

  // Navigation (prev/next) → sync month + reset multi-day selection to single day
  const handleMainCalendarDateChange = useCallback((date: Date) => {
    setSidebarDisplayMonth(date);
    setSelectedDays([date]);
  }, [setSelectedDays]);

  // Today button → sync both displayed month AND selected day to actual today
  const handleTodayClick = useCallback(() => {
    const today = new Date();
    setSelectedDays([today]);
    setSidebarDisplayMonth(today);
  }, [setSelectedDays]);

  const handleFilteredEvents = useCallback((filtered: CalendarEvent[] | null) => {
    setSearchFilteredEvents(filtered);
  }, []);

  const advancedFilteredEvents = useMemo(() => {
    let result = events;

    if (filters.status && filters.status !== 'all') {
      result = result.filter((e) => e.status === filters.status);
    }
    if (filters.priority && filters.priority !== 'all') {
      result = result.filter((e) => e.priority === filters.priority);
    }
    if (filters.type && filters.type !== 'all') {
      result = result.filter((e) => e.eventType === filters.type);
    }
    if (filters.timeframe && filters.timeframe !== 'all') {
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const tomorrowEnd = endOfDay(addDays(now, 1));
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      switch (filters.timeframe) {
        case 'overdue':
          result = result.filter((e) => isBefore(e.start, todayStart) && e.status !== 'completed');
          break;
        case 'today':
          result = result.filter((e) => e.start >= todayStart && e.start <= todayEnd);
          break;
        case 'tomorrow':
          result = result.filter((e) => e.start > todayEnd && e.start <= tomorrowEnd);
          break;
        case 'week':
          result = result.filter((e) => e.start >= todayStart && e.start <= weekEnd);
          break;
      }
    }
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter((e) =>
        e.title.toLowerCase().includes(term) ||
        (e.description && e.description.toLowerCase().includes(term))
      );
    }

    return result;
  }, [events, filters]);

  const searchBase = advancedFilteredEvents;

  const displayEvents = searchFilteredEvents ?? searchBase;

  if (authLoading) {
    return (
      <PageContainer ariaLabel={t('calendarPage.title')}>
        <Skeleton className={cn(iconSizes.xl, 'w-48 mb-4')} />
        <Skeleton className={cn('h-[600px] w-full', borders.radiusClass.lg)} />
      </PageContainer>
    );
  }

  return (
    <>
      <PageContainer ariaLabel={t('calendarPage.title')}>
        <PageHeader
          variant="sticky-rounded"
          layout="compact"
          spacing="compact"
          breadcrumb={<ModuleBreadcrumb />}
          title={{
            icon: CalendarDays,
            title: t('calendarPage.title'),
            subtitle: t('calendarPage.description'),
          }}
          actions={{
            showDashboard,
            onDashboardToggle: () => setShowDashboard(!showDashboard),
            addButton: {
              label: t('calendarPage.newEvent'),
              onClick: () => setCreateDialogOpen(true),
              icon: Plus,
            },
          }}
        />

        {showDashboard && (
          <section role="region" aria-label={t('calendarPage.stats.ariaLabel')}>
            <UnifiedDashboard stats={dashboardStats} columns={4} />
          </section>
        )}

        <nav className="flex items-center justify-between gap-3 px-2" aria-label="Calendar tools">
          <CalendarSearchInput events={searchBase} onFilteredEvents={handleFilteredEvents} />
          <CalendarExportButton />
        </nav>

        <aside className="hidden md:block" role="complementary">
          <AdvancedFiltersPanel
            config={taskFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        <section className="flex flex-1 gap-4 overflow-auto p-2">
          <CalendarSidebar
            events={displayEvents}
            selectedDays={selectedDays}
            onDayMouseDown={handleSidebarDayMouseDown}
            onDayMouseEnter={handleSidebarDayMouseEnter}
            displayMonth={sidebarDisplayMonth}
            onMonthChange={handleSidebarMonthChange}
          />

          <article className={cn('flex-1', colors.bg.primary, borders.radiusClass.lg)}>
            <CrmCalendar
              events={displayEvents}
              loading={loading}
              onRangeChange={handleRangeChange}
              onEventCreated={handleEventCreated}
              onEventUpdated={handleEventCreated}
              navigateToDate={selectedDays.length === 1 ? selectedDays[0] : undefined}
              onDateChange={handleMainCalendarDateChange}
              onTodayClick={handleTodayClick}
              selectedDays={selectedDays}
            />
          </article>
        </section>
      </PageContainer>

      <CalendarCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleEventCreated}
      />
    </>
  );
}

export default CalendarPageContent;
