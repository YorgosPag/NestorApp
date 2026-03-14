/**
 * =============================================================================
 * ENTERPRISE: CRM CALENDAR PAGE
 * =============================================================================
 *
 * Full-page calendar view with Month/Week/Day/Agenda views.
 * Displays Tasks + Appointments from Firestore.
 *
 * Pattern: PageHeader + UnifiedDashboard + AdvancedFiltersPanel (ADR-229)
 * All values from centralized design system hooks — zero hardcoded values.
 *
 * @route /crm/calendar
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
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
import { CalendarSearchInput } from '@/components/crm/calendar/CalendarSearchInput';
import { CalendarExportButton } from '@/components/crm/calendar/CalendarExportButton';

// Enterprise centralized components
import { PageHeader } from '@/core/headers';
import { PageContainer } from '@/core/containers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  AdvancedFiltersPanel,
  taskFiltersConfig,
  defaultTaskFilters,
  type TaskFilterState,
} from '@/components/core/AdvancedFilters';

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function CrmCalendarPage() {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const { loading: authLoading } = useAuth();

  // Date range state — default to current month ± 1 month buffer
  const [dateRange, setDateRange] = useState(() => ({
    start: startOfMonth(subMonths(new Date(), 1)),
    end: endOfMonth(addMonths(new Date(), 1)),
  }));

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Dashboard toggle state
  const [showDashboard, setShowDashboard] = useState(false);

  // Advanced filters state
  const [filters, setFilters] = useState<TaskFilterState>(defaultTaskFilters);

  // Search-filtered events
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);

  // Sidebar selected date
  const [sidebarDate, setSidebarDate] = useState(new Date());

  // Fetch events
  const { events, loading, stats, refresh } = useCalendarEvents({
    dateRange,
  });

  // Compute today's event count
  const todayCount = useMemo(
    () => events.filter((event) => isToday(event.start)).length,
    [events]
  );

  // Dashboard stats
  const dashboardStats: DashboardStat[] = useMemo(
    () => [
      {
        title: t('calendarPage.stats.totalEvents'),
        value: events.length,
        icon: CalendarDays,
        color: 'blue' as const,
      },
      {
        title: t('tasks.title'),
        value: stats.tasks,
        icon: CheckSquare,
        color: 'purple' as const,
      },
      {
        title: t('calendarPage.eventTypes.appointment'),
        value: stats.appointments,
        icon: Clock,
        color: 'green' as const,
      },
      {
        title: t('calendarPage.today'),
        value: todayCount,
        icon: CalendarClock,
        color: 'orange' as const,
      },
    ],
    [events.length, stats.tasks, stats.appointments, todayCount, t]
  );

  // Handle range change from calendar navigation
  const handleRangeChange = useCallback((range: { start: Date; end: Date }) => {
    setDateRange({
      start: startOfMonth(subMonths(range.start, 1)),
      end: endOfMonth(addMonths(range.end, 1)),
    });
  }, []);

  // Handle event created
  const handleEventCreated = useCallback(() => {
    refresh();
  }, [refresh]);

  // Handle sidebar date selection → navigate main calendar
  const handleSidebarDateSelect = useCallback((date: Date) => {
    setSidebarDate(date);
  }, []);

  // Handle main calendar navigation → sync mini calendar
  const handleMainCalendarDateChange = useCallback((date: Date) => {
    setSidebarDate(date);
  }, []);

  // Handle filtered events from search
  const handleFilteredEvents = useCallback((filtered: CalendarEvent[]) => {
    setFilteredEvents(filtered);
  }, []);

  // Apply advanced filters to events
  const advancedFilteredEvents = useMemo(() => {
    let result = events;

    // Status filter
    if (filters.status && filters.status !== 'all') {
      result = result.filter((e) => e.status === filters.status);
    }

    // Priority filter
    if (filters.priority && filters.priority !== 'all') {
      result = result.filter((e) => e.priority === filters.priority);
    }

    // Type filter
    if (filters.type && filters.type !== 'all') {
      result = result.filter((e) => e.eventType === filters.type);
    }

    // Timeframe filter
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

    // Search term filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter((e) =>
        e.title.toLowerCase().includes(term) ||
        (e.description && e.description.toLowerCase().includes(term))
      );
    }

    return result;
  }, [events, filters]);

  // Search input receives advancedFilteredEvents as base
  const searchBase = advancedFilteredEvents;

  // displayEvents: if search narrowed results further, use those; otherwise use advanced-filtered
  const displayEvents = filteredEvents.length !== searchBase.length
    ? filteredEvents
    : searchBase;

  // Auth loading state
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
        {/* Enterprise PageHeader */}
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

        {/* UnifiedDashboard — toggleable */}
        {showDashboard && (
          <section role="region" aria-label={t('calendarPage.stats.ariaLabel')}>
            <UnifiedDashboard stats={dashboardStats} columns={4} />
          </section>
        )}

        {/* Search + Export toolbar */}
        <nav className="flex items-center justify-between gap-3 px-2" aria-label="Calendar tools">
          <CalendarSearchInput events={searchBase} onFilteredEvents={handleFilteredEvents} />
          <CalendarExportButton />
        </nav>

        {/* AdvancedFiltersPanel — desktop only */}
        <aside className="hidden md:block" role="complementary">
          <AdvancedFiltersPanel
            config={taskFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* Calendar + Sidebar layout */}
        <section className="flex flex-1 gap-4 overflow-auto p-2">
          {/* Mini Calendar Sidebar */}
          <CalendarSidebar
            events={displayEvents}
            selectedDate={sidebarDate}
            onDateSelect={handleSidebarDateSelect}
            displayMonth={sidebarDate}
            onMonthChange={handleSidebarDateSelect}
          />

          {/* Main Calendar */}
          <article className={cn('flex-1', colors.bg.primary, borders.radiusClass.lg)}>
            <CrmCalendar
              events={displayEvents}
              loading={loading}
              onRangeChange={handleRangeChange}
              onEventCreated={handleEventCreated}
              onEventUpdated={handleEventCreated}
              navigateToDate={sidebarDate}
              onDateChange={handleMainCalendarDateChange}
            />
          </article>
        </section>
      </PageContainer>

      {/* Create dialog from header button */}
      <CalendarCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleEventCreated}
      />
    </>
  );
}
