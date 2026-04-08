'use client';

/**
 * CRM Tasks Page Content
 * @lazy ADR-294 — Extracted from page.tsx for dynamic import
 * @enterprise Refactored to use centralized systems (2026-02-08)
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Clock,
  Plus,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Calendar
} from 'lucide-react';

import CreateTaskModal from '@/components/crm/dashboard/dialogs/CreateTaskModal';
import { TasksTab } from '@/components/crm/dashboard/TasksTab';
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

export function TasksPageContent() {
  const { t } = useTranslation('crm');
  const layout = useLayoutClasses();
  const sectionSpacing = getSpacingClass('m', 'md', 'b');
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { stats, loading: loadingStats } = useRealtimeTasks(!authLoading && isAuthenticated);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [filters, setFilters] = useState<TaskFilterState>(defaultTaskFilters);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);

  const dashboardStats = useMemo<DashboardStat[]>(() => ([
    { title: t('tasks.stats.total'), value: loadingStats ? '...' : stats.total, icon: Clock, color: 'blue', description: t('tasks.stats.totalDesc') },
    { title: t('tasks.stats.pending'), value: loadingStats ? '...' : stats.pending, icon: AlertTriangle, color: 'yellow', description: t('tasks.stats.pendingDesc') },
    { title: t('tasks.stats.overdue'), value: loadingStats ? '...' : stats.overdue, icon: AlertTriangle, color: 'red', description: t('tasks.stats.overdueDesc') },
    { title: t('tasks.stats.completed'), value: loadingStats ? '...' : stats.completed, icon: CheckCircle, color: 'green', description: t('tasks.stats.completedDesc') },
    { title: t('tasks.stats.today'), value: loadingStats ? '...' : stats.dueToday, icon: Calendar, color: 'purple', description: t('tasks.stats.todayDesc') },
    { title: t('tasks.stats.thisWeek'), value: loadingStats ? '...' : stats.dueThisWeek, icon: TrendingUp, color: 'indigo', description: t('tasks.stats.thisWeekDesc') }
  ]), [stats, loadingStats, t]);

  const handleCardClick = useCallback((_stat: DashboardStat, index: number) => {
    if (activeCardIndex === index) {
      setActiveCardIndex(null);
      setFilters(defaultTaskFilters);
      return;
    }

    setActiveCardIndex(index);

    switch (index) {
      case 0:
        setFilters(defaultTaskFilters);
        break;
      case 1:
        setFilters({ ...defaultTaskFilters, status: 'pending' });
        break;
      case 2:
        setFilters({ ...defaultTaskFilters, timeframe: 'overdue' });
        break;
      case 3:
        setFilters({ ...defaultTaskFilters, status: 'completed' });
        break;
      case 4:
        setFilters({ ...defaultTaskFilters, timeframe: 'today' });
        break;
      case 5:
        setFilters({ ...defaultTaskFilters, timeframe: 'week' });
        break;
    }
  }, [activeCardIndex]);

  return (
    <PageContainer ariaLabel={t('tasks.title')}>
      <PageHeader
        variant="sticky-rounded"
        layout="single-row"
        breadcrumb={<ModuleBreadcrumb />}
        title={{
          icon: Clock,
          title: t('tasks.title'),
          subtitle: t('tasks.description')
        }}
        actions={{
          showDashboard,
          onDashboardToggle: () => setShowDashboard(!showDashboard),
          addButton: {
            label: t('tasks.newTask'),
            onClick: () => setShowCreateModal(true),
            icon: Plus
          }
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
        <section className={cn(layout.flexColGap4, 'flex-1 min-h-0')}>
          <TasksTab filters={filters} />
        </section>
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
