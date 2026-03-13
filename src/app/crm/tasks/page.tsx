// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
// 🏢 ENTERPRISE: Refactored to use centralized systems (2026-02-08)
'use client';

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
// 🏢 ENTERPRISE: Auth hook for race condition prevention
import { useAuth } from '@/auth/contexts/AuthContext';
// 🏢 ENTERPRISE: Real-time tasks (ADR-227 Phase 1)
import { useRealtimeTasks } from '@/services/realtime';
// 🏢 ENTERPRISE: Centralized systems
import { PageContainer, ListContainer } from '@/core/containers';
import { PageHeader } from '@/core/headers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
// 🏢 ENTERPRISE: Centralized AdvancedFiltersPanel (same as Contacts/Projects/Buildings)
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters/AdvancedFiltersPanel';
import { taskFiltersConfig, defaultTaskFilters } from '@/components/core/AdvancedFilters/configs';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import type { TaskFilterState } from '@/components/core/AdvancedFilters/configs';

export default function CrmTasksPage() {
  const { t } = useTranslation('crm');
  const layout = useLayoutClasses();
  const sectionSpacing = getSpacingClass('m', 'md', 'b');
  // 🏢 ENTERPRISE: Auth context for race condition prevention
  const { isAuthenticated, loading: authLoading } = useAuth();
  // 🏢 ENTERPRISE: Real-time tasks + stats (ADR-227 Phase 1)
  const { stats, loading: loadingStats } = useRealtimeTasks(!authLoading && isAuthenticated);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // 🏢 ENTERPRISE: Dashboard toggle (same pattern as Contacts/Projects)
  const [showDashboard, setShowDashboard] = useState(false);
  // 🏢 ENTERPRISE: Centralized filter state (replaces inline TasksTab filters)
  const [filters, setFilters] = useState<TaskFilterState>(defaultTaskFilters);
  // 🏢 ENTERPRISE: Active card filter tracking (same pattern as Contacts/Projects)
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);

  // 🏢 ENTERPRISE: Stats cards using centralized UnifiedDashboard pattern (real-time via ADR-227)
  const dashboardStats = useMemo<DashboardStat[]>(() => ([
    { title: t('tasks.stats.total'), value: loadingStats ? '...' : stats.total, icon: Clock, color: 'blue', description: t('tasks.stats.totalDesc') },
    { title: t('tasks.stats.pending'), value: loadingStats ? '...' : stats.pending, icon: AlertTriangle, color: 'yellow', description: t('tasks.stats.pendingDesc') },
    { title: t('tasks.stats.overdue'), value: loadingStats ? '...' : stats.overdue, icon: AlertTriangle, color: 'red', description: t('tasks.stats.overdueDesc') },
    { title: t('tasks.stats.completed'), value: loadingStats ? '...' : stats.completed, icon: CheckCircle, color: 'green', description: t('tasks.stats.completedDesc') },
    { title: t('tasks.stats.today'), value: loadingStats ? '...' : stats.dueToday, icon: Calendar, color: 'purple', description: t('tasks.stats.todayDesc') },
    { title: t('tasks.stats.thisWeek'), value: loadingStats ? '...' : stats.dueThisWeek, icon: TrendingUp, color: 'indigo', description: t('tasks.stats.thisWeekDesc') }
  ]), [stats, loadingStats, t]);

  // 🏢 ENTERPRISE: Card click → filter tasks (same pattern as Contacts/Projects)
  // Cards: 0=Total, 1=Pending, 2=Overdue, 3=Completed, 4=Today, 5=ThisWeek
  const handleCardClick = useCallback((_stat: DashboardStat, index: number) => {
    if (activeCardIndex === index) {
      // Toggle off: clicking the same card resets filters
      setActiveCardIndex(null);
      setFilters(defaultTaskFilters);
      return;
    }

    setActiveCardIndex(index);

    switch (index) {
      case 0: // Σύνολο — show all
        setFilters(defaultTaskFilters);
        break;
      case 1: // Εκκρεμείς — status=pending
        setFilters({ ...defaultTaskFilters, status: 'pending' });
        break;
      case 2: // Εκπρόθεσμες — timeframe=overdue
        setFilters({ ...defaultTaskFilters, timeframe: 'overdue' });
        break;
      case 3: // Ολοκληρωμένες — status=completed
        setFilters({ ...defaultTaskFilters, status: 'completed' });
        break;
      case 4: // Σήμερα — timeframe=today
        setFilters({ ...defaultTaskFilters, timeframe: 'today' });
        break;
      case 5: // Αυτή την Εβδομάδα — timeframe=week
        setFilters({ ...defaultTaskFilters, timeframe: 'week' });
        break;
    }
  }, [activeCardIndex]);

  return (
    <PageContainer ariaLabel={t('tasks.title')}>
      {/* 🏢 ENTERPRISE: Centralized PageHeader with dashboard toggle */}
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

      {/* 🏢 ENTERPRISE: Collapsible dashboard (same pattern as Contacts/Projects) */}
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

      {/* 🏢 ENTERPRISE: Centralized AdvancedFiltersPanel (replaces inline TasksTab filters) */}
      <AdvancedFiltersPanel
        config={taskFiltersConfig}
        filters={filters}
        onFiltersChange={setFilters}
        defaultFilters={defaultTaskFilters}
      />

      {/* 🏢 ENTERPRISE: Task list with centralized ListContainer */}
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
