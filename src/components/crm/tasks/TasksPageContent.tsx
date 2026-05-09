'use client';

/**
 * CRM Tasks Page Content
 * @lazy ADR-294 — Extracted from page.tsx for dynamic import
 * @enterprise Split layout: left activity list + right detail panel (2026-05-09)
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Clock,
  Plus,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { subMonths, addMonths } from 'date-fns';

import { TasksTab, type ActivityItem } from '@/components/crm/dashboard/TasksTab';
import { TaskDetailPanel } from './TaskDetailPanel';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn, getSpacingClass } from '@/lib/design-system';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useRealtimeTasks } from '@/services/realtime';
import { PageContainer, ListContainer, EntityListColumn } from '@/core/containers';
import { PageHeader } from '@/core/headers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters/AdvancedFiltersPanel';
import { taskFiltersConfig, defaultTaskFilters } from '@/components/core/AdvancedFilters/configs';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import type { TaskFilterState } from '@/components/core/AdvancedFilters/configs';
import { AppointmentsRepository } from '@/services/calendar/AppointmentsRepository';
import type { AppointmentDocument } from '@/types/appointment';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { SearchInput } from '@/components/ui/search';
import { TaskQuickFilters } from '@/components/shared/TypeQuickFilters';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { CompactToolbar, tasksConfig } from '@/components/core/CompactToolbar';
import { getOpportunitiesClient } from '@/services/opportunities-client.service';
import type { Opportunity } from '@/types/crm';

const appointmentsRepo = new AppointmentsRepository();

function getActivityId(activity: ActivityItem): string {
  return activity.kind === 'task'
    ? (activity.task.id ?? '')
    : `appt_${activity.appt.id}`;
}

export function TasksPageContent() {
  const { t } = useTranslation(['crm', 'crm-inbox']);
  const layout = useLayoutClasses();
  const sectionSpacing = getSpacingClass('m', 'md', 'b');
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { tasks: realtimeTasks, stats, loading: loadingStats } = useRealtimeTasks(!authLoading && isAuthenticated);
  const [isCreating, setIsCreating] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [filters, setFilters] = useState<TaskFilterState>(defaultTaskFilters);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDocument[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [leads, setLeads] = useState<Opportunity[]>([]);
  const [activityCount, setActivityCount] = useState(0);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    const start = subMonths(new Date(), 6);
    const end = addMonths(new Date(), 6);
    appointmentsRepo.getByDateRange(start, end)
      .then(setAppointments)
      .catch(() => {});
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    getOpportunitiesClient()
      .then(setLeads)
      .catch(() => {});
  }, [authLoading, isAuthenticated]);

  const dashboardStats = useMemo<DashboardStat[]>(() => ([
    { title: t('tasks.stats.total'), value: loadingStats ? '...' : stats.total, icon: Clock, color: 'blue', description: t('tasks.stats.totalDesc') },
    { title: t('tasks.stats.pending'), value: loadingStats ? '...' : stats.pending, icon: AlertTriangle, color: 'yellow', description: t('tasks.stats.pendingDesc') },
    { title: t('tasks.stats.overdue'), value: loadingStats ? '...' : stats.overdue, icon: AlertTriangle, color: 'red', description: t('tasks.stats.overdueDesc') },
    { title: t('tasks.stats.completed'), value: loadingStats ? '...' : stats.completed, icon: CheckCircle, color: 'green', description: t('tasks.stats.completedDesc') },
    { title: t('tasks.stats.today'), value: loadingStats ? '...' : stats.dueToday, icon: Calendar, color: 'purple', description: t('tasks.stats.todayDesc') },
    { title: t('tasks.stats.thisWeek'), value: loadingStats ? '...' : stats.dueThisWeek, icon: TrendingUp, color: 'indigo', description: t('tasks.stats.thisWeekDesc') },
  ]), [stats, loadingStats, t]);

  const handleCardClick = useCallback((_stat: DashboardStat, index: number) => {
    if (activeCardIndex === index) {
      setActiveCardIndex(null);
      setFilters(defaultTaskFilters);
      return;
    }
    setActiveCardIndex(index);
    switch (index) {
      case 0: setFilters(defaultTaskFilters); break;
      case 1: setFilters({ ...defaultTaskFilters, status: 'pending' }); break;
      case 2: setFilters({ ...defaultTaskFilters, timeframe: 'overdue' }); break;
      case 3: setFilters({ ...defaultTaskFilters, status: 'completed' }); break;
      case 4: setFilters({ ...defaultTaskFilters, timeframe: 'today' }); break;
      case 5: setFilters({ ...defaultTaskFilters, timeframe: 'week' }); break;
    }
  }, [activeCardIndex]);

  const selectedQuickFilterTypes = useMemo<string[]>(() => {
    if (filters.timeframe === 'today') return ['today'];
    if (filters.timeframe === 'overdue') return ['overdue'];
    if (filters.status === 'pending') return ['pending'];
    if (filters.status === 'in_progress') return ['in_progress'];
    if (filters.status === 'completed') return ['completed'];
    return [];
  }, [filters]);

  const handleQuickFilterChange = useCallback((types: string[]) => {
    setSelectedActivity(null);
    const key = types[0] ?? 'all';
    switch (key) {
      case 'pending':     setFilters({ ...defaultTaskFilters, status: 'pending' }); break;
      case 'in_progress': setFilters({ ...defaultTaskFilters, status: 'in_progress' }); break;
      case 'completed':   setFilters({ ...defaultTaskFilters, status: 'completed' }); break;
      case 'today':       setFilters({ ...defaultTaskFilters, timeframe: 'today' }); break;
      case 'overdue':     setFilters({ ...defaultTaskFilters, timeframe: 'overdue' }); break;
      default:            setFilters(defaultTaskFilters);
    }
  }, []);

  const selectedActivityId = selectedActivity ? getActivityId(selectedActivity) : undefined;

  const mobileTitle = selectedActivity?.kind === 'task'
    ? selectedActivity.task.title
    : selectedActivity?.kind === 'appointment'
    ? selectedActivity.title
    : t('tasks.title');

  const handleActivityAction = useCallback(() => {
    setSelectedActivity(null);
    setIsCreating(false);
  }, []);

  return (
    <PageContainer ariaLabel={t('tasks.title')}>
      <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        breadcrumb={<ModuleBreadcrumb />}
        title={{
          icon: Clock,
          title: t('tasks.title'),
        }}
        actions={{
          showDashboard,
          onDashboardToggle: () => setShowDashboard(!showDashboard),
          addButton: {
            label: t('tasks.newTask'),
            onClick: () => { setIsCreating(true); setSelectedActivity(null); },
            icon: Plus,
          },
        }}
      />

      {showDashboard && (
        <section className={cn('w-full overflow-hidden', sectionSpacing)} aria-label={t('tasks.stats.total')}>
          <UnifiedDashboard
            stats={dashboardStats}
            columns={6}
            onCardClick={handleCardClick}
            className={cn(layout.dashboardPadding, 'overflow-hidden')}
          />
        </section>
      )}

      <AdvancedFiltersPanel
        config={taskFiltersConfig}
        filters={filters}
        onFiltersChange={setFilters}
        defaultFilters={defaultTaskFilters}
      />

      <ListContainer>
        {/* Desktop split layout */}
        <section
          className="hidden md:flex flex-1 gap-2 min-h-0 min-w-0 overflow-hidden"
          role="region"
          aria-label={t('tasks.title')}
        >
          {/* Left panel — activity list */}
          <EntityListColumn hasBorder aria-label={t('tasks.title')}>
            <GenericListHeader
              icon={Clock}
              entityName={t('tasks.title')}
              itemCount={activityCount}
              hideSearch
            />
            <CompactToolbar
              config={tasksConfig}
              onNewItem={() => { setIsCreating(true); setSelectedActivity(null); }}
              onRefresh={() => { setFilters(defaultTaskFilters); setActiveCardIndex(null); }}
            />
            <div className="px-2 py-1.5 border-b">
              <SearchInput
                value={filters.searchTerm}
                onChange={(v) => setFilters(prev => ({ ...prev, searchTerm: v }))}
                placeholder={t('tasks.searchPlaceholder')}
                debounceMs={200}
                showClearButton
                className="h-7 text-xs"
              />
            </div>
            <TaskQuickFilters
              selectedTypes={selectedQuickFilterTypes}
              onTypeChange={handleQuickFilterChange}
              compact
            />
            <div className="flex-1 overflow-y-auto">
              <TasksTab
                filters={filters}
                appointments={appointments}
                externalLeads={leads}
                externalTasks={realtimeTasks}
                selectionMode
                selectedActivityId={selectedActivityId}
                onSelectActivity={setSelectedActivity}
                onCountChange={setActivityCount}
              />
            </div>
          </EntityListColumn>

          {/* Right panel — activity detail */}
          <TaskDetailPanel
            activity={selectedActivity}
            leads={leads}
            onActionCompleted={handleActivityAction}
            onCreateTask={() => { setIsCreating(true); setSelectedActivity(null); }}
            isCreating={isCreating}
            onCreateCancel={() => setIsCreating(false)}
          />
        </section>

        {/* Mobile — full width list */}
        <section
          className="md:hidden w-full flex flex-col min-h-0"
          role="region"
          aria-label={t('tasks.title')}
        >
          <div className="px-2 py-2">
            <SearchInput
              value={filters.searchTerm}
              onChange={(v) => setFilters(prev => ({ ...prev, searchTerm: v }))}
              placeholder={t('tasks.searchPlaceholder')}
              debounceMs={200}
              showClearButton
              className="h-8 text-sm"
            />
          </div>
          <TaskQuickFilters
            selectedTypes={selectedQuickFilterTypes}
            onTypeChange={handleQuickFilterChange}
            compact
          />
          <TasksTab
            filters={filters}
            appointments={appointments}
            externalLeads={leads}
            externalTasks={realtimeTasks}
            selectionMode
            selectedActivityId={selectedActivityId}
            onSelectActivity={setSelectedActivity}
            onCountChange={setActivityCount}
          />
        </section>

        <MobileDetailsSlideIn
          isOpen={!!selectedActivity || isCreating}
          onClose={() => { setSelectedActivity(null); setIsCreating(false); }}
          title={isCreating ? t('tasks.newTask') : mobileTitle}
        >
          {(selectedActivity ?? isCreating) && (
            <TaskDetailPanel
              activity={selectedActivity}
              leads={leads}
              onActionCompleted={handleActivityAction}
              isCreating={isCreating}
              onCreateCancel={() => setIsCreating(false)}
            />
          )}
        </MobileDetailsSlideIn>
      </ListContainer>

    </PageContainer>
  );
}

export default TasksPageContent;
