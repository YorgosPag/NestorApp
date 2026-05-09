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

import CreateTaskModal from '@/components/crm/dashboard/dialogs/CreateTaskModal';
import { TasksTab, type ActivityItem } from '@/components/crm/dashboard/TasksTab';
import { TaskDetailPanel } from './TaskDetailPanel';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn, getSpacingClass } from '@/lib/design-system';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useRealtimeTasks } from '@/services/realtime';
import { PageContainer, ListContainer } from '@/core/containers';
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
import { Button } from '@/components/ui/button';
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
  const { stats, loading: loadingStats } = useRealtimeTasks(!authLoading && isAuthenticated);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [filters, setFilters] = useState<TaskFilterState>(defaultTaskFilters);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDocument[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [leads, setLeads] = useState<Opportunity[]>([]);

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

  const quickFilterOptions = useMemo(() => [
    { key: 'all', label: t('tasks.quickFilters.all'), status: 'all', timeframe: 'all' },
    { key: 'pending', label: t('tasks.quickFilters.pending'), status: 'pending', timeframe: 'all' },
    { key: 'inProgress', label: t('tasks.quickFilters.inProgress'), status: 'in_progress', timeframe: 'all' },
    { key: 'completed', label: t('tasks.quickFilters.completed'), status: 'completed', timeframe: 'all' },
    { key: 'today', label: t('tasks.quickFilters.today'), status: 'all', timeframe: 'today' },
    { key: 'overdue', label: t('tasks.quickFilters.overdue'), status: 'all', timeframe: 'overdue' },
  ], [t]);

  const activeQuickFilter = useMemo(() => {
    if (filters.timeframe === 'today') return 'today';
    if (filters.timeframe === 'overdue') return 'overdue';
    if (filters.status === 'pending') return 'pending';
    if (filters.status === 'in_progress') return 'inProgress';
    if (filters.status === 'completed') return 'completed';
    return 'all';
  }, [filters]);

  const handleQuickFilter = useCallback((qf: { status: string; timeframe: string }) => {
    setFilters(prev => ({ ...prev, status: qf.status, timeframe: qf.timeframe }));
    setSelectedActivity(null);
  }, []);

  const selectedActivityId = selectedActivity ? getActivityId(selectedActivity) : undefined;

  const mobileTitle = selectedActivity?.kind === 'task'
    ? selectedActivity.task.title
    : selectedActivity?.kind === 'appointment'
    ? selectedActivity.title
    : t('tasks.title');

  const handleActivityAction = useCallback(() => setSelectedActivity(null), []);

  return (
    <PageContainer ariaLabel={t('tasks.title')}>
      <PageHeader
        variant="sticky-rounded"
        layout="single-row"
        breadcrumb={<ModuleBreadcrumb />}
        title={{
          icon: Clock,
          title: t('tasks.title'),
          subtitle: t('tasks.description'),
        }}
        actions={{
          showDashboard,
          onDashboardToggle: () => setShowDashboard(!showDashboard),
          addButton: {
            label: t('tasks.newTask'),
            onClick: () => setShowCreateModal(true),
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
          <div className="flex flex-col w-80 min-w-72 border rounded-lg bg-card shadow-sm min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-muted/30">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-semibold text-sm">{t('tasks.title')}</span>
            </div>
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
            <div className="flex gap-1 px-2 py-1.5 flex-wrap border-b bg-muted/10">
              {quickFilterOptions.map(qf => (
                <Button
                  key={qf.key}
                  size="sm"
                  variant={activeQuickFilter === qf.key ? 'default' : 'ghost'}
                  className="h-6 text-xs px-2 rounded-full"
                  onClick={() => handleQuickFilter(qf)}
                >
                  {qf.label}
                </Button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              <TasksTab
                filters={filters}
                appointments={appointments}
                externalLeads={leads}
                selectionMode
                selectedActivityId={selectedActivityId}
                onSelectActivity={setSelectedActivity}
              />
            </div>
          </div>

          {/* Right panel — activity detail */}
          <div className="flex-1 min-h-0 overflow-hidden rounded-lg border bg-card shadow-sm">
            <TaskDetailPanel
              activity={selectedActivity}
              leads={leads}
              onActionCompleted={handleActivityAction}
            />
          </div>
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
          <TasksTab
            filters={filters}
            appointments={appointments}
            externalLeads={leads}
            selectionMode
            selectedActivityId={selectedActivityId}
            onSelectActivity={setSelectedActivity}
          />
        </section>

        <MobileDetailsSlideIn
          isOpen={!!selectedActivity}
          onClose={() => setSelectedActivity(null)}
          title={mobileTitle}
        >
          {selectedActivity && (
            <TaskDetailPanel
              activity={selectedActivity}
              leads={leads}
              onActionCompleted={handleActivityAction}
            />
          )}
        </MobileDetailsSlideIn>
      </ListContainer>

      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTaskCreated={() => { /* real-time subscription auto-updates */ }}
      />
    </PageContainer>
  );
}

export default TasksPageContent;
