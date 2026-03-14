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
import { startOfMonth, endOfMonth, addMonths, subMonths, isToday } from 'date-fns';
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
import { CrmCalendar } from '@/components/crm/calendar/CrmCalendar';
import { CalendarCreateDialog } from '@/components/crm/calendar/CalendarCreateDialog';

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

        {/* AdvancedFiltersPanel — desktop only */}
        <aside className="hidden md:block" role="complementary">
          <AdvancedFiltersPanel
            config={taskFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* Calendar */}
        <section className="flex-1 overflow-auto p-2">
          <article className={cn(colors.bg.primary, borders.radiusClass.lg)}>
            <CrmCalendar
              events={events}
              loading={loading}
              onRangeChange={handleRangeChange}
              onEventCreated={handleEventCreated}
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
